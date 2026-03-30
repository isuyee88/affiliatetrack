/**
 * Groups API 路由
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { generateId } from '../utils';

const groups = new Hono<{ Bindings: Env }>();

// 应用认证中间件
groups.use('/*', authMiddleware);

// ============================================
// Groups 列表
// ============================================

groups.get('/', requirePermission('read'), async (c) => {
  const { entity_type } = c.req.query();

  let sql = `
    SELECT g.*,
      CASE g.entity_type
        WHEN 'campaign' THEN (SELECT COUNT(*) FROM campaigns WHERE group_id = g.id)
        WHEN 'offer' THEN (SELECT COUNT(*) FROM offers WHERE group_id = g.id)
        WHEN 'landing' THEN (SELECT COUNT(*) FROM landings WHERE group_id = g.id)
        WHEN 'traffic_source' THEN (SELECT COUNT(*) FROM traffic_sources WHERE id IN (SELECT traffic_source_id FROM campaigns WHERE group_id = g.id))
        WHEN 'affiliate_network' THEN (SELECT COUNT(*) FROM affiliate_networks WHERE id IN (SELECT affiliate_network_id FROM offers WHERE group_id = g.id))
      END as items_count
    FROM groups g
    WHERE 1=1
  `;
  const params: any[] = [];

  if (entity_type) {
    sql += ' AND g.entity_type = ?';
    params.push(entity_type);
  }

  sql += ' ORDER BY g.entity_type, g.position, g.name';

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({ data: result.results });
});

// ============================================
// 创建 Group
// ============================================

const groupSchema = z.object({
  name: z.string().min(1).max(255),
  entity_type: z.enum(['campaign', 'offer', 'landing', 'traffic_source', 'affiliate_network']),
  color: z.string().optional(),
  position: z.number().int().min(0).optional(),
});

groups.post('/', requirePermission('write'), async (c) => {
  const body = await c.req.json();
  const data = groupSchema.parse(body);

  const id = `grp_${generateId()}`;

  // 获取下一个 position
  const maxPosition = await c.env.DB.prepare(
    'SELECT MAX(position) as max_pos FROM groups WHERE entity_type = ?'
  ).bind(data.entity_type).first();

  const position = data.position ?? ((maxPosition?.max_pos as number) || 0) + 1;

  await c.env.DB.prepare(
    `INSERT INTO groups (id, name, entity_type, position, color, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    id, data.name, data.entity_type, position, data.color || '#3b82f6'
  ).run();

  const group = await c.env.DB.prepare(
    'SELECT * FROM groups WHERE id = ?'
  ).bind(id).first();

  return c.json(group, 201);
});

// ============================================
// 更新 Group
// ============================================

groups.put('/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = groupSchema.partial().parse(body);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM groups WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    throw Errors.NotFound('Group');
  }

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  });

  if (updates.length === 0) {
    return c.json(existing);
  }

  params.push(id);

  await c.env.DB.prepare(
    `UPDATE groups SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  const group = await c.env.DB.prepare(
    'SELECT * FROM groups WHERE id = ?'
  ).bind(id).first();

  return c.json(group);
});

// ============================================
// 删除 Group
// ============================================

groups.delete('/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');

  // 将关联项目的 group_id 设为 null
  const group = await c.env.DB.prepare(
    'SELECT entity_type FROM groups WHERE id = ?'
  ).bind(id).first();

  if (group) {
    const tableMap: Record<string, string> = {
      campaign: 'campaigns',
      offer: 'offers',
      landing: 'landings',
    };

    const table = tableMap[group.entity_type as string];
    if (table) {
      await c.env.DB.prepare(
        `UPDATE ${table} SET group_id = NULL WHERE group_id = ?`
      ).bind(id).run();
    }
  }

  await c.env.DB.prepare('DELETE FROM groups WHERE id = ?').bind(id).run();

  return c.json({ success: true, message: 'Group deleted' });
});

// ============================================
// 批量更新位置
// ============================================

groups.post('/reorder', requirePermission('write'), async (c) => {
  const body = await c.req.json();
  const { orders } = z.object({
    orders: z.array(z.object({
      id: z.string(),
      position: z.number().int(),
    })),
  }).parse(body);

  for (const item of orders) {
    await c.env.DB.prepare(
      'UPDATE groups SET position = ? WHERE id = ?'
    ).bind(item.position, item.id).run();
  }

  return c.json({ success: true, message: 'Groups reordered' });
});

export { groups as groupsRoutes };
