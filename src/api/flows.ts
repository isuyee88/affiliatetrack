/**
 * Flows API 路由
 * 流量分发流程管理
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { generateId } from '../utils';

const flows = new Hono<{ Bindings: Env }>();

// 应用认证中间件
flows.use('/*', authMiddleware);

// ============================================
// Flow Schema
// ============================================

const flowSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['forced', 'regular', 'default']).default('regular'),
  position: z.number().int().min(0).optional(),
  weight: z.number().int().min(1).max(1000).default(100),
  collect_clicks: z.boolean().default(true),
  schema_type: z.enum(['split', 'redirect', 'action']).default('split'),
  schema_config: z.object({
    type: z.enum(['split', 'redirect', 'action']),
    landings: z.array(z.object({
      id: z.string(),
      weight: z.number(),
    })).optional(),
    offers: z.array(z.object({
      id: z.string(),
      weight: z.number(),
    })).optional(),
    redirect_url: z.string().optional(),
    action_type: z.string().optional(),
  }).optional(),
});

const filterSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'in', 'not_in', 'contains', 'regex', 'between', 'empty', 'not_empty']),
  value: z.union([z.string(), z.array(z.string()), z.object({ from: z.string(), to: z.string() })]),
  logic: z.enum(['and', 'or']).default('and'),
});

// ============================================
// 获取 Campaign 的所有 Flows
// ============================================

flows.get('/campaign/:campaignId', requirePermission('read'), async (c) => {
  const campaignId = c.req.param('campaignId');

  // 验证 Campaign 存在
  const campaign = await c.env.DB.prepare(
    'SELECT id FROM campaigns WHERE id = ?'
  ).bind(campaignId).first();

  if (!campaign) {
    throw Errors.NotFound('Campaign');
  }

  // 获取 Flows
  const flowsResult = await c.env.DB.prepare(
    `SELECT f.*, 
      COUNT(DISTINCT s.id) as streams_count,
      COALESCE(SUM(s.total_clicks), 0) as total_clicks,
      COALESCE(SUM(s.total_conversions), 0) as total_conversions
    FROM flows f
    LEFT JOIN streams s ON f.id = s.flow_id
    WHERE f.campaign_id = ?
    GROUP BY f.id
    ORDER BY 
      CASE f.type 
        WHEN 'forced' THEN 0 
        WHEN 'regular' THEN 1 
        WHEN 'default' THEN 2 
      END,
      f.position ASC`
  ).bind(campaignId).all();

  // 为每个 Flow 获取过滤器
  const flowsWithDetails = await Promise.all(
    flowsResult.results.map(async (flow: any) => {
      const filters = await c.env.DB.prepare(
        'SELECT * FROM flow_filters WHERE flow_id = ? ORDER BY position'
      ).bind(flow.id).all();

      const streams = await c.env.DB.prepare(
        'SELECT * FROM streams WHERE flow_id = ? ORDER BY position, weight DESC'
      ).bind(flow.id).all();

      return {
        ...flow,
        schema_config: flow.schema_config ? JSON.parse(flow.schema_config) : null,
        filters: filters.results.map((f: any) => ({
          ...f,
          value: f.value ? JSON.parse(f.value) : null,
        })),
        streams: streams.results,
      };
    })
  );

  return c.json({ data: flowsWithDetails });
});

// ============================================
// 创建 Flow
// ============================================

flows.post('/campaign/:campaignId', requirePermission('write'), async (c) => {
  const campaignId = c.req.param('campaignId');
  const body = await c.req.json();
  const data = flowSchema.parse(body);
  const filters = body.filters ? z.array(filterSchema).parse(body.filters) : [];

  // 验证 Campaign 存在
  const campaign = await c.env.DB.prepare(
    'SELECT id FROM campaigns WHERE id = ?'
  ).bind(campaignId).first();

  if (!campaign) {
    throw Errors.NotFound('Campaign');
  }

  const id = `flow_${generateId()}`;
  const now = new Date().toISOString();

  // 获取下一个 position
  const maxPosition = await c.env.DB.prepare(
    'SELECT MAX(position) as max_pos FROM flows WHERE campaign_id = ?'
  ).bind(campaignId).first();

  const position = data.position ?? ((maxPosition?.max_pos as number) || 0) + 1;

  await c.env.DB.prepare(
    `INSERT INTO flows (
      id, campaign_id, name, type, position, weight, collect_clicks,
      schema_type, schema_config, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(
    id, campaignId, data.name, data.type, position, data.weight,
    data.collect_clicks ? 1 : 0, data.schema_type,
    data.schema_config ? JSON.stringify(data.schema_config) : null,
    now, now
  ).run();

  // 创建过滤器
  for (let i = 0; i < filters.length; i++) {
    const filter = filters[i];
    await c.env.DB.prepare(
      `INSERT INTO flow_filters (id, flow_id, field, operator, value, logic, position, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      `ff_${generateId()}`, id, filter.field, filter.operator,
      JSON.stringify(filter.value), filter.logic, i, now
    ).run();
  }

  const flow = await c.env.DB.prepare(
    'SELECT * FROM flows WHERE id = ?'
  ).bind(id).first();

  return c.json({
    ...flow,
    schema_config: flow?.schema_config ? JSON.parse(flow.schema_config as string) : null,
    filters,
  }, 201);
});

// ============================================
// 获取 Flow 详情
// ============================================

flows.get('/:id', requirePermission('read'), async (c) => {
  const id = c.req.param('id');

  const flow = await c.env.DB.prepare(
    'SELECT * FROM flows WHERE id = ?'
  ).bind(id).first();

  if (!flow) {
    throw Errors.NotFound('Flow');
  }

  const filters = await c.env.DB.prepare(
    'SELECT * FROM flow_filters WHERE flow_id = ? ORDER BY position'
  ).bind(id).all();

  const streams = await c.env.DB.prepare(
    'SELECT * FROM streams WHERE flow_id = ? ORDER BY position, weight DESC'
  ).bind(id).all();

  return c.json({
    ...flow,
    schema_config: flow.schema_config ? JSON.parse(flow.schema_config as string) : null,
    filters: filters.results.map((f: any) => ({
      ...f,
      value: f.value ? JSON.parse(f.value) : null,
    })),
    streams: streams.results,
  });
});

// ============================================
// 更新 Flow
// ============================================

flows.put('/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = flowSchema.partial().parse(body);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM flows WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    throw Errors.NotFound('Flow');
  }

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === 'schema_config') {
        updates.push(`${key} = ?`);
        params.push(JSON.stringify(value));
      } else if (key === 'collect_clicks') {
        updates.push(`${key} = ?`);
        params.push(value ? 1 : 0);
      } else {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
  });

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);

    await c.env.DB.prepare(
      `UPDATE flows SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();
  }

  // 更新过滤器
  if (body.filters) {
    await c.env.DB.prepare('DELETE FROM flow_filters WHERE flow_id = ?').bind(id).run();

    const filters = z.array(filterSchema).parse(body.filters);
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      await c.env.DB.prepare(
        `INSERT INTO flow_filters (id, flow_id, field, operator, value, logic, position, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        `ff_${generateId()}`, id, filter.field, filter.operator,
        JSON.stringify(filter.value), filter.logic, i
      ).run();
    }
  }

  const flow = await c.env.DB.prepare('SELECT * FROM flows WHERE id = ?').bind(id).first();

  return c.json({
    ...flow,
    schema_config: flow?.schema_config ? JSON.parse(flow.schema_config as string) : null,
  });
});

// ============================================
// 删除 Flow
// ============================================

flows.delete('/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');

  // 删除关联的 streams 和 filters
  await c.env.DB.prepare('DELETE FROM flow_filters WHERE flow_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM streams WHERE flow_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM flows WHERE id = ?').bind(id).run();

  return c.json({ success: true, message: 'Flow deleted' });
});

// ============================================
// Stream 管理
// ============================================

const streamSchema = z.object({
  type: z.enum(['landing_offer', 'offer', 'redirect', 'action']),
  landing_id: z.string().optional(),
  offer_id: z.string().optional(),
  redirect_url: z.string().optional(),
  redirect_type: z.enum(['http', 'meta', 'js', 'curl', 'double_meta', 'form_submit', 'iframe']).default('http'),
  weight: z.number().int().min(1).max(1000).default(100),
  position: z.number().int().min(0).optional(),
});

// 创建 Stream
flows.post('/:flowId/streams', requirePermission('write'), async (c) => {
  const flowId = c.req.param('flowId');
  const body = await c.req.json();
  const data = streamSchema.parse(body);

  const flow = await c.env.DB.prepare('SELECT id FROM flows WHERE id = ?').bind(flowId).first();
  if (!flow) {
    throw Errors.NotFound('Flow');
  }

  const id = `str_${generateId()}`;
  const now = new Date().toISOString();

  const maxPosition = await c.env.DB.prepare(
    'SELECT MAX(position) as max_pos FROM streams WHERE flow_id = ?'
  ).bind(flowId).first();

  const position = data.position ?? ((maxPosition?.max_pos as number) || 0) + 1;

  await c.env.DB.prepare(
    `INSERT INTO streams (
      id, flow_id, type, landing_id, offer_id, redirect_url, redirect_type,
      weight, position, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(
    id, flowId, data.type, data.landing_id || null, data.offer_id || null,
    data.redirect_url || null, data.redirect_type, data.weight, position,
    now, now
  ).run();

  const stream = await c.env.DB.prepare('SELECT * FROM streams WHERE id = ?').bind(id).first();

  return c.json(stream, 201);
});

// 获取 Flow 的所有 Streams
flows.get('/:flowId/streams', requirePermission('read'), async (c) => {
  const flowId = c.req.param('flowId');

  const streams = await c.env.DB.prepare(
    'SELECT * FROM streams WHERE flow_id = ? ORDER BY position, weight DESC'
  ).bind(flowId).all();

  return c.json({ data: streams.results });
});

// 删除 Stream
flows.delete('/streams/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');

  await c.env.DB.prepare('DELETE FROM streams WHERE id = ?').bind(id).run();

  return c.json({ success: true, message: 'Stream deleted' });
});

// 更新 Stream
flows.put('/streams/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = streamSchema.partial().parse(body);

  const existing = await c.env.DB.prepare('SELECT * FROM streams WHERE id = ?').bind(id).first();
  if (!existing) {
    throw Errors.NotFound('Stream');
  }

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  });

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id);

    await c.env.DB.prepare(
      `UPDATE streams SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();
  }

  const stream = await c.env.DB.prepare('SELECT * FROM streams WHERE id = ?').bind(id).first();

  return c.json(stream);
});

export { flows as flowsRoutes };
