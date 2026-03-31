// src/cache/durable-object-cache.ts
import type { CacheInterface, CacheOptions, CacheMetrics } from './types';
import type { Env } from '../types';

/**
 * L3: Durable Object Cache
 * 用于缓存热数据、会话数据、实时聚合数据
 * 支持WebSocket和状态保持
 */
export class DurableObjectCache implements CacheInterface {
  private env: Env;
  private metrics: CacheMetrics = {
    tier: 'L3',
    hits: 0,
    misses: 0,
    hitRate: 0,
    avgLatency: 0,
    size: 0,
  };

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * 从Durable Object获取数据
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    
    try {
      // 获取或创建Durable Object实例
      const id = this.env.SESSION_STORE.idFromName(`cache:${key}`);
      const stub = this.env.SESSION_STORE.get(id);
      
      // 发送获取请求
      const response = await stub.fetch(`https://cache.internal/get?key=${encodeURIComponent(key)}`);
      
      if (response.status === 200) {
        const data = await response.json();
        this.recordHit(Date.now() - startTime);
        return data as T;
      }
      
      this.recordMiss();
      return null;
    } catch (error) {
      console.error('DurableObjectCache get error:', error);
      this.recordMiss();
      return null;
    }
  }

  /**
   * 写入Durable Object
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    try {
      const id = this.env.SESSION_STORE.idFromName(`cache:${key}`);
      const stub = this.env.SESSION_STORE.get(id);
      
      await stub.fetch('https://cache.internal/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value,
          ttl: options?.ttl || 300,
          tags: options?.tags,
        }),
      });
    } catch (error) {
      console.error('DurableObjectCache set error:', error);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    try {
      const id = this.env.SESSION_STORE.idFromName(`cache:${key}`);
      const stub = this.env.SESSION_STORE.get(id);
      
      await stub.fetch(`https://cache.internal/delete?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('DurableObjectCache delete error:', error);
    }
  }

  /**
   * 根据模式失效缓存
   */
  async invalidate(pattern: string): Promise<void> {
    try {
      // 获取所有匹配的Durable Object
      const { keys } = await this.env.KV.list({ prefix: `do_cache_index:${pattern.replace('*', '')}` });
      
      await Promise.all(
        keys.map(async (key) => {
          const id = this.env.SESSION_STORE.idFromName(key.name);
          const stub = this.env.SESSION_STORE.get(id);
          await stub.fetch('https://cache.internal/clear', { method: 'POST' });
        })
      );
    } catch (error) {
      console.error('DurableObjectCache invalidate error:', error);
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

/**
 * Durable Object Cache实现
 */
export class CacheDurableObject implements DurableObject {
  private state: DurableObjectState;
  private cache: Map<string, { value: any; expires: number; tags: string[] }> = new Map();
  private cleanupInterval: number | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    
    // 从持久化存储恢复
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, any>>('cache');
      if (stored) {
        this.cache = stored;
      }
    });

    // 启动清理定时器
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/get':
        return this.handleGet(url);
      case '/set':
        return this.handleSet(request);
      case '/delete':
        return this.handleDelete(url);
      case '/clear':
        return this.handleClear();
      default:
        return new Response('Not found', { status: 404 });
    }
  }

  private async handleGet(url: URL): Promise<Response> {
    const key = url.searchParams.get('key');
    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    const entry = this.cache.get(key);
    if (!entry) {
      return new Response('Not found', { status: 404 });
    }

    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      await this.persist();
      return new Response('Expired', { status: 404 });
    }

    return new Response(JSON.stringify(entry.value), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleSet(request: Request): Promise<Response> {
    const body = await request.json<{
      key: string;
      value: any;
      ttl: number;
      tags?: string[];
    }>();

    this.cache.set(body.key, {
      value: body.value,
      expires: Date.now() + body.ttl * 1000,
      tags: body.tags || [],
    });

    await this.persist();
    return new Response('OK');
  }

  private async handleDelete(url: URL): Promise<Response> {
    const key = url.searchParams.get('key');
    if (!key) {
      return new Response('Missing key', { status: 400 });
    }

    this.cache.delete(key);
    await this.persist();
    return new Response('OK');
  }

  private async handleClear(): Promise<Response> {
    this.cache.clear();
    await this.persist();
    return new Response('OK');
  }

  private async persist(): Promise<void> {
    await this.state.storage.put('cache', this.cache);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expires < now) {
        this.cache.delete(key);
      }
    }
    this.persist();
  }
}
