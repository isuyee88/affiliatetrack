/**
 * 速率限制中间件
 */

import type { Context, Next } from 'hono';
import type { Env } from '../types';

// 内存存储 (注意: Workers 是无状态的，这里仅作演示)
// 生产环境应使用 Durable Objects 存储计数
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

/**
 * 速率限制配置
 */
interface RateLimitConfig {
  windowMs: number;  // 时间窗口 (毫秒)
  maxRequests: number; // 最大请求数
  keyGenerator?: (c: Context<{ Bindings: Env }>) => string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60000, // 1分钟
  maxRequests: 1000, // 1000 请求/分钟
};

/**
 * 速率限制中间件
 */
// 内存存储清理阈值
const STORE_SIZE_THRESHOLD = 10000;

export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const config = defaultConfig;
  
  // 生成限流 key
  const key = config.keyGenerator
    ? config.keyGenerator(c)
    : getClientKey(c);

  const now = Date.now();
  
  // 清理过期条目（当存储大小超过阈值时）
  if (rateLimitStore.size > STORE_SIZE_THRESHOLD) {
    for (const [storeKey, storeRecord] of rateLimitStore.entries()) {
      if (now > storeRecord.resetAt) {
        rateLimitStore.delete(storeKey);
      }
    }
  }
  
  const record = rateLimitStore.get(key);

  // 检查是否需要重置计数
  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    
    // 设置响应头
    setRateLimitHeaders(c, 1, config.maxRequests, Math.ceil(config.windowMs / 1000));
    
    return next();
  }

  // 检查是否超限
  if (record.count >= config.maxRequests) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    
    return c.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter,
      },
      429,
      {
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
      }
    );
  }

  // 增加计数
  record.count++;
  rateLimitStore.set(key, record);

  // 设置响应头
  setRateLimitHeaders(
    c,
    record.count,
    config.maxRequests,
    Math.ceil((record.resetAt - now) / 1000)
  );

  await next();
}

/**
 * 获取客户端标识 key
 */
function getClientKey(c: Context<{ Bindings: Env }>): string {
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const path = c.req.path;
  
  // 根据路径分组
  if (path.startsWith('/api/track')) {
    return `track:${ip}`;
  }
  if (path.startsWith('/api/admin')) {
    const authHeader = c.req.header('Authorization');
    const apiKey = c.req.header('X-API-Key');
    return `admin:${apiKey || authHeader || ip}`;
  }
  
  return `default:${ip}`;
}

/**
 * 设置速率限制响应头
 */
function setRateLimitHeaders(
  c: Context<{ Bindings: Env }>,
  current: number,
  limit: number,
  reset: number
): void {
  c.header('X-RateLimit-Limit', String(limit));
  c.header('X-RateLimit-Remaining', String(Math.max(0, limit - current)));
  c.header('X-RateLimit-Reset', String(Math.ceil(Date.now() / 1000) + reset));
}
