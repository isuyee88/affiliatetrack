/**
 * Logs API 路由
 * 点击日志和转化日志
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { getDateDaysAgo } from '../utils';

const logs = new Hono<{ Bindings: Env }>();

// 应用认证中间件
logs.use('/*', authMiddleware);

// ============================================
// 点击日志 Schema
// ============================================

const clicksLogQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  campaign_id: z.string().optional(),
  offer_id: z.string().optional(),
  landing_id: z.string().optional(),
  flow_id: z.string().optional(),
  country: z.string().optional(),
  device_type: z.string().optional(),
  is_bot: z.coerce.boolean().optional(),
  is_proxy: z.coerce.boolean().optional(),
  ip: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(200).default(50),
  sort_by: z.string().default('clicked_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================
// 点击日志列表
// ============================================

logs.get('/clicks', requirePermission('read'), async (c) => {
  const query = clicksLogQuerySchema.parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || new Date().toISOString().substring(0, 10),
  });

  const { page, per_page, sort_by, sort_order, ...filters } = query;
  const offset = (page - 1) * per_page;

  let sql = `
    SELECT 
      cl.*,
      c.name as campaign_name,
      o.name as offer_name,
      l.name as landing_name
    FROM clicks cl
    LEFT JOIN campaigns c ON cl.campaign_id = c.id
    LEFT JOIN offers o ON cl.offer_id = o.id
    LEFT JOIN landings l ON cl.landing_id = l.id
    WHERE cl.date_partition BETWEEN ? AND ?
  `;
  const params: any[] = [query.start_date, query.end_date];

  // 添加过滤条件
  if (filters.campaign_id) {
    sql += ' AND cl.campaign_id = ?';
    params.push(filters.campaign_id);
  }
  if (filters.offer_id) {
    sql += ' AND cl.offer_id = ?';
    params.push(filters.offer_id);
  }
  if (filters.landing_id) {
    sql += ' AND cl.landing_id = ?';
    params.push(filters.landing_id);
  }
  if (filters.flow_id) {
    sql += ' AND cl.flow_id = ?';
    params.push(filters.flow_id);
  }
  if (filters.country) {
    sql += ' AND cl.country = ?';
    params.push(filters.country);
  }
  if (filters.device_type) {
    sql += ' AND cl.device_type = ?';
    params.push(filters.device_type);
  }
  if (filters.is_bot !== undefined) {
    sql += ' AND cl.is_bot = ?';
    params.push(filters.is_bot ? 1 : 0);
  }
  if (filters.is_proxy !== undefined) {
    sql += ' AND cl.is_proxy = ?';
    params.push(filters.is_proxy ? 1 : 0);
  }
  if (filters.ip) {
    sql += ' AND cl.ip LIKE ?';
    params.push(`%${filters.ip}%`);
  }

  // 获取总数
  const countSql = sql.replace(
    /SELECT[\s\S]*?FROM/,
    'SELECT COUNT(*) as count FROM'
  ).replace(/ORDER BY[\s\S]*$/, '');
  
  const countResult = await c.env.DB.prepare(countSql).bind(...params).first<{ count: number }>();

  // 排序和分页
  const validSortColumns = ['clicked_at', 'created_at', 'cost', 'country', 'device_type', 'os', 'browser'];
  const safeSortBy = validSortColumns.includes(sort_by) ? sort_by : 'clicked_at';
  const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  sql += ` ORDER BY cl.${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
  params.push(per_page, offset);

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  return c.json({
    data: result.results,
    pagination: {
      page,
      per_page,
      total: countResult?.count || 0,
      total_pages: Math.ceil((countResult?.count || 0) / per_page),
    },
  });
});

// ============================================
// 点击详情
// ============================================

logs.get('/clicks/:id', requirePermission('read'), async (c) => {
  const id = c.req.param('id');

  const click = await c.env.DB.prepare(
    `SELECT cl.*,
      c.name as campaign_name,
      o.name as offer_name,
      l.name as landing_name,
      f.name as flow_name
    FROM clicks cl
    LEFT JOIN campaigns c ON cl.campaign_id = c.id
    LEFT JOIN offers o ON cl.offer_id = o.id
    LEFT JOIN landings l ON cl.landing_id = l.id
    LEFT JOIN flows f ON cl.flow_id = f.id
    WHERE cl.id = ? OR cl.click_id = ?`
  ).bind(id, id).first();

  if (!click) {
    return c.json({ error: 'Click not found' }, 404);
  }

  // 获取关联的转化
  const conversions = await c.env.DB.prepare(
    `SELECT cv.*, o.name as offer_name
    FROM conversions cv
    LEFT JOIN offers o ON cv.offer_id = o.id
    WHERE cv.click_id = ?
    ORDER BY cv.converted_at DESC`
  ).bind(click.click_id).all();

  return c.json({
    click,
    conversions: conversions.results,
  });
});

// ============================================
// 转化日志 Schema
// ============================================

const conversionsLogQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  campaign_id: z.string().optional(),
  offer_id: z.string().optional(),
  status: z.enum(['approved', 'pending', 'rejected', 'duplicate']).optional(),
  conversion_type: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(200).default(50),
  sort_by: z.string().default('converted_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================
// 转化日志列表
// ============================================

logs.get('/conversions', requirePermission('read'), async (c) => {
  const query = conversionsLogQuerySchema.parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || new Date().toISOString().substring(0, 10),
  });

  const { page, per_page, sort_by, sort_order, ...filters } = query;
  const offset = (page - 1) * per_page;

  let sql = `
    SELECT 
      cv.*,
      c.name as campaign_name,
      o.name as offer_name,
      l.name as landing_name
    FROM conversions cv
    LEFT JOIN campaigns c ON cv.campaign_id = c.id
    LEFT JOIN offers o ON cv.offer_id = o.id
    LEFT JOIN landings l ON cv.landing_id = l.id
    WHERE cv.date_partition BETWEEN ? AND ?
  `;
  const params: any[] = [query.start_date, query.end_date];

  if (filters.campaign_id) {
    sql += ' AND cv.campaign_id = ?';
    params.push(filters.campaign_id);
  }
  if (filters.offer_id) {
    sql += ' AND cv.offer_id = ?';
    params.push(filters.offer_id);
  }
  if (filters.status) {
    sql += ' AND cv.status = ?';
    params.push(filters.status);
  }
  if (filters.conversion_type) {
    sql += ' AND cv.conversion_type = ?';
    params.push(filters.conversion_type);
  }

  // 获取总数
  const countSql = sql.replace(
    /SELECT[\s\S]*?FROM/,
    'SELECT COUNT(*) as count FROM'
  ).replace(/ORDER BY[\s\S]*$/, '');
  
  const countResult = await c.env.DB.prepare(countSql).bind(...params).first<{ count: number }>();

  // 排序和分页
  const validSortColumns = ['converted_at', 'created_at', 'revenue', 'cost', 'profit', 'status'];
  const safeSortBy = validSortColumns.includes(sort_by) ? sort_by : 'converted_at';
  const safeSortOrder = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  
  sql += ` ORDER BY cv.${safeSortBy} ${safeSortOrder} LIMIT ? OFFSET ?`;
  params.push(per_page, offset);

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  // 计算汇总
  const summarySql = `
    SELECT 
      COUNT(*) as total_conversions,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
      SUM(revenue) as total_revenue,
      SUM(cost) as total_cost,
      SUM(profit) as total_profit
    FROM conversions
    WHERE date_partition BETWEEN ? AND ?
    ${filters.campaign_id ? ' AND campaign_id = ?' : ''}
    ${filters.offer_id ? ' AND offer_id = ?' : ''}
  `;
  const summaryParams = [query.start_date, query.end_date];
  if (filters.campaign_id) summaryParams.push(filters.campaign_id);
  if (filters.offer_id) summaryParams.push(filters.offer_id);
  
  const summary = await c.env.DB.prepare(summarySql).bind(...summaryParams).first();

  return c.json({
    data: result.results,
    summary: {
      total_conversions: summary?.total_conversions || 0,
      approved_count: summary?.approved_count || 0,
      pending_count: summary?.pending_count || 0,
      rejected_count: summary?.rejected_count || 0,
      total_revenue: summary?.total_revenue || 0,
      total_cost: summary?.total_cost || 0,
      total_profit: summary?.total_profit || 0,
    },
    pagination: {
      page,
      per_page,
      total: countResult?.count || 0,
      total_pages: Math.ceil((countResult?.count || 0) / per_page),
    },
  });
});

// ============================================
// 转化详情
// ============================================

logs.get('/conversions/:id', requirePermission('read'), async (c) => {
  const id = c.req.param('id');

  const conversion = await c.env.DB.prepare(
    `SELECT cv.*,
      c.name as campaign_name,
      o.name as offer_name
    FROM conversions cv
    LEFT JOIN campaigns c ON cv.campaign_id = c.id
    LEFT JOIN offers o ON cv.offer_id = o.id
    WHERE cv.id = ? OR cv.conversion_id = ?`
  ).bind(id, id).first();

  if (!conversion) {
    return c.json({ error: 'Conversion not found' }, 404);
  }

  // 获取关联的点击
  const click = await c.env.DB.prepare(
    'SELECT * FROM clicks WHERE click_id = ?'
  ).bind(conversion.click_id).first();

  return c.json({
    conversion,
    click,
  });
});

// ============================================
// 导出点击日志
// ============================================

logs.get('/clicks/export', requirePermission('read'), async (c) => {
  const query = clicksLogQuerySchema.parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || new Date().toISOString().substring(0, 10),
    per_page: 10000, // 限制导出数量
  });

  // 简化查询
  const result = await c.env.DB.prepare(
    `SELECT click_id, campaign_id, offer_id, ip, country, device_type, os, browser, 
            referrer, sub1, sub2, sub3, cost, is_bot, is_proxy, clicked_at
     FROM clicks 
     WHERE date_partition BETWEEN ? AND ?
     ORDER BY clicked_at DESC
     LIMIT 10000`
  ).bind(query.start_date, query.end_date).all();

  // 生成 CSV
  const headers = [
    'Click ID', 'Campaign ID', 'Offer ID', 'IP', 'Country', 'Device Type',
    'OS', 'Browser', 'Referrer', 'Sub1', 'Sub2', 'Sub3', 'Cost',
    'Is Bot', 'Is Proxy', 'Clicked At'
  ];
  const csvRows = [headers.join(',')];

  result.results.forEach((row: any) => {
    csvRows.push([
      row.click_id || '',
      row.campaign_id || '',
      row.offer_id || '',
      row.ip || '',
      row.country || '',
      row.device_type || '',
      `"${(row.os || '').replace(/"/g, '""')}"`,
      `"${(row.browser || '').replace(/"/g, '""')}"`,
      `"${(row.referrer || '').replace(/"/g, '""')}"`,
      row.sub1 || '',
      row.sub2 || '',
      row.sub3 || '',
      row.cost || 0,
      row.is_bot ? 'Yes' : 'No',
      row.is_proxy ? 'Yes' : 'No',
      row.clicked_at || '',
    ].join(','));
  });

  return new Response(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="clicks_${query.start_date}_${query.end_date}.csv"`,
    },
  });
});

export { logs as logsRoutes };
