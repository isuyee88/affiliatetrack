/**
 * Traffic Sources API 路由
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { generateId } from '../utils';

const trafficSources = new Hono<{ Bindings: Env }>();

// 应用认证中间件
trafficSources.use('/*', authMiddleware);

// ============================================
// Traffic Sources 列表
// ============================================

trafficSources.get('/', requirePermission('read'), async (c) => {
  const { page = 1, per_page = 20, status, search } = c.req.query();
  const offset = (Number(page) - 1) * Number(per_page);

  let sql = `
    SELECT ts.*, 
      COUNT(DISTINCT c.id) as campaigns_count,
      COALESCE(SUM(st.clicks), 0) as total_clicks,
      COALESCE(SUM(st.cost), 0) as total_cost,
      COALESCE(SUM(st.conversions), 0) as total_conversions,
      COALESCE(SUM(st.revenue), 0) as total_revenue
    FROM traffic_sources ts
    LEFT JOIN campaigns c ON ts.id = c.traffic_source_id
    LEFT JOIN daily_stats st ON ts.id = st.traffic_source_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    sql += ' AND ts.status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND ts.name LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ' GROUP BY ts.id ORDER BY ts.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(per_page), offset);

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  // 获取总数
  const countSql = 'SELECT COUNT(*) as count FROM traffic_sources WHERE 1=1' + 
    (status ? ' AND status = ?' : '') +
    (search ? ' AND name LIKE ?' : '');
  const countParams = [];
  if (status) countParams.push(status);
  if (search) countParams.push(`%${search}%`);
  
  const countResult = await c.env.DB.prepare(countSql).bind(...countParams).first<{ count: number }>();

  // 计算额外指标
  const data = result.results.map((row: any) => ({
    ...row,
    parameters: row.parameters ? JSON.parse(row.parameters) : [],
    total_profit: (row.total_revenue || 0) - (row.total_cost || 0),
    roi: row.total_cost > 0 ? (((row.total_revenue || 0) - (row.total_cost || 0)) / row.total_cost * 100) : 0,
    epc: row.total_clicks > 0 ? (row.total_revenue || 0) / row.total_clicks : 0,
    cpc: row.total_clicks > 0 ? (row.total_cost || 0) / row.total_clicks : 0,
  }));

  return c.json({
    data,
    pagination: {
      page: Number(page),
      per_page: Number(per_page),
      total: countResult?.count || 0,
      total_pages: Math.ceil((countResult?.count || 0) / Number(per_page)),
    },
  });
});

// ============================================
// 创建 Traffic Source
// ============================================

const trafficSourceSchema = z.object({
  name: z.string().min(1).max(255),
  template: z.string().optional(),
  parameters: z.array(z.object({
    alias: z.string(),
    name: z.string(),
    macro: z.string(),
  })).optional(),
  s2s_postback: z.string().optional(),
  s2s_postback_params: z.record(z.string()).optional(),
  send_only_status: z.boolean().optional(),
  cost_parameter: z.string().optional(),
  cost_token: z.string().optional(),
  revenue_parameter: z.string().optional(),
  revenue_token: z.string().optional(),
  click_id_parameter: z.string().optional(),
  notes: z.string().optional(),
});

trafficSources.post('/', requirePermission('write'), async (c) => {
  const body = await c.req.json();
  const data = trafficSourceSchema.parse(body);

  const id = `ts_${generateId()}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO traffic_sources (
      id, name, template, parameters, s2s_postback, s2s_postback_params,
      send_only_status, cost_parameter, cost_token, revenue_parameter,
      revenue_token, click_id_parameter, notes, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(
    id, data.name, data.template || null,
    data.parameters ? JSON.stringify(data.parameters) : null,
    data.s2s_postback || null,
    data.s2s_postback_params ? JSON.stringify(data.s2s_postback_params) : null,
    data.send_only_status ? 1 : 0,
    data.cost_parameter || null,
    data.cost_token || null,
    data.revenue_parameter || null,
    data.revenue_token || null,
    data.click_id_parameter || 'clickid',
    data.notes || null,
    now, now
  ).run();

  const trafficSource = await c.env.DB.prepare(
    'SELECT * FROM traffic_sources WHERE id = ?'
  ).bind(id).first();

  return c.json({
    ...trafficSource,
    parameters: trafficSource?.parameters ? JSON.parse(trafficSource.parameters as string) : [],
  }, 201);
});

// ============================================
// 获取 Traffic Source 详情
// ============================================

trafficSources.get('/:id', requirePermission('read'), async (c) => {
  const id = c.req.param('id');

  const trafficSource = await c.env.DB.prepare(
    'SELECT * FROM traffic_sources WHERE id = ?'
  ).bind(id).first();

  if (!trafficSource) {
    throw Errors.NotFound('Traffic Source');
  }

  // 获取关联的 Campaigns
  const campaigns = await c.env.DB.prepare(
    'SELECT id, name, status FROM campaigns WHERE traffic_source_id = ?'
  ).bind(id).all();

  return c.json({
    ...trafficSource,
    parameters: trafficSource.parameters ? JSON.parse(trafficSource.parameters as string) : [],
    campaigns: campaigns.results,
  });
});

// ============================================
// 更新 Traffic Source
// ============================================

trafficSources.put('/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = trafficSourceSchema.partial().parse(body);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM traffic_sources WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    throw Errors.NotFound('Traffic Source');
  }

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === 'parameters' || key === 's2s_postback_params') {
        updates.push(`${key} = ?`);
        params.push(JSON.stringify(value));
      } else if (key === 'send_only_status') {
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
    `UPDATE traffic_sources SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  const trafficSource = await c.env.DB.prepare(
    'SELECT * FROM traffic_sources WHERE id = ?'
  ).bind(id).first();

  return c.json({
    ...trafficSource,
    parameters: trafficSource?.parameters ? JSON.parse(trafficSource.parameters as string) : [],
  });
});

// ============================================
// 删除 Traffic Source
// ============================================

trafficSources.delete('/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');

  await c.env.DB.prepare(
    "UPDATE traffic_sources SET status = 'deleted', updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true, message: 'Traffic Source deleted' });
});

// ============================================
// 获取 Traffic Source 模板列表
// ============================================

trafficSources.get('/templates/list', requirePermission('read'), async (c) => {
  const templates = await c.env.DB.prepare(
    'SELECT * FROM traffic_source_templates ORDER BY name'
  ).all();

  return c.json({
    data: templates.results.map((t: any) => ({
      ...t,
      parameters: t.parameters ? JSON.parse(t.parameters) : [],
    })),
  });
});

export { trafficSources as trafficSourcesRoutes };
