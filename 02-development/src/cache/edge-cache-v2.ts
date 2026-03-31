// src/cache/edge-cache-v2.ts
// 修正版：移除KV存储，仅使用Cache API
// Cloudflare免费账户KV限制：每天写入<1000次

import type { CacheInterface, CacheOptions, CacheMetrics } from './types-v2';

/**
 * L2: Edge Cache (Cloudflare Cache API Only)
 * 
 * 修正说明：
 * - 原方案使用Cache API + KV双层存储
 * - 新方案仅使用Cache API，避免KV写入配额限制
 * - Cache API没有写入次数限制，只有存储大小限制
 * 
 * 适用场景：
 * - 报表数据缓存（低频写入，高频读取）
 * - API响应缓存
 * - 静态资源缓存
 * 
 * 限制：
 * - Cache API是区域性的，不同数据中心不共享
 * - 需要配合L3/L4实现全局一致性
 */
export class EdgeCache implements CacheInterface {
  private cacheApi: Cache;
  private metrics: CacheMetrics = {
    tier: 'L2',
    hits: 0,
    misses: 0,
    hitRate: 0,
    avgLatency: 0,
    size: 0,
    writes: 0,
    writesToKV: 0,
    writesToDO: 0,
    writesToD1: 0,
  };

  constructor(cacheApi: Cache) {
    this.cacheApi = cacheApi;
  }

  /**
   * 从边缘缓存获取数据
   * 仅使用Cache API，不查询KV
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      const cacheKey = this.buildCacheKey(key);
      const cached = await this.cacheApi.match(cacheKey);
      
      if (cached) {
        // 检查是否过期（Cache API不自动过期，需要手动检查）
        const expiresAt = cached.headers.get('X-Cache-Expires');
        if (expiresAt && new Date(expiresAt) < new Date()) {
          // 已过期，删除并返回null
          await this.cacheApi.delete(cacheKey);
          this.recordMiss();
          return null;
        }

        const data = await cached.json();
        this.recordHit(Date.now() - startTime);
        return data as T;
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
   * 仅写入Cache API，不写入KV
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl || 300;
    
    try {
      const cacheKey = this.buildCacheKey(key);
      const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
      
      const response = new Response(JSON.stringify(value), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${ttl}`,
          'X-Cache-Tier': 'L2',
          'X-Cache-Key': key,
          'X-Cache-Expires': expiresAt,
          'X-Cache-Tags': options?.tags?.join(',') || '',
        },
      });
      
      await this.cacheApi.put(cacheKey, response);
      this.recordWrite();
      
    } catch (error) {
      console.error('EdgeCache set error:', error);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    try {
      const cacheKey = this.buildCacheKey(key);
      await this.cacheApi.delete(cacheKey);
    } catch (error) {
      console.error('EdgeCache delete error:', error);
    }
  }

  /**
   * 根据模式失效缓存
   * Cache API不支持模式匹配，需要遍历所有缓存
   * 注意：这是昂贵的操作，应尽量避免
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      // Cache API不支持list操作，无法批量失效
      // 解决方案：
      // 1. 使用标签索引（存储在DO或D1中）
      // 2. 或者依赖TTL自动过期
      // 3. 或者使用版本号机制
      
      // 这里使用版本号机制：在key中包含版本号
      // 失效时只需更新版本号，旧版本自然过期
      console.warn('EdgeCache.invalidate: Cache API does not support pattern matching. Use version-based invalidation instead.');
    } catch (error) {
      console.error('EdgeCache invalidate error:', error);
    }
  }

  /**
   * 根据标签失效缓存
   * 需要配合外部标签索引（存储在DO中）
   */
  async invalidateByTag(tag: string, tagIndexDO: DurableObjectStub): Promise<void> {
    try {
      // 从DO获取标签索引
      const response = await tagIndexDO.fetch(`https://tag-index.internal/get?tag=${encodeURIComponent(tag)}`);
      const keys = await response.json() as string[];
      
      // 批量删除
      await Promise.all(keys.map(key => this.delete(key)));
      
      // 清除标签索引
      await tagIndexDO.fetch(`https://tag-index.internal/clear?tag=${encodeURIComponent(tag)}`, {
        method: 'POST',
      });
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
    // 使用版本号机制支持批量失效
    // key格式: cache:v1:campaign:123
    return new Request(`https://cache.cat-tracker.workers.dev/${key}`);
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
   * 记录写入
   */
  private recordWrite(): void {
    this.metrics.writes++;
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
  }
}

/**
 * 标签索引Durable Object
 * 用于支持按标签失效缓存
 */
export class TagIndexDO implements DurableObject {
  private state: DurableObjectState;
  private tagIndex: Map<string, Set<string>> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
    
    // 从持久化存储恢复
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, string[]>>('tagIndex');
      if (stored) {
        for (const [tag, keys] of stored) {
          this.tagIndex.set(tag, new Set(keys));
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/add':
        return this.handleAdd(url);
      case '/get':
        return this.handleGet(url);
      case '/clear':
        return this.handleClear(url);
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleAdd(url: URL): Promise<Response> {
    const tag = url.searchParams.get('tag');
    const key = url.searchParams.get('key');
    
    if (!tag || !key) {
      return new Response('Missing tag or key', { status: 400 });
    }

    if (!this.tagIndex.has(tag)) {
      this.tagIndex.set(tag, new Set());
    }
    this.tagIndex.get(tag)!.add(key);
    
    await this.persist();
    return new Response('OK');
  }

  private async handleGet(url: URL): Promise<Response> {
    const tag = url.searchParams.get('tag');
    if (!tag) {
      return new Response('Missing tag', { status: 400 });
    }

    const keys = Array.from(this.tagIndex.get(tag) || []);
    return new Response(JSON.stringify(keys), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleClear(url: URL): Promise<Response> {
    const tag = url.searchParams.get('tag');
    if (!tag) {
      return new Response('Missing tag', { status: 400 });
    }

    this.tagIndex.delete(tag);
    await this.persist();
    return new Response('OK');
  }

  private async persist(): Promise<void> {
    const serialized = new Map<string, string[]>();
    for (const [tag, keys] of this.tagIndex) {
      serialized.set(tag, Array.from(keys));
    }
    await this.state.storage.put('tagIndex', serialized);
  }
}
