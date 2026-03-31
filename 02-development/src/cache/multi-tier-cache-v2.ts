// src/cache/multi-tier-cache-v2.ts
// 修正版：移除KV存储，适配Cloudflare免费账户限制
// Cloudflare免费账户KV限制：每天写入<1000次

import type { 
  CacheInterface, 
  CacheOptions, 
  CacheDataType, 
  CacheTier,
  CacheMetrics,
  WriteQuotaMonitor 
} from './types-v2';
import { CACHE_STRATEGIES, STORAGE_GUIDE } from './types-v2';
import { EdgeCache } from './edge-cache-v2';
import { DurableObjectCache } from './durable-object-cache';
import { DatabaseCache } from './database-cache';
import type { Env } from '../types';

/**
 * 多级缓存管理器 v2
 * 
 * 修正说明：
 * - 移除KV存储作为高频写入缓存层
 * - L2仅使用Cache API（无写入限制）
 * - L3使用Durable Objects（100万次/月）
 * - L4使用D1（10万次/天）
 * - 高频写入场景直接使用Durable Objects
 * 
 * 配额管理：
 * - KV: 仅用于低频配置（<500次/天）
 * - DO: 用于高频会话和实时数据（100万次/月）
 * - D1: 用于持久化缓存和预计算（10万次/天）
 */
export class MultiTierCacheManager {
  private l2: EdgeCache;
  private l3: DurableObjectCache;
  private l4: DatabaseCache;
  private env: Env;
  
  // 写入配额监控
  private quotaMonitor: WriteQuotaMonitor = {
    kvDailyWrites: 0,
    kvQuotaLimit: 1000,
    kvQuotaUsed: 0,
    doDailyWrites: 0,
    doQuotaLimit: 1000000 / 30, // 月均100万次
    doQuotaUsed: 0,
    lastResetTime: new Date(),
  };

  constructor(env: Env) {
    this.env = env;
    this.l2 = new EdgeCache(env.CACHE as any);
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
   * 智能缓存设置 - 根据数据类型选择存储方案
   * 
   * 存储方案选择逻辑：
   * 1. 低频写入（<500次/天）：可以使用KV
   * 2. 高频写入（>1000次/天）：仅使用DO或D1
   * 3. 实时数据：仅使用DO（内存缓存）
   * 4. 报表数据：Cache API + D1
   */
  async set<T>(
    key: string,
    value: T,
    type: CacheDataType,
    options?: CacheOptions
  ): Promise<void> {
    const strategy = CACHE_STRATEGIES[type];
    const ttl = options?.ttl || strategy.ttl;
    
    // 检查是否适合使用KV
    const estimatedWrites = strategy.estimatedDailyWrites || 0;
    const canUseKV = estimatedWrites < STORAGE_GUIDE.KV_SUITABLE.maxDailyWrites;
    
    // 根据数据类型选择存储方案
    for (const tier of strategy.tiers) {
      // 跳过KV不适合的场景
      if (tier === 'L2' && !canUseKV && estimatedWrites > 1000) {
        console.log(`[Cache] Skipping L2 for ${type} (high write frequency: ${estimatedWrites}/day)`);
        continue;
      }
      
      const cache = this.getCacheTier(tier);
      try {
        await cache.set(key, value, { ttl, tags: options?.tags });
        this.recordWrite(tier);
      } catch (error) {
        console.error(`[Cache] Failed to set cache in ${tier}:`, error);
      }
    }
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
          console.error(`[Cache] Failed to invalidate cache in ${tier}:`, error);
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
          console.error(`[Cache] Failed to invalidate pattern in ${tier}:`, error);
        }
      })
    );
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
   * 获取写入配额监控
   */
  getQuotaMonitor(): WriteQuotaMonitor {
    return { ...this.quotaMonitor };
  }

  /**
   * 检查KV配额是否超限
   */
  isKVQuotaExceeded(): boolean {
    return this.quotaMonitor.kvDailyWrites >= this.quotaMonitor.kvQuotaLimit;
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
        throw new Error(`[Cache] Unknown cache tier: ${tier}`);
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
          console.error(`[Cache] Failed to backfill to ${tier}:`, error);
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

  /**
   * 记录写入次数
   */
  private recordWrite(tier: CacheTier): void {
    switch (tier) {
      case 'L2':
        // L2使用Cache API，无写入限制
        break;
      case 'L3':
        this.quotaMonitor.doDailyWrites++;
        this.quotaMonitor.doQuotaUsed = 
          (this.quotaMonitor.doDailyWrites / this.quotaMonitor.doQuotaLimit) * 100;
        break;
      case 'L4':
        // D1写入通过D1 API统计
        break;
    }
  }

  /**
   * 重置每日配额计数
   */
  resetDailyQuota(): void {
    this.quotaMonitor.kvDailyWrites = 0;
    this.quotaMonitor.kvQuotaUsed = 0;
    this.quotaMonitor.doDailyWrites = 0;
    this.quotaMonitor.doQuotaUsed = 0;
    this.quotaMonitor.lastResetTime = new Date();
  }
}

/**
 * 缓存装饰器 - 用于自动缓存方法结果
 * 
 * 使用示例：
 * ```typescript
 * class CampaignService {
 *   @Cacheable('campaign', (id) => `campaign:${id}`, 300)
 *   async getCampaign(id: number) {
 *     return await db.query.campaigns.findFirst({ where: eq(campaigns.id, id) });
 *   }
 * }
 * ```
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
 * 
 * 使用示例：
 * ```typescript
 * class CampaignService {
 *   @CacheInvalidate('campaign', (id) => `campaign:${id}`)
 *   async updateCampaign(id: number, data: any) {
 *     return await db.update(campaigns).set(data).where(eq(campaigns.id, id));
 *   }
 * }
 * ```
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

/**
 * 高频数据直接写入DO（绕过缓存层）
 * 用于实时统计、点击事件等高频写入场景
 */
export async function writeToDurableObject<T>(
  env: Env,
  key: string,
  value: T,
  ttl: number = 60
): Promise<void> {
  const id = env.SESSION_STORE.idFromName(`hot-data:${key}`);
  const stub = env.SESSION_STORE.get(id);
  
  await stub.fetch('https://cache.internal/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, ttl }),
  });
}

/**
 * 从Durable Object读取高频数据
 */
export async function readFromDurableObject<T>(
  env: Env,
  key: string
): Promise<T | null> {
  const id = env.SESSION_STORE.idFromName(`hot-data:${key}`);
  const stub = env.SESSION_STORE.get(id);
  
  const response = await stub.fetch(`https://cache.internal/get?key=${encodeURIComponent(key)}`);
  
  if (response.status === 200) {
    return await response.json() as T;
  }
  
  return null;
}
