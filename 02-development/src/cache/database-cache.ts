// src/cache/database-cache.ts
import type { CacheInterface, CacheOptions, CacheMetrics } from './types';
import type { D1Database } from '@cloudflare/workers-types';

/**
 * L4: Database Cache
 * 用于缓存查询结果、物化视图、预计算数据
 */
export class DatabaseCache implements CacheInterface {
  private db: D1Database;
  private metrics: CacheMetrics = {
    tier: 'L4',
    hits: 0,
    misses: 0,
    hitRate: 0,
    avgLatency: 0,
    size: 0,
  };

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * 从数据库缓存获取
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const result = await this.db.prepare(`
        SELECT value, expires_at FROM cache_store
        WHERE key = ? AND (expires_at IS NULL OR expires_at > datetime('now'))
      `).bind(key).first();

      if (result) {
        this.recordHit(Date.now() - startTime);
        return JSON.parse(result.value as string);
      }

      this.recordMiss();
      return null;
    } catch (error) {
      console.error('DatabaseCache get error:', error);
      this.recordMiss();
      return null;
    }
  }

  /**
   * 写入数据库缓存
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const ttl = options?.ttl || 300;
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
      
      await this.db.prepare(`
        INSERT INTO cache_store (key, value, expires_at, created_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          expires_at = excluded.expires_at,
          updated_at = datetime('now')
      `).bind(key, JSON.stringify(value), expiresAt).run();
    } catch (error) {
      console.error('DatabaseCache set error:', error);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    try {
      await this.db.prepare(`
        DELETE FROM cache_store WHERE key = ?
      `).bind(key).run();
    } catch (error) {
      console.error('DatabaseCache delete error:', error);
    }
  }

  /**
   * 根据模式失效缓存
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      await this.db.prepare(`
        DELETE FROM cache_store WHERE key LIKE ?
      `).bind(pattern.replace('*', '%')).run();
    } catch (error) {
      console.error('DatabaseCache invalidate error:', error);
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanup(): Promise<number> {
    try {
      const result = await this.db.prepare(`
        DELETE FROM cache_store WHERE expires_at < datetime('now')
      `).run();
      
      return result.meta?.changes || 0;
    } catch (error) {
      console.error('DatabaseCache cleanup error:', error);
      return 0;
    }
  }

  /**
   * 获取缓存大小
   */
  async getSize(): Promise<number> {
    try {
      const result = await this.db.prepare(`
        SELECT COUNT(*) as count FROM cache_store
      `).first();
      
      return (result?.count as number) || 0;
    } catch (error) {
      console.error('DatabaseCache getSize error:', error);
      return 0;
    }
  }

  /**
   * 获取缓存指标
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * 记录命中
   */
  private recordHit(latency: number): void {
    this.metrics.hits++;
    this.metrics.avgLatency = 
      (this.metrics.avgLatency * (this.metrics.hits - 1) + latency) / this.metrics.hits;
    this.updateHitRate();
  }

  /**
   * 记录未命中
   */
  private recordMiss(): void {
    this.metrics.misses++;
    this.updateHitRate();
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }
}

// 缓存表结构（需要在D1中创建）
export const CACHE_STORE_SCHEMA = `
CREATE TABLE IF NOT EXISTS cache_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_store(expires_at);
`;
