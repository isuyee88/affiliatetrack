/**
 * Settings API 路由
 * 系统设置、Bot Lists、Conversion Types 等
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { generateId } from '../utils';

const settings = new Hono<{ Bindings: Env }>();

// 应用认证中间件
settings.use('/*', authMiddleware);

// ============================================
// 系统设置
// ============================================

// 获取所有设置
settings.get('/main', requirePermission('read'), async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM settings ORDER BY key'
  ).all();

  const settingsMap: Record<string, string> = {};
  result.results.forEach((row: any) => {
    settingsMap[row.key] = row.value;
  });

  return c.json({ settings: settingsMap });
});

// 更新设置
settings.put('/main', requirePermission('admin'), async (c) => {
  const body = await c.req.json();
  const data = z.record(z.string()).parse(body);

  for (const [key, value] of Object.entries(data)) {
    await c.env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`
    ).bind(key, value, value).run();
  }

  return c.json({ success: true, message: 'Settings updated' });
});

// ============================================
// Bot Lists
// ============================================

settings.get('/bot-lists', requirePermission('read'), async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM bot_lists ORDER BY name'
  ).all();

  return c.json({
    data: result.results.map((row: any) => ({
      ...row,
      patterns: row.patterns ? JSON.parse(row.patterns) : [],
      is_active: !!row.is_active,
    })),
  });
});

const botListSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['user_agent', 'ip', 'ip_range']),
  patterns: z.array(z.string()),
  is_active: z.boolean().default(true),
});

settings.post('/bot-lists', requirePermission('admin'), async (c) => {
  const body = await c.req.json();
  const data = botListSchema.parse(body);

  const id = `bl_${generateId()}`;

  await c.env.DB.prepare(
    `INSERT INTO bot_lists (id, name, type, patterns, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).bind(
    id, data.name, data.type,
    JSON.stringify(data.patterns),
    data.is_active ? 1 : 0
  ).run();

  const botList = await c.env.DB.prepare(
    'SELECT * FROM bot_lists WHERE id = ?'
  ).bind(id).first();

  return c.json({
    ...botList,
    patterns: botList?.patterns ? JSON.parse(botList.patterns as string) : [],
    is_active: !!botList?.is_active,
  }, 201);
});

settings.put('/bot-lists/:id', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = botListSchema.partial().parse(body);

  const existing = await c.env.DB.prepare(
    'SELECT * FROM bot_lists WHERE id = ?'
  ).bind(id).first();

  if (!existing) {
    throw Errors.NotFound('Bot List');
  }

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === 'patterns') {
        updates.push(`${key} = ?`);
        params.push(JSON.stringify(value));
      } else if (key === 'is_active') {
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
      `UPDATE bot_lists SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();
  }

  const botList = await c.env.DB.prepare(
    'SELECT * FROM bot_lists WHERE id = ?'
  ).bind(id).first();

  return c.json({
    ...botList,
    patterns: botList?.patterns ? JSON.parse(botList.patterns as string) : [],
  });
});

settings.delete('/bot-lists/:id', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM bot_lists WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ============================================
// IP Lists (Black/White lists)
// ============================================

settings.get('/ip-lists', requirePermission('read'), async (c) => {
  const { type } = c.req.query();

  let sql = 'SELECT * FROM ip_lists WHERE 1=1';
  const params: any[] = [];

  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }

  sql += ' ORDER BY created_at DESC';

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({
    data: result.results.map((row: any) => ({
      ...row,
      is_active: !!row.is_active,
    })),
  });
});

const ipListSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['blacklist', 'whitelist']),
  list_type: z.enum(['ip', 'ip_range', 'cidr']),
  value: z.string().min(1),
  notes: z.string().optional(),
  is_active: z.boolean().default(true),
});

settings.post('/ip-lists', requirePermission('admin'), async (c) => {
  const body = await c.req.json();
  const data = ipListSchema.parse(body);

  const id = `ip_${generateId()}`;

  await c.env.DB.prepare(
    `INSERT INTO ip_lists (id, name, type, list_type, value, notes, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    id, data.name, data.type, data.list_type, data.value,
    data.notes || null, data.is_active ? 1 : 0
  ).run();

  const ipList = await c.env.DB.prepare(
    'SELECT * FROM ip_lists WHERE id = ?'
  ).bind(id).first();

  return c.json(ipList, 201);
});

settings.delete('/ip-lists/:id', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM ip_lists WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ============================================
// Conversion Types
// ============================================

settings.get('/conversion-types', requirePermission('read'), async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM conversion_types ORDER BY position'
  ).all();

  return c.json({
    data: result.results.map((row: any) => ({
      ...row,
      is_active: !!row.is_active,
    })),
  });
});

const conversionTypeSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  status_filter: z.enum(['approved', 'pending', 'rejected']).nullable(),
  color: z.string().default('#3b82f6'),
  position: z.number().int().default(0),
  is_active: z.boolean().default(true),
});

settings.post('/conversion-types', requirePermission('admin'), async (c) => {
  const body = await c.req.json();
  const data = conversionTypeSchema.parse(body);

  const id = `ct_${generateId()}`;

  await c.env.DB.prepare(
    `INSERT INTO conversion_types (id, name, label, status_filter, color, position, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    id, data.name, data.label, data.status_filter || null,
    data.color, data.position, data.is_active ? 1 : 0
  ).run();

  const conversionType = await c.env.DB.prepare(
    'SELECT * FROM conversion_types WHERE id = ?'
  ).bind(id).first();

  return c.json(conversionType, 201);
});

settings.put('/conversion-types/:id', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const data = conversionTypeSchema.partial().parse(body);

  const updates: string[] = [];
  const params: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined) {
      if (key === 'is_active') {
        updates.push(`${key} = ?`);
        params.push(value ? 1 : 0);
      } else {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }
  });

  if (updates.length > 0) {
    params.push(id);
    await c.env.DB.prepare(
      `UPDATE conversion_types SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();
  }

  const conversionType = await c.env.DB.prepare(
    'SELECT * FROM conversion_types WHERE id = ?'
  ).bind(id).first();

  return c.json(conversionType);
});

settings.delete('/conversion-types/:id', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM conversion_types WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ============================================
// Custom Metrics
// ============================================

settings.get('/custom-metrics', requirePermission('read'), async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM custom_metrics ORDER BY name'
  ).all();

  return c.json({
    data: result.results.map((row: any) => ({
      ...row,
      is_active: !!row.is_active,
    })),
  });
});

const customMetricSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  formula: z.string().min(1),
  format: z.enum(['number', 'currency', 'percent']).default('number'),
  decimals: z.number().int().min(0).max(10).default(2),
  is_active: z.boolean().default(true),
});

settings.post('/custom-metrics', requirePermission('admin'), async (c) => {
  const body = await c.req.json();
  const data = customMetricSchema.parse(body);

  const id = `cm_${generateId()}`;

  await c.env.DB.prepare(
    `INSERT INTO custom_metrics (id, name, label, formula, format, decimals, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(
    id, data.name, data.label, data.formula,
    data.format, data.decimals, data.is_active ? 1 : 0
  ).run();

  const metric = await c.env.DB.prepare(
    'SELECT * FROM custom_metrics WHERE id = ?'
  ).bind(id).first();

  return c.json(metric, 201);
});

settings.delete('/custom-metrics/:id', requirePermission('admin'), async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM custom_metrics WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

export { settings as settingsRoutes };
