/**
 * 报表 API 路由
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, ReportQuery, ReportResponse, ReportRow, ReportSummary } from '../types';
import { authMiddleware } from '../middleware/auth';
import { Errors } from '../middleware/error-handler';
import { getToday, getDateDaysAgo } from '../utils';

const report = new Hono<{ Bindings: Env }>();

// 应用认证中间件
report.use('/*', authMiddleware);

// ============================================
// 报表查询 Schema
// ============================================

const reportQuerySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  campaign_ids: z.string().optional(),
  offer_ids: z.string().optional(),
  country: z.string().optional(),
  device_type: z.string().optional(),
  group_by: z.enum(['date', 'campaign', 'offer', 'country', 'device']).optional(),
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().positive().max(100).default(50),
});

// ============================================
// 总览报表
// ============================================

report.get('/overview', async (c) => {
  const query = reportQuerySchema.partial({ page: true, per_page: true }).parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || getToday(),
  });

  // 从 daily_stats 聚合数据
  const stats = await c.env.DB.prepare(
    `SELECT 
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(unique_clicks) as total_unique_clicks,
      SUM(conversions) as total_conversions,
      SUM(approved_conversions) as total_approved_conversions,
      SUM(pending_conversions) as total_pending_conversions,
      SUM(rejected_conversions) as total_rejected_conversions,
      SUM(revenue) as total_revenue,
      SUM(cost) as total_cost,
      SUM(profit) as total_profit
    FROM daily_stats 
    WHERE stat_date BETWEEN ? AND ?`
  )
    .bind(query.start_date, query.end_date)
    .first();

  const total_impressions = Number(stats?.total_impressions) || 0;
  const total_clicks = Number(stats?.total_clicks) || 0;
  const total_conversions = Number(stats?.total_conversions) || 0;
  const total_revenue = Number(stats?.total_revenue) || 0;
  const total_cost = Number(stats?.total_cost) || 0;
  const total_profit = Number(stats?.total_profit) || 0;

  const summary: ReportSummary = {
    total_impressions,
    total_clicks,
    total_unique_clicks: (stats?.total_unique_clicks as number) || 0,
    total_conversions,
    total_approved_conversions: (stats?.total_approved_conversions as number) || 0,
    total_pending_conversions: (stats?.total_pending_conversions as number) || 0,
    total_rejected_conversions: (stats?.total_rejected_conversions as number) || 0,
    total_revenue,
    total_cost,
    total_profit,
    overall_ctr: total_impressions > 0 ? (total_clicks / total_impressions) * 100 : 0,
    overall_cvr: total_clicks > 0 ? (total_conversions / total_clicks) * 100 : 0,
    overall_epc: total_clicks > 0 ? total_revenue / total_clicks : 0,
    overall_cpc: total_clicks > 0 ? total_cost / total_clicks : 0,
    overall_roi: total_cost > 0 ? (total_profit / total_cost) * 100 : 0,
  };

  return c.json({ summary });
});

// ============================================
// 按活动报表
// ============================================

report.get('/by-campaign', async (c) => {
  const query = reportQuerySchema.parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || getToday(),
  });

  let sql = `
    SELECT 
      ds.campaign_id,
      c.name as campaign_name,
      SUM(ds.impressions) as impressions,
      SUM(ds.clicks) as clicks,
      SUM(ds.unique_clicks) as unique_clicks,
      SUM(ds.conversions) as conversions,
      SUM(ds.approved_conversions) as approved_conversions,
      SUM(ds.pending_conversions) as pending_conversions,
      SUM(ds.rejected_conversions) as rejected_conversions,
      SUM(ds.revenue) as revenue,
      SUM(ds.cost) as cost,
      SUM(ds.profit) as profit
    FROM daily_stats ds
    LEFT JOIN campaigns c ON ds.campaign_id = c.id
    WHERE ds.stat_date BETWEEN ? AND ?
  `;

  const params: any[] = [query.start_date, query.end_date];

  if (query.campaign_ids) {
    sql += ` AND ds.campaign_id IN (${query.campaign_ids.split(',').map(() => '?').join(',')})`;
    params.push(...query.campaign_ids.split(','));
  }

  sql += ' GROUP BY ds.campaign_id ORDER BY revenue DESC';

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  const data: ReportRow[] = result.results.map((row: any) => ({
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    unique_clicks: row.unique_clicks || 0,
    conversions: row.conversions || 0,
    approved_conversions: row.approved_conversions || 0,
    pending_conversions: row.pending_conversions || 0,
    rejected_conversions: row.rejected_conversions || 0,
    revenue: row.revenue || 0,
    cost: row.cost || 0,
    profit: row.profit || 0,
    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    cvr: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
    epc: row.clicks > 0 ? row.revenue / row.clicks : 0,
    cpc: row.clicks > 0 ? row.cost / row.clicks : 0,
    roi: row.cost > 0 ? (row.profit / row.cost) * 100 : 0,
  }));

  // 计算汇总
  const summary = calculateSummary(data);

  return c.json({ data, summary });
});

// ============================================
// 按 Offer 报表
// ============================================

report.get('/by-offer', async (c) => {
  const query = reportQuerySchema.parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || getToday(),
  });

  let sql = `
    SELECT 
      ds.offer_id,
      o.name as offer_name,
      ds.campaign_id,
      c.name as campaign_name,
      SUM(ds.impressions) as impressions,
      SUM(ds.clicks) as clicks,
      SUM(ds.unique_clicks) as unique_clicks,
      SUM(ds.conversions) as conversions,
      SUM(ds.approved_conversions) as approved_conversions,
      SUM(ds.pending_conversions) as pending_conversions,
      SUM(ds.rejected_conversions) as rejected_conversions,
      SUM(ds.revenue) as revenue,
      SUM(ds.cost) as cost,
      SUM(ds.profit) as profit
    FROM daily_stats ds
    LEFT JOIN offers o ON ds.offer_id = o.id
    LEFT JOIN campaigns c ON ds.campaign_id = c.id
    WHERE ds.stat_date BETWEEN ? AND ?
  `;

  const params: any[] = [query.start_date, query.end_date];

  if (query.offer_ids) {
    sql += ` AND ds.offer_id IN (${query.offer_ids.split(',').map(() => '?').join(',')})`;
    params.push(...query.offer_ids.split(','));
  }

  sql += ' GROUP BY ds.offer_id ORDER BY revenue DESC';

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  const data: ReportRow[] = result.results.map((row: any) => ({
    offer_id: row.offer_id,
    offer_name: row.offer_name,
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    unique_clicks: row.unique_clicks || 0,
    conversions: row.conversions || 0,
    approved_conversions: row.approved_conversions || 0,
    pending_conversions: row.pending_conversions || 0,
    rejected_conversions: row.rejected_conversions || 0,
    revenue: row.revenue || 0,
    cost: row.cost || 0,
    profit: row.profit || 0,
    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    cvr: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
    epc: row.clicks > 0 ? row.revenue / row.clicks : 0,
    cpc: row.clicks > 0 ? row.cost / row.clicks : 0,
    roi: row.cost > 0 ? (row.profit / row.cost) * 100 : 0,
  }));

  const summary = calculateSummary(data);

  return c.json({ data, summary });
});

// ============================================
// 按日期报表
// ============================================

report.get('/by-date', async (c) => {
  const query = reportQuerySchema.parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || getToday(),
  });

  const sql = `
    SELECT 
      stat_date as date,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(unique_clicks) as unique_clicks,
      SUM(conversions) as conversions,
      SUM(approved_conversions) as approved_conversions,
      SUM(pending_conversions) as pending_conversions,
      SUM(rejected_conversions) as rejected_conversions,
      SUM(revenue) as revenue,
      SUM(cost) as cost,
      SUM(profit) as profit
    FROM daily_stats 
    WHERE stat_date BETWEEN ? AND ?
    GROUP BY stat_date
    ORDER BY stat_date ASC
  `;

  const result = await c.env.DB.prepare(sql)
    .bind(query.start_date, query.end_date)
    .all();

  const data: ReportRow[] = result.results.map((row: any) => ({
    date: row.date,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    unique_clicks: row.unique_clicks || 0,
    conversions: row.conversions || 0,
    approved_conversions: row.approved_conversions || 0,
    pending_conversions: row.pending_conversions || 0,
    rejected_conversions: row.rejected_conversions || 0,
    revenue: row.revenue || 0,
    cost: row.cost || 0,
    profit: row.profit || 0,
    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    cvr: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
    epc: row.clicks > 0 ? row.revenue / row.clicks : 0,
    cpc: row.clicks > 0 ? row.cost / row.clicks : 0,
    roi: row.cost > 0 ? (row.profit / row.cost) * 100 : 0,
  }));

  const summary = calculateSummary(data);

  return c.json({ data, summary });
});

// ============================================
// 按国家报表
// ============================================

report.get('/by-country', async (c) => {
  const query = reportQuerySchema.parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || getToday(),
  });

  let sql = `
    SELECT 
      country,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(unique_clicks) as unique_clicks,
      SUM(conversions) as conversions,
      SUM(approved_conversions) as approved_conversions,
      SUM(pending_conversions) as pending_conversions,
      SUM(rejected_conversions) as rejected_conversions,
      SUM(revenue) as revenue,
      SUM(cost) as cost,
      SUM(profit) as profit
    FROM daily_stats 
    WHERE stat_date BETWEEN ? AND ?
      AND country IS NOT NULL
  `;

  const params: any[] = [query.start_date, query.end_date];

  if (query.country) {
    sql += ' AND country = ?';
    params.push(query.country);
  }

  sql += ' GROUP BY country ORDER BY revenue DESC';

  const result = await c.env.DB.prepare(sql).bind(...params).all();

  const data: ReportRow[] = result.results.map((row: any) => ({
    country: row.country,
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    unique_clicks: row.unique_clicks || 0,
    conversions: row.conversions || 0,
    approved_conversions: row.approved_conversions || 0,
    pending_conversions: row.pending_conversions || 0,
    rejected_conversions: row.rejected_conversions || 0,
    revenue: row.revenue || 0,
    cost: row.cost || 0,
    profit: row.profit || 0,
    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    cvr: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
    epc: row.clicks > 0 ? row.revenue / row.clicks : 0,
    cpc: row.clicks > 0 ? row.cost / row.clicks : 0,
    roi: row.cost > 0 ? (row.profit / row.cost) * 100 : 0,
  }));

  const summary = calculateSummary(data);

  return c.json({ data, summary });
});

// ============================================
// 实时报表 (从 Durable Objects 获取)
// ============================================

report.get('/realtime', async (c) => {
  const campaignId = c.req.query('campaign_id');
  const datePartition = new Date().toISOString().substring(0, 10);

  if (!campaignId) {
    throw Errors.BadRequest('campaign_id is required');
  }

  // 获取 Stats Aggregator DO
  const statsId = c.env.STATS_AGGREGATOR.idFromName(`${campaignId}:${datePartition}`);
  const statsAggregator = c.env.STATS_AGGREGATOR.get(statsId);

  const response = await statsAggregator.fetch(
    new Request('http://internal/stats/realtime')
  );

  const realtimeStats = await response.json();

  return c.json(realtimeStats);
});

// ============================================
// 导出报表
// ============================================

report.get('/export', async (c) => {
  const query = reportQuerySchema.parse({
    ...c.req.query(),
    start_date: c.req.query('start_date') || getDateDaysAgo(7),
    end_date: c.req.query('end_date') || getToday(),
  });

  // 获取完整数据
  const sql = `
    SELECT 
      ds.stat_date as date,
      c.name as campaign_name,
      o.name as offer_name,
      ds.country,
      ds.device_type,
      ds.impressions,
      ds.clicks,
      ds.conversions,
      ds.revenue,
      ds.cost,
      ds.profit
    FROM daily_stats ds
    LEFT JOIN campaigns c ON ds.campaign_id = c.id
    LEFT JOIN offers o ON ds.offer_id = o.id
    WHERE ds.stat_date BETWEEN ? AND ?
    ORDER BY ds.stat_date DESC
  `;

  const result = await c.env.DB.prepare(sql)
    .bind(query.start_date, query.end_date)
    .all();

  // 生成 CSV
  const headers = ['Date', 'Campaign', 'Offer', 'Country', 'Device', 'Impressions', 'Clicks', 'Conversions', 'Revenue', 'Cost', 'Profit'];
  const csvRows = [headers.join(',')];

  result.results.forEach((row: any) => {
    csvRows.push([
      row.date || '',
      `"${(row.campaign_name || '').replace(/"/g, '""')}"`,
      `"${(row.offer_name || '').replace(/"/g, '""')}"`,
      row.country || '',
      row.device_type || '',
      row.impressions || 0,
      row.clicks || 0,
      row.conversions || 0,
      row.revenue || 0,
      row.cost || 0,
      row.profit || 0,
    ].join(','));
  });

  const csv = csvRows.join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="report_${query.start_date}_${query.end_date}.csv"`,
    },
  });
});

// ============================================
// 辅助函数
// ============================================

function calculateSummary(data: ReportRow[]): ReportSummary {
  const summary: ReportSummary = {
    total_impressions: 0,
    total_clicks: 0,
    total_unique_clicks: 0,
    total_conversions: 0,
    total_approved_conversions: 0,
    total_pending_conversions: 0,
    total_rejected_conversions: 0,
    total_revenue: 0,
    total_cost: 0,
    total_profit: 0,
    overall_ctr: 0,
    overall_cvr: 0,
    overall_epc: 0,
    overall_cpc: 0,
    overall_roi: 0,
  };

  data.forEach((row) => {
    summary.total_impressions += row.impressions;
    summary.total_clicks += row.clicks;
    summary.total_unique_clicks += row.unique_clicks;
    summary.total_conversions += row.conversions;
    summary.total_approved_conversions += row.approved_conversions;
    summary.total_pending_conversions += row.pending_conversions;
    summary.total_rejected_conversions += row.rejected_conversions;
    summary.total_revenue += row.revenue;
    summary.total_cost += row.cost;
    summary.total_profit += row.profit;
  });

  summary.overall_ctr = summary.total_impressions > 0 
    ? (summary.total_clicks / summary.total_impressions) * 100 : 0;
  summary.overall_cvr = summary.total_clicks > 0 
    ? (summary.total_conversions / summary.total_clicks) * 100 : 0;
  summary.overall_epc = summary.total_clicks > 0 
    ? summary.total_revenue / summary.total_clicks : 0;
  summary.overall_cpc = summary.total_clicks > 0 
    ? summary.total_cost / summary.total_clicks : 0;
  summary.overall_roi = summary.total_cost > 0 
    ? (summary.total_profit / summary.total_cost) * 100 : 0;

  return summary;
}

export { report as reportRoutes };
