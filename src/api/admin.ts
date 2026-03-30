/**
 * 管理 API 路由
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { generateId, generateApiKey, hashString } from '../utils';

const admin = new Hono<{ Bindings: Env }>();

// 应用认证中间件
admin.use('/*', authMiddleware);

// ============================================
// Campaigns 管理
// ============================================

const campaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['traffic', 'content', 'push', 'native']).default('traffic'),
  traffic_source: z.string().optional(),
  traffic_source_id: z.string().optional(),
  distribution_type: z.enum(['weighted', 'ab_test', 'geo', 'device']).default('weighted'),
  daily_budget: z.number().positive().optional(),
  total_budget: z.number().positive().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  attribution_window: z.number().int().positive().default(86400),
  click_id_param: z.string().default('clickid'),
});

// 列表
admin.get('/campaigns', requirePermission('read'), async (c) => {
  const { page = 1, per_page = 20, status, search } = c.req.query();
  const offset = (Number(page) - 1) * Number(per_page);

  let sql = 'SELECT * FROM campaigns WHERE 1=1';
  const params: any[] = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  // 获取总数
  const countResult = await c.env.DB.prepare(
    sql.replace('SELECT *', 'SELECT COUNT(*) as count')
  )
    .bind(...params)
    .first<{ count: number }>();

  // 获取数据
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(per_page), offset);

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({
    data: result.results,
    pagination: {
      page: Number(page),
      per_page: Number(per_page),
      total: countResult?.count || 0,
      total_pages: Math.ceil((countResult?.count || 0) / Number(per_page)),
    },
  });
});

// 创建
admin.post('/campaigns', requirePermission('write'), async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const data = campaignSchema.parse(body);

  const id = `cp_${generateId()}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO campaigns (
      id, name, type, status, traffic_source, traffic_source_id,
      distribution_type, daily_budget, total_budget, budget_spent,
      start_date, end_date, attribution_window, click_id_param,
      created_by, created_at, updated_at
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, data.name, data.type, data.traffic_source, data.traffic_source_id,
      data.distribution_type, data.daily_budget, data.total_budget,
      data.start_date, data.end_date, data.attribution_window, data.click_id_param,
      user.id, now, now
    )
    .run();

  const campaign = await c.env.DB.prepare(
    'SELECT * FROM campaigns WHERE id = ?'
  )
    .bind(id)
    .first();

  return c.json(campaign, 201);
});

// 获取详情
admin.get('/campaigns/:id', requirePermission('read'), async (c) => {
  const id = c.req.param('id');

  const campaign = await c.env.DB.prepare(
    'SELECT * FROM campaigns WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!campaign) {
    throw Errors.NotFound('Campaign');
  }

  // 获取关联的 offers
  const offers = await c.env.DB.prepare(
    'SELECT * FROM offers WHERE campaign_id = ?'
  )
    .bind(id)
    .all();

  // 获取关联的 landers
  const landers = await c.env.DB.prepare(
    'SELECT * FROM landers WHERE campaign_id = ?'
  )
    .bind(id)
    .all();

  return c.json({
    ...campaign,
    offers: offers.results,
    landers: landers.results,
  });
});

// 更新
admin.put('/campaigns/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = campaignSchema.partial().parse(body);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM campaigns WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!existing) {
    throw Errors.NotFound('Campaign');
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

  updates.push("updated_at = datetime('now')");
  params.push(id);

  await c.env.DB.prepare(
    `UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...params)
    .run();

  const campaign = await c.env.DB.prepare(
    'SELECT * FROM campaigns WHERE id = ?'
  )
    .bind(id)
    .first();

  return c.json(campaign);
});

// 删除
admin.delete('/campaigns/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare(
    'SELECT * FROM campaigns WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!existing) {
    throw Errors.NotFound('Campaign');
  }

  // 软删除
  await c.env.DB.prepare(
    "UPDATE campaigns SET status = 'deleted', updated_at = datetime('now') WHERE id = ?"
  )
    .bind(id)
    .run();

  return c.json({ success: true, message: 'Campaign deleted' });
});

// ============================================
// Offers 管理
// ============================================

const offerSchema = z.object({
  name: z.string().min(1).max(255),
  campaign_id: z.string().optional(),
  affiliate_network_id: z.string().optional(),
  external_offer_id: z.string().optional(),
  payout_type: z.enum(['cpa', 'cpl', 'cps', 'revshare']).default('cpa'),
  payout_value: z.number().positive(),
  payout_currency: z.string().default('USD'),
  target_url: z.string().url(),
  preview_url: z.string().url().optional(),
  daily_cap: z.number().int().positive().optional(),
  total_cap: z.number().int().positive().optional(),
  geo_targeting: z.array(z.string()).optional(),
  device_targeting: z.object({
    os: z.array(z.string()).optional(),
    browser: z.array(z.string()).optional(),
    device_type: z.array(z.enum(['desktop', 'mobile', 'tablet'])).optional(),
  }).optional(),
  conversion_track_method: z.enum(['postback', 'pixel', 'iframe']).default('postback'),
});

admin.get('/offers', requirePermission('read'), async (c) => {
  const { page = 1, per_page = 20, campaign_id, status } = c.req.query();
  const offset = (Number(page) - 1) * Number(per_page);

  let sql = 'SELECT * FROM offers WHERE 1=1';
  const params: any[] = [];

  if (campaign_id) {
    sql += ' AND campaign_id = ?';
    params.push(campaign_id);
  }

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  const countResult = await c.env.DB.prepare(
    sql.replace('SELECT *', 'SELECT COUNT(*) as count')
  )
    .bind(...params)
    .first<{ count: number }>();

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(per_page), offset);

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({
    data: result.results,
    pagination: {
      page: Number(page),
      per_page: Number(per_page),
      total: countResult?.count || 0,
      total_pages: Math.ceil((countResult?.count || 0) / Number(per_page)),
    },
  });
});

admin.post('/offers', requirePermission('write'), async (c) => {
  const body = await c.req.json();
  const data = offerSchema.parse(body);

  const id = `off_${generateId()}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO offers (
      id, name, campaign_id, affiliate_network_id, external_offer_id,
      payout_type, payout_value, payout_currency, target_url, preview_url,
      status, daily_cap, total_cap,
      geo_targeting, device_targeting, conversion_track_method,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, data.name, data.campaign_id, data.affiliate_network_id, data.external_offer_id,
      data.payout_type, data.payout_value, data.payout_currency, data.target_url, data.preview_url,
      data.daily_cap, data.total_cap,
      data.geo_targeting ? JSON.stringify(data.geo_targeting) : null,
      data.device_targeting ? JSON.stringify(data.device_targeting) : null,
      data.conversion_track_method,
      now, now
    )
    .run();

  const offer = await c.env.DB.prepare(
    'SELECT * FROM offers WHERE id = ?'
  )
    .bind(id)
    .first();

  return c.json(offer, 201);
});

admin.get('/offers/:id', requirePermission('read'), async (c) => {
  const id = c.req.param('id');

  const offer = await c.env.DB.prepare(
    'SELECT * FROM offers WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!offer) {
    throw Errors.NotFound('Offer');
  }

  return c.json(offer);
});

admin.put('/offers/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = offerSchema.partial().parse(body);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM offers WHERE id = ?'
  )
    .bind(id)
    .first();

  if (!existing) {
    throw Errors.NotFound('Offer');
  }

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === 'geo_targeting' || key === 'device_targeting') {
        updates.push(`${key} = ?`);
        params.push(JSON.stringify(value));
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
    `UPDATE offers SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...params)
    .run();

  const offer = await c.env.DB.prepare(
    'SELECT * FROM offers WHERE id = ?'
  )
    .bind(id)
    .first();

  return c.json(offer);
});

admin.delete('/offers/:id', requirePermission('write'), async (c) => {
  const id = c.req.param('id');

  await c.env.DB.prepare(
    "UPDATE offers SET status = 'deleted', updated_at = datetime('now') WHERE id = ?"
  )
    .bind(id)
    .run();

  return c.json({ success: true, message: 'Offer deleted' });
});

// ============================================
// Landers 管理
// ============================================

const landerSchema = z.object({
  name: z.string().min(1).max(255),
  campaign_id: z.string().optional(),
  url: z.string().url(),
  weight: z.number().int().min(1).max(1000).default(100),
  tracking_params: z.record(z.string()).optional(),
});

admin.get('/landers', requirePermission('read'), async (c) => {
  const { page = 1, per_page = 20, campaign_id } = c.req.query();
  const offset = (Number(page) - 1) * Number(per_page);

  let sql = 'SELECT * FROM landers WHERE 1=1';
  const params: any[] = [];

  if (campaign_id) {
    sql += ' AND campaign_id = ?';
    params.push(campaign_id);
  }

  const countResult = await c.env.DB.prepare(
    sql.replace('SELECT *', 'SELECT COUNT(*) as count')
  )
    .bind(...params)
    .first<{ count: number }>();

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Number(per_page), offset);

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({
    data: result.results,
    pagination: {
      page: Number(page),
      per_page: Number(per_page),
      total: countResult?.count || 0,
      total_pages: Math.ceil((countResult?.count || 0) / Number(per_page)),
    },
  });
});

admin.post('/landers', requirePermission('write'), async (c) => {
  const body = await c.req.json();
  const data = landerSchema.parse(body);

  const id = `ld_${generateId()}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO landers (id, name, campaign_id, url, weight, status, tracking_params, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  )
    .bind(
      id, data.name, data.campaign_id, data.url, data.weight,
      data.tracking_params ? JSON.stringify(data.tracking_params) : null,
      now, now
    )
    .run();

  const lander = await c.env.DB.prepare(
    'SELECT * FROM landers WHERE id = ?'
  )
    .bind(id)
    .first();

  return c.json(lander, 201);
});

// ============================================
// 用户管理
// ============================================

admin.get('/users', requirePermission('admin'), async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT id, email, name, role, status, created_at, last_login_at FROM users ORDER BY created_at DESC'
  ).all();

  return c.json({ data: result.results });
});

admin.post('/users', requirePermission('admin'), async (c) => {
  const body = await c.req.json();
  const { email, password, name, role } = body;

  if (!email || !password) {
    throw Errors.BadRequest('Email and password are required');
  }

  const id = `usr_${generateId()}`;
  const passwordHash = await hashString(password);
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO users (id, email, password_hash, name, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
  )
    .bind(id, email, passwordHash, name, role || 'user', now, now)
    .run();

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, role, status, created_at FROM users WHERE id = ?'
  )
    .bind(id)
    .first();

  return c.json(user, 201);
});

// ============================================
// API Key 管理
// ============================================

admin.post('/users/:id/api-key', requirePermission('admin'), async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json();
  const { name, permissions, expires_at } = body;

  // 生成 API Key
  const rawKey = generateApiKey();
  const keyHash = await hashString(rawKey);
  const id = `key_${generateId()}`;

  await c.env.DB.prepare(
    `INSERT INTO api_keys (id, user_id, key_hash, name, permissions, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  )
    .bind(
      id, userId, keyHash, name || 'API Key',
      JSON.stringify(permissions || ['read']),
      expires_at || null
    )
    .run();

  return c.json({
    id,
    key: rawKey, // 只返回一次
    name: name || 'API Key',
    permissions: permissions || ['read'],
    message: 'Please save this key securely. It will not be shown again.',
  }, 201);
});

export { admin as adminRoutes };
