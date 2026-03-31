// src/cache/multi-tier-cache.ts
import type { 
  CacheInterface, 
  CacheOptions, 
  CacheDataType, 
  CacheTier,
  CacheMetrics 
} from './types';
import { CACHE_STRATEGIES } from './types';
import { EdgeCache } from './edge-cache';
import { DurableObjectCache } from './durable-object-cache';
import { DatabaseCache } from './database-cache';
import type { Env } from '../types';

/**
 * 多级缓存管理器
 * 协调L1-L4缓存层，提供统一的缓存接口
 */
export class MultiTierCacheManager {
  private l2: EdgeCache;
  private l3: DurableObjectCache;
  private l4: DatabaseCache;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.l2 = new EdgeCache(env.CACHE as any, env.CACHE);
    this.l3 = new DurableObjectCache(env);
    this.l4 = new DatabaseCache(env.DB);
  }

  /**
   * 智能缓存获取 - 自动选择最优缓存层
   */
  async get<T>(key: string, type: CacheDataType): Promise<T | null> {
    const strategy = CACHE_STRATEGIES[type];
    const startTime = Date.now();
    
    // 按层级依次尝试
    for (const tier of strategy.tiers) {
      const cache = this.getCacheTier(tier);
      const value = await cache.get<T>(key);
      
      if (value !== null) {
        // 回填到上层缓存
        await this.backfillUpperTiers(key, value, tier, strategy.tiers);
        
        // 记录性能指标
        this.recordMetrics(type, tier, 'hit', Date.now() - startTime);
        
        return value;
      }
    }
    
    // 记录未命中
    this.recordMetrics(type, strategy.tiers[strategy.tiers.length - 1], 'miss', Date.now() - startTime);
    
    return null;
  }

  /**
   * 智能缓存设置 - 写入所有相关缓存层
   */
  async set<T>(
    key: string,
    value: T,
    type: CacheDataType,
    options?: CacheOptions
  ): Promise<void> {
    const strategy = CACHE_STRATEGIES[type];
    const ttl = options?.ttl || strategy.ttl;
    
    // 并行写入所有缓存层
    await Promise.all(
      strategy.tiers.map(async (tier) => {
        const cache = this.getCacheTier(tier);
        try {
          await cache.set(key, value, { ttl, tags: options?.tags });
        } catch (error) {
          console.error(`Failed to set cache in ${tier}:`, error);
        }
      })
    );
  }

  /**
   * 智能失效 - 根据数据类型失效相关缓存
   */
  async invalidate(key: string, type: CacheDataType): Promise<void> {
    const strategy = CACHE_STRATEGIES[type];
    
    await Promise.all(
      strategy.tiers.map(async (tier) => {
        const cache = this.getCacheTier(tier);
        try {
          await cache.delete(key);
        } catch (error) {
          console.error(`Failed to invalidate cache in ${tier}:`, error);
        }
      })
    );
  }

  /**
   * 根据模式批量失效缓存
   */
  async invalidatePattern(pattern: string, type: CacheDataType): Promise<void> {
    const strategy = CACHE_STRATEGIES[type];
    
    await Promise.all(
      strategy.tiers.map(async (tier) => {
        const cache = this.getCacheTier(tier);
        try {
          await cache.invalidate(pattern);
        } catch (error) {
          console.error(`Failed to invalidate pattern in ${tier}:`, error);
        }
      })
    );
  }

  /**
   * 根据标签失效缓存
   */
  async invalidateByTag(tag: string): Promise<void> {
    // 从KV获取标签索引
    const tagKey = `__tag_index:${tag}`;
    const keys = await this.env.CACHE.get(tagKey, 'json') as string[] || [];
    
    // 批量删除
    await Promise.all(
      keys.map(key => this.l2.delete(key))
    );
    
    await this.env.CACHE.delete(tagKey);
  }

  /**
   * 获取或设置缓存（Cache-Aside模式）
   */
  async getOrSet<T>(
    key: string,
    type: CacheDataType,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = await this.get<T>(key, type);
    if (cached !== null) {
      return cached;
    }

    // 执行工厂函数获取数据
    const value = await factory();
    
    // 写入缓存
    await this.set(key, value, type, options);
    
    return value;
  }

  /**
   * 获取缓存指标
   */
  async getMetrics(): Promise<Record<CacheTier, CacheMetrics>> {
    return {
      L2: this.l2.getMetrics(),
      L3: this.l3.getMetrics(),
      L4: this.l4.getMetrics(),
    };
  }

  /**
   * 获取指定层级的缓存实例
   */
  private getCacheTier(tier: CacheTier): CacheInterface {
    switch (tier) {
      case 'L2':
        return this.l2;
      case 'L3':
        return this.l3;
      case 'L4':
        return this.l4;
      default:
        throw new Error(`Unknown cache tier: ${tier}`);
    }
  }

  /**
   * 回填到上层缓存
   */
  private async backfillUpperTiers<T>(
    key: string,
    value: T,
    currentTier: CacheTier,
    allTiers: CacheTier[]
  ): Promise<void> {
    const currentIndex = allTiers.indexOf(currentTier);
    const upperTiers = allTiers.slice(0, currentIndex);
    
    await Promise.all(
      upperTiers.map(async (tier) => {
        const cache = this.getCacheTier(tier);
        try {
          await cache.set(key, value);
        } catch (error) {
          console.error(`Failed to backfill to ${tier}:`, error);
        }
      })
    );
  }

  /**
   * 记录性能指标
   */
  private recordMetrics(
    type: CacheDataType,
    tier: CacheTier,
    result: 'hit' | 'miss',
    latency: number
  ): void {
    // 异步记录到分析系统
    this.env.ANALYTICS?.writeDataPoint({
      blobs: [type, tier, result],
      doubles: [latency],
      indexes: [Date.now().toString()],
    }).catch(() => {});
  }
}

/**
 * 缓存装饰器 - 用于自动缓存方法结果
 */
export function Cacheable(
  type: CacheDataType,
  keyGenerator: (...args: any[]) => string,
  ttl?: number
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheManager: MultiTierCacheManager = this.cacheManager;
      if (!cacheManager) {
        return originalMethod.apply(this, args);
      }

      const key = keyGenerator(...args);
      
      return cacheManager.getOrSet(
        key,
        type,
        () => originalMethod.apply(this, args),
        { ttl }
      );
    };

    return descriptor;
  };
}

/**
 * 缓存失效装饰器
 */
export function CacheInvalidate(
  type: CacheDataType,
  keyGenerator: (...args: any[]) => string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheManager: MultiTierCacheManager = this.cacheManager;
      
      const result = await originalMethod.apply(this, args);
      
      if (cacheManager) {
        const key = keyGenerator(...args);
        await cacheManager.invalidate(key, type);
      }
      
      return result;
    };

    return descriptor;
  };
}
