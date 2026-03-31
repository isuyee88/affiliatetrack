// src/cache/types.ts
// 修正版：移除KV存储作为高频写入缓存层
// Cloudflare免费账户KV限制：每天写入<1000次

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
  // 预估每日写入次数（用于选择存储方案）
  estimatedDailyWrites?: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  staleWhileRevalidate?: number;
  // 是否使用KV（仅用于低频写入场景）
  useKV?: boolean;
}

export interface CacheInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  delete(key: string): Promise<void>;
  invalidate(pattern: string): Promise<void>;
}

// 缓存策略配置
// 注意：免费账户KV每天写入限制1000次
// 高频写入场景（>1000次/天）使用Durable Objects或D1替代
export const CACHE_STRATEGIES: Record<CacheDataType, CacheStrategy> = {
  campaign: {
    tiers: ['L2', 'L3', 'L4'],
    ttl: 300, // 5分钟
    invalidateOn: ['update', 'delete'],
    estimatedDailyWrites: 100, // 低频，Campaign编辑不频繁
  },
  flow: {
    tiers: ['L2', 'L3', 'L4'],
    ttl: 300,
    invalidateOn: ['update', 'delete'],
    estimatedDailyWrites: 50, // 低频
  },
  offer: {
    tiers: ['L2', 'L3', 'L4'],
    ttl: 300,
    invalidateOn: ['update', 'delete'],
    estimatedDailyWrites: 100, // 低频
  },
  // ⚠️ 高频写入场景：使用Durable Objects而非KV
  realtimeStats: {
    tiers: ['L3'], // 仅使用DO，不使用KV
    ttl: 60, // 1分钟
    invalidateOn: ['time'],
    estimatedDailyWrites: 50000, // 高频：每秒都可能更新
  },
  hourlyReport: {
    tiers: ['L2', 'L4'], // Cache API + D1，不使用KV
    ttl: 3600, // 1小时
    invalidateOn: ['hourEnd'],
    estimatedDailyWrites: 24, // 每小时更新一次
  },
  dailyReport: {
    tiers: ['L2', 'L4'], // Cache API + D1，不使用KV
    ttl: 86400, // 1天
    invalidateOn: ['dayEnd'],
    estimatedDailyWrites: 1, // 每天更新一次
  },
  monthlyReport: {
    tiers: ['L2', 'L4'], // Cache API + D1，不使用KV
    ttl: 604800, // 7天
    invalidateOn: ['monthEnd'],
    estimatedDailyWrites: 1, // 每月更新一次
  },
  staticAsset: {
    tiers: ['L1', 'L2'], // 浏览器 + Cache API，不使用KV
    ttl: 2592000, // 30天
    invalidateOn: ['version'],
    estimatedDailyWrites: 10, // 低频，版本更新时
  },
  // ⚠️ 高频写入场景：使用Durable Objects而非KV
  userSession: {
    tiers: ['L1', 'L3'], // 浏览器 + DO，不使用KV
    ttl: 1800, // 30分钟
    invalidateOn: ['logout'],
    estimatedDailyWrites: 10000, // 高频：每次请求都可能更新
  },
  // ⚠️ 高频写入场景：使用Durable Objects而非KV
  queryResult: {
    tiers: ['L2', 'L3'], // Cache API + DO，不使用KV
    ttl: 300,
    invalidateOn: ['dataChange'],
    estimatedDailyWrites: 5000, // 高频：每次查询都可能缓存
  },
};

// 存储方案选择指南
export const STORAGE_GUIDE = {
  // ✅ 适合KV的场景（低频写入）
  KV_SUITABLE: {
    maxDailyWrites: 500, // 安全阈值：低于500次/天
    useCases: [
      'Campaign配置缓存',
      'Flow规则缓存',
      'Offer信息缓存',
      '静态资源版本映射',
      '系统配置',
    ],
  },
  // ❌ 不适合KV的场景（高频写入）
  KV_UNSUITABLE: {
    minDailyWrites: 1000,
    alternatives: 'Durable Objects 或 D1',
    useCases: [
      '实时统计数据',
      '用户会话状态',
      '查询结果缓存',
      '点击事件缓冲',
      '实时聚合数据',
    ],
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
  // 新增：写入次数统计
  writes: number;
  writesToKV: number;
  writesToDO: number;
  writesToD1: number;
}

// 写入配额监控
export interface WriteQuotaMonitor {
  kvDailyWrites: number;
  kvQuotaLimit: number;
  kvQuotaUsed: number; // 百分比
  doDailyWrites: number;
  doQuotaLimit: number;
  doQuotaUsed: number;
  lastResetTime: Date;
}
