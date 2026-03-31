// src/cache/types.ts

export type CacheTier = 'L1' | 'L2' | 'L3' | 'L4';

export type CacheDataType = 
  | 'campaign'
  | 'flow'
  | 'offer'
  | 'realtimeStats'
  | 'hourlyReport'
  | 'dailyReport'
  | 'monthlyReport'
  | 'staticAsset'
  | 'userSession'
  | 'queryResult';

export interface CacheStrategy {
  tiers: CacheTier[];
  ttl: number;
  invalidateOn: string[];
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  staleWhileRevalidate?: number;
}

export interface CacheInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// 缓存策略配置
export const CACHE_STRATEGIES: Record<CacheDataType, CacheStrategy> = {
  campaign: {
    tiers: ['L2', 'L3', 'L4'],
    ttl: 300, // 5分钟
    invalidateOn: ['update', 'delete'],
  },
  flow: {
    tiers: ['L2', 'L3', 'L4'],
    ttl: 300,
    invalidateOn: ['update', 'delete'],
  },
  offer: {
    tiers: ['L2', 'L3', 'L4'],
    ttl: 300,
    invalidateOn: ['update', 'delete'],
  },
  realtimeStats: {
    tiers: ['L3'],
    ttl: 60, // 1分钟
    invalidateOn: ['time'],
  },
  hourlyReport: {
    tiers: ['L2', 'L4'],
    ttl: 3600, // 1小时
    invalidateOn: ['hourEnd'],
  },
  dailyReport: {
    tiers: ['L2', 'L4'],
    ttl: 86400, // 1天
    invalidateOn: ['dayEnd'],
  },
  monthlyReport: {
    tiers: ['L2', 'L4'],
    ttl: 604800, // 7天
    invalidateOn: ['monthEnd'],
  },
  staticAsset: {
    tiers: ['L1', 'L2'],
    ttl: 2592000, // 30天
    invalidateOn: ['version'],
  },
  userSession: {
    tiers: ['L1', 'L3'],
    ttl: 1800, // 30分钟
    invalidateOn: ['logout'],
  },
  queryResult: {
    tiers: ['L2', 'L3'],
    ttl: 300,
    invalidateOn: ['dataChange'],
  },
};

// 缓存指标
export interface CacheMetrics {
  tier: CacheTier;
  hits: number;
  misses: number;
  hitRate: number;
  avgLatency: number;
  size: number;
}
