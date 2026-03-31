// src/services/precompute.service.ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import type { Env, ReportQuery, ReportData, DateRange } from '../types';
import { MultiTierCacheManager } from '../cache/multi-tier-cache';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, subYears } from 'date-fns';

type Granularity = 'hour' | 'day' | 'week' | 'month';

export class PrecomputeService {
  private db: ReturnType<typeof drizzle>;
  private cache: MultiTierCacheManager;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.db = drizzle(env.DB, { schema });
    this.cache = new MultiTierCacheManager(env);
  }

  /**
   * 每小时预计算任务 (Cron Trigger)
   * 聚合上一小时的数据
   */
  async precomputeHourlyStats(): Promise<void> {
    const now = new Date();
    const hourStart = new Date(now.setMinutes(0, 0, 0));
    const hourEnd = new Date(hourStart.getTime() + 3600000);
    const prevHourStart = new Date(hourStart.getTime() - 3600000);

    console.log(`[Precompute] Starting hourly stats for ${prevHourStart.toISOString()}`);

    try {
      // 聚合上一小时的数据
      await this.db.run(`
        INSERT INTO hourly_stats (hour, campaign_id, clicks, unique_clicks, conversions, revenue, cost, created_at)
        SELECT 
          datetime(c.created_at, 'start of hour') as hour,
          c.campaign_id,
          COUNT(*) as clicks,
          COUNT(DISTINCT c.ip) as unique_clicks,
          COUNT(DISTINCT cv.click_id) as conversions,
          COALESCE(SUM(cv.revenue), 0) as revenue,
          COALESCE(SUM(cv.cost), 0) as cost,
          datetime('now')
        FROM clicks c
        LEFT JOIN conversions cv ON c.click_id = cv.click_id
        WHERE c.created_at >= ? AND c.created_at < ?
        GROUP BY hour, c.campaign_id
        ON CONFLICT(hour, campaign_id) DO UPDATE SET
          clicks = excluded.clicks,
          unique_clicks = excluded.unique_clicks,
          conversions = excluded.conversions,
          revenue = excluded.revenue,
          cost = excluded.cost,
          updated_at = datetime('now')
      `, [prevHourStart.toISOString(), hourStart.toISOString()]);

      // 失效相关缓存
      await this.invalidateHourlyCache(prevHourStart);

      console.log(`[Precompute] Hourly stats completed for ${prevHourStart.toISOString()}`);
    } catch (error) {
      console.error('[Precompute] Hourly stats failed:', error);
      throw error;
    }
  }

  /**
   * 每日预计算任务 (Cron Trigger)
   * 从小时统计聚合日统计
   */
  async precomputeDailyStats(): Promise<void> {
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = subDays(today, 1);

    console.log(`[Precompute] Starting daily stats for ${yesterday.toISOString()}`);

    try {
      // 从小时统计聚合日统计
      await this.db.run(`
        INSERT INTO daily_stats (date, campaign_id, clicks, unique_clicks, conversions, revenue, cost, created_at)
        SELECT 
          DATE(hour) as date,
          campaign_id,
          SUM(clicks) as clicks,
          SUM(unique_clicks) as unique_clicks,
          SUM(conversions) as conversions,
          SUM(revenue) as revenue,
          SUM(cost) as cost,
          datetime('now')
        FROM hourly_stats
        WHERE hour >= ? AND hour < ?
        GROUP BY date, campaign_id
        ON CONFLICT(date, campaign_id) DO UPDATE SET
          clicks = excluded.clicks,
          unique_clicks = excluded.unique_clicks,
          conversions = excluded.conversions,
          revenue = excluded.revenue,
          cost = excluded.cost,
          updated_at = datetime('now')
      `, [startOfDay(yesterday).toISOString(), startOfDay(today).toISOString()]);

      // 失效相关缓存
      await this.invalidateDailyCache(yesterday);

      console.log(`[Precompute] Daily stats completed for ${yesterday.toISOString()}`);
    } catch (error) {
      console.error('[Precompute] Daily stats failed:', error);
      throw error;
    }
  }

  /**
   * 每月预计算任务 (Cron Trigger)
   */
  async precomputeMonthlyStats(): Promise<void> {
    const now = new Date();
    const thisMonth = startOfMonth(now);
    const lastMonth = subMonths(thisMonth, 1);

    console.log(`[Precompute] Starting monthly stats for ${lastMonth.toISOString()}`);

    try {
      // 从日统计聚合月统计
      await this.db.run(`
        INSERT INTO monthly_stats (month, campaign_id, clicks, unique_clicks, conversions, revenue, cost, created_at)
        SELECT 
          strftime('%Y-%m-01', date) as month,
          campaign_id,
          SUM(clicks) as clicks,
          SUM(unique_clicks) as unique_clicks,
          SUM(conversions) as conversions,
          SUM(revenue) as revenue,
          SUM(cost) as cost,
          datetime('now')
        FROM daily_stats
        WHERE date >= ? AND date < ?
        GROUP BY month, campaign_id
        ON CONFLICT(month, campaign_id) DO UPDATE SET
          clicks = excluded.clicks,
          unique_clicks = excluded.unique_clicks,
          conversions = excluded.conversions,
          revenue = excluded.revenue,
          cost = excluded.cost,
          updated_at = datetime('now')
      `, [startOfMonth(lastMonth).toISOString(), startOfMonth(thisMonth).toISOString()]);

      // 失效相关缓存
      await this.invalidateMonthlyCache(lastMonth);

      console.log(`[Precompute] Monthly stats completed for ${lastMonth.toISOString()}`);
    } catch (error) {
      console.error('[Precompute] Monthly stats failed:', error);
      throw error;
    }
  }

  /**
   * 智能查询路由 - 自动选择预计算表或实时查询
   */
  async getStats(params: ReportQuery): Promise<ReportData[]> {
    const { from, to, granularity } = params;
    const duration = to.getTime() - from.getTime();
    const days = duration / 86400000;

    // 根据时间跨度和粒度选择数据源
    if (granularity === 'hour' && days <= 7) {
      return this.getHourlyStats(params);
    } else if (granularity === 'day' && days <= 90) {
      return this.getDailyStats(params);
    } else if (granularity === 'month' || days > 90) {
      return this.getMonthlyStats(params);
    } else {
      return this.getRealtimeStats(params);
    }
  }

  /**
   * 查询小时统计表
   */
  private async getHourlyStats(params: ReportQuery): Promise<ReportData[]> {
    const cacheKey = `report:hourly:${JSON.stringify(params)}`;
    
    return this.cache.getOrSet(
      cacheKey,
      'hourlyReport',
      async () => {
        const { from, to, campaignId } = params;
        
        let query = `
          SELECT 
            hour as date,
            SUM(clicks) as clicks,
            SUM(unique_clicks) as unique_clicks,
            SUM(conversions) as conversions,
            SUM(revenue) as revenue,
            SUM(cost) as cost
          FROM hourly_stats
          WHERE hour >= ? AND hour <= ?
        `;
        
        const bindings: any[] = [from.toISOString(), to.toISOString()];
        
        if (campaignId) {
          query += ' AND campaign_id = ?';
          bindings.push(campaignId);
        }
        
        query += ' GROUP BY hour ORDER BY hour DESC';
        
        const result = await this.db.run(query, bindings);
        return this.formatReportData(result.results as any[]);
      },
      { ttl: 3600 }
    );
  }

  /**
   * 查询日统计表
   */
  private async getDailyStats(params: ReportQuery): Promise<ReportData[]> {
    const cacheKey = `report:daily:${JSON.stringify(params)}`;
    
    return this.cache.getOrSet(
      cacheKey,
      'dailyReport',
      async () => {
        const { from, to, campaignId } = params;
        
        let query = `
          SELECT 
            date,
            SUM(clicks) as clicks,
            SUM(unique_clicks) as unique_clicks,
            SUM(conversions) as conversions,
            SUM(revenue) as revenue,
            SUM(cost) as cost
          FROM daily_stats
          WHERE date >= ? AND date <= ?
        `;
        
        const bindings: any[] = [from.toISOString(), to.toISOString()];
        
        if (campaignId) {
          query += ' AND campaign_id = ?';
          bindings.push(campaignId);
        }
        
        query += ' GROUP BY date ORDER BY date DESC';
        
        const result = await this.db.run(query, bindings);
        return this.formatReportData(result.results as any[]);
      },
      { ttl: 86400 }
    );
  }

  /**
   * 查询月统计表
   */
  private async getMonthlyStats(params: ReportQuery): Promise<ReportData[]> {
    const cacheKey = `report:monthly:${JSON.stringify(params)}`;
    
    return this.cache.getOrSet(
      cacheKey,
      'monthlyReport',
      async () => {
        const { from, to, campaignId } = params;
        
        let query = `
          SELECT 
            month as date,
            SUM(clicks) as clicks,
            SUM(unique_clicks) as unique_clicks,
            SUM(conversions) as conversions,
            SUM(revenue) as revenue,
            SUM(cost) as cost
          FROM monthly_stats
          WHERE month >= ? AND month <= ?
        `;
        
        const bindings: any[] = [from.toISOString(), to.toISOString()];
        
        if (campaignId) {
          query += ' AND campaign_id = ?';
          bindings.push(campaignId);
        }
        
        query += ' GROUP BY month ORDER BY month DESC';
        
        const result = await this.db.run(query, bindings);
        return this.formatReportData(result.results as any[]);
      },
      { ttl: 604800 }
    );
  }

  /**
   * 实时查询（用于小时间范围或最新数据）
   */
  private async getRealtimeStats(params: ReportQuery): Promise<ReportData[]> {
    const { from, to, campaignId, granularity } = params;
    
    let query = `
      SELECT 
        datetime(c.created_at, '${granularity === 'hour' ? 'start of hour' : 'start of day'}') as date,
        COUNT(*) as clicks,
        COUNT(DISTINCT c.ip) as unique_clicks,
        COUNT(DISTINCT cv.click_id) as conversions,
        COALESCE(SUM(cv.revenue), 0) as revenue,
        COALESCE(SUM(cv.cost), 0) as cost
      FROM clicks c
      LEFT JOIN conversions cv ON c.click_id = cv.click_id
      WHERE c.created_at >= ? AND c.created_at <= ?
    `;
    
    const bindings: any[] = [from.toISOString(), to.toISOString()];
    
    if (campaignId) {
      query += ' AND c.campaign_id = ?';
      bindings.push(campaignId);
    }
    
    query += ' GROUP BY date ORDER BY date DESC';
    
    const result = await this.db.run(query, bindings);
    return this.formatReportData(result.results as any[]);
  }

  /**
   * 格式化报表数据
   */
  private formatReportData(rows: any[]): ReportData[] {
    return rows.map(row => ({
      date: row.date,
      clicks: row.clicks || 0,
      uniqueClicks: row.unique_clicks || 0,
      conversions: row.conversions || 0,
      revenue: row.revenue || 0,
      cost: row.cost || 0,
      profit: (row.revenue || 0) - (row.cost || 0),
      roi: row.cost > 0 ? ((row.revenue - row.cost) / row.cost) * 100 : 0,
      ctr: row.clicks > 0 ? (row.conversions / row.clicks) * 100 : 0,
      epc: row.clicks > 0 ? row.revenue / row.clicks : 0,
    }));
  }

  /**
   * 失效小时缓存
   */
  private async invalidateHourlyCache(hour: Date): Promise<void> {
    const pattern = `report:hourly:*${hour.toISOString().slice(0, 13)}*`;
    await this.cache.invalidatePattern(pattern, 'hourlyReport');
  }

  /**
   * 失效日缓存
   */
  private async invalidateDailyCache(date: Date): Promise<void> {
    const pattern = `report:daily:*${date.toISOString().slice(0, 10)}*`;
    await this.cache.invalidatePattern(pattern, 'dailyReport');
  }

  /**
   * 失效月缓存
   */
  private async invalidateMonthlyCache(date: Date): Promise<void> {
    const pattern = `report:monthly:*${date.toISOString().slice(0, 7)}*`;
    await this.cache.invalidatePattern(pattern, 'monthlyReport');
  }
}
