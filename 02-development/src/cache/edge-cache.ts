// src/cache/edge-cache.ts
import type { CacheInterface, CacheOptions, CacheMetrics } from './types';
import type { Env } from '../types';

/**
 * L2: Edge Cache (Cloudflare CDN + KV)
 * 用于缓存API响应、配置数据、报表数据
 */
export class EdgeCache implements CacheInterface {
  private cacheApi: Cache;
  private kv: KVNamespace;
  private metrics: CacheMetrics = {
    tier: 'L2',
    hits: 0,
    misses: 0,
    hitRate: 0,
    avgLatency: 0,
    size: 0,
  };

  constructor(cacheApi: Cache, kv: KVNamespace) {
    this.cacheApi = cacheApi;
    this.kv = kv;
  }

  /**
   * 从边缘缓存获取数据
   * 优先从Cache API获取，失败则从KV获取
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // 1. 尝试从Cache API获取
      const cacheKey = this.buildCacheKey(key);
      const cached = await this.cacheApi.match(cacheKey);
      
      if (cached) {
        const data = await cached.json();
        this.recordHit(Date.now() - startTime);
        return data as T;
      }

      // 2. 尝试从KV获取
      const kvData = await this.kv.get(key, 'json');
      if (kvData) {
        // 回填到Cache API
        await this.backfillToCacheApi(key, kvData);
        this.recordHit(Date.now() - startTime);
        return kvData as T;
      }

      this.recordMiss();
      return null;
    } catch (error) {
      console.error('EdgeCache get error:', error);
      this.recordMiss();
      return null;
    }
  }

  /**
   * 写入边缘缓存
   * 同时写入Cache API和KV
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 300;
    
    try {
      // 1. 写入Cache API
      const cacheKey = this.buildCacheKey(key);
      const response = new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${ttl}`,
          'X-Cache-Tier': 'L2',
          'X-Cache-Key': key,
        },
      });
      
      await this.cacheApi.put(cacheKey, response);

      // 2. 写入KV（作为持久化备份）
      await this.kv.put(key, JSON.stringify(value), {
        expirationTtl: ttl,
      });

      // 3. 如果有标签，建立索引
      if (options?.tags) {
        await this.addToTagIndex(key, options.tags);
      }
    } catch (error) {
      console.error('EdgeCache set error:', error);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    try {
      // 删除Cache API
      const cacheKey = this.buildCacheKey(key);
      await this.cacheApi.delete(cacheKey);

      // 删除KV
      await this.kv.delete(key);

      // 从标签索引中移除
      await this.removeFromTagIndex(key);
    } catch (error) {
      console.error('EdgeCache delete error:', error);
    }
  }

  /**
   * 根据模式失效缓存
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      // 从KV中查找匹配的key
      const { keys } = await this.kv.list({ prefix: pattern.replace('*', '') });
      
      // 批量删除
      await Promise.all(
        keys.map(async (key) => {
          await this.delete(key.name);
        })
      );
    } catch (error) {
      console.error('EdgeCache invalidate error:', error);
    }
  }

  /**
   * 根据标签失效缓存
   */
  async invalidateByTag(tag: string): Promise<void> {
    try {
      const tagKey = `__tag_index:${tag}`;
      const keys = await this.kv.get(tagKey, 'json') as string[] || [];
      
      await Promise.all(
        keys.map(key => this.delete(key))
      );
      
      await this.kv.delete(tagKey);
    } catch (error) {
      console.error('EdgeCache invalidateByTag error:', error);
    }
  }

  /**
   * 获取缓存指标
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * 构建Cache API的key
   */
  private buildCacheKey(key: string): Request {
    return new Request(`https://cache.cat-tracker.workers.dev/${key}`);
  }

  /**
   * 回填到Cache API
   */
  private async backfillToCacheApi<T>(key: string, value: T): Promise<void> {
    const cacheKey = this.buildCacheKey(key);
    const response = new Response(JSON.stringify(value), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
      },
    });
    await this.cacheApi.put(cacheKey, response);
  }

  /**
   * 添加到标签索引
   */
  private async addToTagIndex(key: string, tags: string[]): Promise<void> {
    await Promise.all(
      tags.map(async (tag) => {
        const tagKey = `__tag_index:${tag}`;
        const existing = await this.kv.get(tagKey, 'json') as string[] || [];
        if (!existing.includes(key)) {
          existing.push(key);
          await this.kv.put(tagKey, JSON.stringify(existing));
        }
      })
    );
  }

  /**
   * 从标签索引中移除
   */
  private async removeFromTagIndex(key: string): Promise<void> {
    // 获取所有标签索引
    const { keys } = await this.kv.list({ prefix: '__tag_index:' });
    
    await Promise.all(
      keys.map(async (tagKey) => {
        const keys = await this.kv.get(tagKey.name, 'json') as string[] || [];
        const filtered = keys.filter(k => k !== key);
        if (filtered.length !== keys.length) {
          await this.kv.put(tagKey.name, JSON.stringify(filtered));
        }
      })
    );
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
