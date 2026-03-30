/**
 * Affiliate Networks API 路由
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { generateId } from '../utils';

const affiliateNetworks = new Hono<{ Bindings: Env }>();

// 应用认证中间件
affiliateNetworks.use('/*', authMiddleware);

// ============================================
// Affiliate Networks 列表
// ============================================

affiliateNetworks.get('/', requirePermission('read'), async (c) => {
  const { page = 1, per_page = 20, status, search } = c.req.query();
  const offset = (Number(page) - 1) * Number(per_page);

  let sql = `
    SELECT an.*, 
      COUNT(DISTINCT o.id) as offers_count,
      COALESCE(SUM(st.clicks), 0) as total_clicks,
      COALESCE(SUM(st.cost), 0) as total_cost,
      COALESCE(SUM(st.conversions), 0) as total_conversions,
      COALESCE(SUM(st.revenue), 0) as total_revenue
    FROM affiliate_networks an
    LEFT JOIN offers o ON an.id = o.affiliate_network_id
    LEFT JOIN daily_stats st ON an.id = st.affiliate_network_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    sql += ' AND an.status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND an.name LIKE ?';
    params.push(`%${search}%`);
  }

  sql += ' GROUP BY an.id ORDER BY an.created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(per_page), offset);

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  const countSql = 'SELECT COUNT(*) as count FROM affiliate_networks WHERE 1=1' + 
    (status ? ' AND status = ?' : '') +
    (search ? ' AND name LIKE ?' : '');
  const countParams = [];
  if (status) countParams.push(status);
  if (search) countParams.push(`%${search}%`);
  
  const countResult = await c.env.DB.prepare(countSql).bind(...countParams).first<{ count: number }>();

  const data = result.results.map((row: any) => ({
    ...row,
    offer_parameters: row.offer_parameters ? JSON.parse(row.offer_parameters) : [],
    postback_params: row.postback_params ? JSON.parse(row.postback_params) : [],
    macros: row.macros ? JSON.parse(row.macros) : [],
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
// 创建 Affiliate Network
// ============================================

const affiliateNetworkSchema = z.object({
  name: z.string().min(1).max(255),
  template: z.string().optional(),
  offer_parameters: z.array(z.object({
    param: z.string(),
    macro: z.string(),
  })).optional(),
  postback_url: z.string().optional(),
  postback_params: z.array(z.object({
    param: z.string(),
    macro: z.string(),
  })).optional(),
  macros: z.array(z.string()).optional(),
  append_click_id: z.boolean().optional(),
  click_id_macro: z.string().optional(),
  status_macro: z.string().optional(),
  payout_macro: z.string().optional(),
  transaction_id_macro: z.string().optional(),
  notes: z.string().optional(),
});

affiliateNetworks.post('/', requirePermission('write'), async (c) => {
  const body = await c.req.json();
  const data = affiliateNetworkSchema.parse(body);

  const id = `an_${generateId()}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO affiliate_networks (
      id, name, template, offer_parameters, postback_url, postback_params,
      macros, append_click_id, click_id_macro, status_macro, payout_macro,
      transaction_id_macro, notes, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(
    id, data.name, data.template || null,
    data.offer_parameters ? JSON.stringify(data.offer_parameters) : null,
    data.postback_url || null,
    data.postback_params ? JSON.stringify(data.postback_params) : null,
    data.macros ? JSON.stringify(data.macros) : null,
    data.append_click_id !== false ? 1 : 0,
    data.click_id_macro || '{subid}',
    data.status_macro || '{status}',
    data.payout_macro || '{amount}',
    data.transaction_id_macro || '{transaction_id}',
    data.notes || null,
    now, now
  ).run();

  const affiliateNetwork = await c.env.DB.prepare(
    'SELECT * FROM affiliate_networks WHERE id = ?'
  ).bind(id).first();

  return c.json({
    ...affiliateNetwork,
    offer_parameters: affiliateNetwork?.offer_parameters ? JSON.parse(affiliateNetwork.offer_parameters as string) : [],
    postback_params: affiliateNetwork?.postback_params ? JSON.parse(affiliateNetwork.postback_params as string) : [],
    macros: affiliateNetwork?.macros ? JSON.parse(affiliateNetwork.macros as string) : [],
  }, 201);
});

// ============================================
// 获取 Affiliate Network 详情
// ============================================

affiliateNetworks.get('/:id', requirePermission('read'), async (c) => {
  const id = c.req.param('id');

  const affiliateNetwork = await c.env.DB.prepare(
    'SELECT * FROM affiliate_networks WHERE id = ?'
  ).bind(id).first();

  if (!affiliateNetwork) {
    throw Errors.NotFound('Affiliate Network');
  }

  // 获取关联的 Offers
  const offers = await c.env.DB.prepare(
    'SELECT id, name, status, payout_value, payout_currency FROM offers WHERE affiliate_network_id = ?'
  ).bind(id).all();

  return c.json({
    ...affiliateNetwork,
    offer_parameters: affiliateNetwork.offer_parameters ? JSON.parse(affiliateNetwork.offer_parameters as string) : [],
    postback_params: affiliateNetwork.postback_params ? JSON.parse(affiliateNetwork.postback_params as string) : [],
    macros: affiliateNetwork.macros ? JSON.parse(affiliateNetwork.macros as string) : [],
    offers: offers.results,
  });
});

// ============================================
// 更新 Affiliate Network
// ============================================

affiliateNetworks.put('/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = affiliateNetworkSchema.partial().parse(body);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM affiliate_networks WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    throw Errors.NotFound('Affiliate Network');
  }

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      if (['offer_parameters', 'postback_params', 'macros'].includes(key)) {
        updates.push(`${key} = ?`);
        params.push(JSON.stringify(value));
      } else if (key === 'append_click_id') {
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
    `UPDATE affiliate_networks SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  const affiliateNetwork = await c.env.DB.prepare(
    'SELECT * FROM affiliate_networks WHERE id = ?'
  ).bind(id).first();

  return c.json({
    ...affiliateNetwork,
    offer_parameters: affiliateNetwork?.offer_parameters ? JSON.parse(affiliateNetwork.offer_parameters as string) : [],
    postback_params: affiliateNetwork?.postback_params ? JSON.parse(affiliateNetwork.postback_params as string) : [],
    macros: affiliateNetwork?.macros ? JSON.parse(affiliateNetwork.macros as string) : [],
  });
});

// ============================================
// 删除 Affiliate Network
// ============================================

affiliateNetworks.delete('/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');

  await c.env.DB.prepare(
    "UPDATE affiliate_networks SET status = 'deleted', updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();

  return c.json({ success: true, message: 'Affiliate Network deleted' });
});

// ============================================
// 获取 Affiliate Network 模板列表
// ============================================

affiliateNetworks.get('/templates/list', requirePermission('read'), async (c) => {
  const templates = await c.env.DB.prepare(
    'SELECT * FROM affiliate_network_templates ORDER BY name'
  ).all();

  return c.json({
    data: templates.results.map((t: any) => ({
      ...t,
      offer_parameters: t.offer_parameters ? JSON.parse(t.offer_parameters) : [],
      postback_params: t.postback_params ? JSON.parse(t.postback_params) : [],
      macros: t.macros ? JSON.parse(t.macros) : [],
    })),
  });
});

// ============================================
// 生成 Postback URL
// ============================================

affiliateNetworks.get('/:id/postback-url', requirePermission('read'), async (c) => {
  const id = c.req.param('id');
  const domain = c.req.query('domain') || c.env.DEFAULT_DOMAIN || 'tracker.example.com';

  const affiliateNetwork = await c.env.DB.prepare(
    'SELECT * FROM affiliate_networks WHERE id = ?'
  ).bind(id).first();

  if (!affiliateNetwork) {
    throw Errors.NotFound('Affiliate Network');
  }

  // 生成 Postback URL
  const baseUrl = `https://${domain}/postback`;
  const params = new URLSearchParams();
  
  params.set('clickid', affiliateNetwork.click_id_macro as string || '{subid}');
  params.set('payout', affiliateNetwork.payout_macro as string || '{amount}');
  params.set('status', affiliateNetwork.status_macro as string || '{status}');

  const postbackUrl = `${baseUrl}?${params.toString()}`;

  return c.json({
    postback_url: postbackUrl,
    click_id_macro: affiliateNetwork.click_id_macro,
    status_macro: affiliateNetwork.status_macro,
    payout_macro: affiliateNetwork.payout_macro,
    transaction_id_macro: affiliateNetwork.transaction_id_macro,
  });
});

export { affiliateNetworks as affiliateNetworksRoutes };
