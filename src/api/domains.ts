/**
 * Domains API 路由
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { generateId } from '../utils';

const domains = new Hono<{ Bindings: Env }>();

// 应用认证中间件
domains.use('/*', authMiddleware);

// ============================================
// Domains 列表
// ============================================

domains.get('/', requirePermission('read'), async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT d.*,
      COUNT(DISTINCT c.id) as campaigns_count,
      COUNT(DISTINCT l.id) as landings_count
    FROM domains d
    LEFT JOIN campaigns c ON d.id = c.domain_id
    LEFT JOIN landings l ON d.id = l.domain_id
    GROUP BY d.id
    ORDER BY d.is_default DESC, d.created_at DESC`
  ).all();

  return c.json({ data: result.results });
});

// ============================================
// 创建 Domain
// ============================================

const domainSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['tracker', 'landing', 'both']).default('tracker'),
  ssl_enabled: z.boolean().default(false),
  ssl_auto_renew: z.boolean().default(false),
  is_default: z.boolean().default(false),
});

domains.post('/', requirePermission('admin'), async (c) => {
  const body = await c.req.json();
  const data = domainSchema.parse(body);

  // 检查域名是否已存在
  const existing = await c.env.DB.prepare(
    'SELECT id FROM domains WHERE name = ?'
  ).bind(data.name).first();

  if (existing) {
    throw Errors.Conflict('Domain already exists');
  }

  const id = `dom_${generateId()}`;
  const now = new Date().toISOString();

  // 如果设置为默认，取消其他默认
  if (data.is_default) {
    await c.env.DB.prepare(
      'UPDATE domains SET is_default = 0'
    ).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO domains (id, name, type, ssl_enabled, ssl_auto_renew, is_default, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(
    id, data.name, data.type,
    data.ssl_enabled ? 1 : 0,
    data.ssl_auto_renew ? 1 : 0,
    data.is_default ? 1 : 0,
    now, now
  ).run();

  const domain = await c.env.DB.prepare(
    'SELECT * FROM domains WHERE id = ?'
  ).bind(id).first();

  return c.json(domain, 201);
});

// ============================================
// 获取 Domain 详情
// ============================================

domains.get('/:id', requirePermission('read'), async (c) => {
  const id = c.req.param('id');

  const domain = await c.env.DB.prepare(
    'SELECT * FROM domains WHERE id = ?'
  ).bind(id).first();

  if (!domain) {
    throw Errors.NotFound('Domain');
  }

  return c.json(domain);
});

// ============================================
// 更新 Domain
// ============================================

domains.put('/:id', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = domainSchema.partial().parse(body);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM domains WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    throw Errors.NotFound('Domain');
  }

  // 如果设置为默认，取消其他默认
  if (data.is_default) {
    await c.env.DB.prepare(
      'UPDATE domains SET is_default = 0'
    ).run();
  }

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      if (['ssl_enabled', 'ssl_auto_renew', 'is_default'].includes(key)) {
        updates.push(`${key} = ?`);
        params.push(value ? 1 : 0);
      } else {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
  });

  if (updates.length === 0) {
    return c.json(existing);
  }

  updates.push("updated_at = datetime('now')");
  params.push(id);

  await c.env.DB.prepare(
    `UPDATE domains SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  const domain = await c.env.DB.prepare(
    'SELECT * FROM domains WHERE id = ?'
  ).bind(id).first();

  return c.json(domain);
});

// ============================================
// 删除 Domain
// ============================================

domains.delete('/:id', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');

  // 检查是否有关联的 Campaigns
  const campaigns = await c.env.DB.prepare(
    'SELECT COUNT(*) as count FROM campaigns WHERE domain_id = ?'
  ).bind(id).first<{ count: number }>();

  if (campaigns && campaigns.count > 0) {
    throw Errors.Conflict('Cannot delete domain with associated campaigns');
  }

  await c.env.DB.prepare('DELETE FROM domains WHERE id = ?').bind(id).run();

  return c.json({ success: true, message: 'Domain deleted' });
});

// ============================================
// 设置默认域名
// ============================================

domains.post('/:id/set-default', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');

  const domain = await c.env.DB.prepare(
    'SELECT * FROM domains WHERE id = ?'
  ).bind(id).first();

  if (!domain) {
    throw Errors.NotFound('Domain');
  }

  // 取消其他默认
  await c.env.DB.prepare('UPDATE domains SET is_default = 0').run();

  // 设置当前为默认
  await c.env.DB.prepare(
    "UPDATE domains SET is_default = 1, updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true, message: 'Default domain updated' });
});

export { domains as domainsRoutes };
