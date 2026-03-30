/**
 * 工具函数集合
 */

import { v4 as uuidv4 } from 'uuid';
import type { DeviceInfo, GeoInfo } from '../types';

/**
 * 生成唯一 ID
 */
export function generateId(prefix: string = ''): string {
  const id = uuidv4().replace(/-/g, '').substring(0, 16);
  return prefix ? `${prefix}_${id}` : id;
}

/**
 * 生成 Click ID
 */
export function generateClickId(): string {
  return `clk_${generateId()}`;
}

/**
 * 生成 Conversion ID
 */
export function generateConversionId(): string {
  return `conv_${generateId()}`;
}

/**
 * 生成 Impression ID
 */
export function generateImpressionId(): string {
  return `imp_${generateId()}`;
}

/**
 * 解析 User Agent 获取设备信息
 */
export function parseUserAgent(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  
  // 设备类型检测
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/tablet|ipad|playbook|silk/.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/.test(ua)) {
    deviceType = 'mobile';
  }

  // OS 检测
  let os = 'Unknown';
  let osVersion = '';
  
  if (/windows nt (\d+\.?\d*)/.test(ua)) {
    os = 'Windows';
    osVersion = RegExp.$1;
  } else if (/mac os x (\d+[._]\d+[._]?\d*)/.test(ua)) {
    os = 'macOS';
    osVersion = RegExp.$1.replace(/_/g, '.');
  } else if (/android (\d+\.?\d*)/.test(ua)) {
    os = 'Android';
    osVersion = RegExp.$1;
  } else if (/iphone os (\d+_\d+)/.test(ua) || /ipad.*os (\d+_\d+)/.test(ua)) {
    os = 'iOS';
    osVersion = RegExp.$1.replace(/_/g, '.');
  } else if (/linux/.test(ua)) {
    os = 'Linux';
  }

  // 浏览器检测
  let browser = 'Unknown';
  let browserVersion = '';

  if (/edg\/(\d+\.?\d*)/.test(ua)) {
    browser = 'Edge';
    browserVersion = RegExp.$1;
  } else if (/chrome\/(\d+\.?\d*)/.test(ua)) {
    browser = 'Chrome';
    browserVersion = RegExp.$1;
  } else if (/firefox\/(\d+\.?\d*)/.test(ua)) {
    browser = 'Firefox';
    browserVersion = RegExp.$1;
  } else if (/safari\/(\d+\.?\d*)/.test(ua) && !/chrome/.test(ua)) {
    browser = 'Safari';
    browserVersion = RegExp.$1;
  } else if (/opera|opr\/(\d+\.?\d*)/.test(ua)) {
    browser = 'Opera';
    browserVersion = RegExp.$1;
  } else if (/msie (\d+\.?\d*)|trident.*rv:(\d+\.?\d*)/.test(ua)) {
    browser = 'IE';
    browserVersion = RegExp.$1 || RegExp.$2;
  }

  return {
    deviceType,
    os,
    osVersion,
    browser,
    browserVersion,
  };
}

/**
 * 从请求中获取 Geo 信息
 * Cloudflare 自动提供 geo 信息
 */
export function getGeoInfo(request: Request): GeoInfo {
  const cf = (request as any).cf || {};
  
  return {
    country: cf.country || 'Unknown',
    region: cf.region || '',
    city: cf.city || '',
    isp: cf.asOrganization || '',
  };
}

/**
 * 获取客户端 IP
 */
export function getClientIP(request: Request): string {
  // Cloudflare 提供的真实 IP
  const cfConnectingIP = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIP) return cfConnectingIP;

  // 标准 X-Forwarded-For
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  // X-Real-IP
  const xRealIP = request.headers.get('X-Real-IP');
  if (xRealIP) return xRealIP;

  return '0.0.0.0';
}

/**
 * 格式化日期为字符串
 */
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 获取日期分区字符串 (YYYY-MM-DD)
 */
export function getDatePartition(date: Date | string | number = new Date()): string {
  const d = new Date(date);
  return d.toISOString().substring(0, 10);
}

/**
 * 获取当前小时 (0-23)
 */
export function getCurrentHour(): number {
  return new Date().getHours();
}

/**
 * 构建带参数的 URL
 */
export function buildUrl(baseUrl: string, params: Record<string, string | number | undefined>): string {
  const url = new URL(baseUrl);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  
  return url.toString();
}

/**
 * 替换 URL 中的宏变量
 */
export function replaceMacros(url: string, macros: Record<string, string>): string {
  let result = url;
  
  Object.entries(macros).forEach(([key, value]) => {
    const pattern = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(pattern, encodeURIComponent(value));
  });
  
  return result;
}

/**
 * 常用宏变量
 */
export const MACRO_VARS = {
  CLICK_ID: 'clickid',
  CAMPAIGN_ID: 'campaign_id',
  OFFER_ID: 'offer_id',
  SUB1: 'sub1',
  SUB2: 'sub2',
  SUB3: 'sub3',
  SUB4: 'sub4',
  SUB5: 'sub5',
  PAYOUT: 'payout',
  REVENUE: 'revenue',
  COUNTRY: 'country',
  DEVICE_TYPE: 'device_type',
  OS: 'os',
  BROWSER: 'browser',
};

/**
 * 睡眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i)); // 指数退避
      }
    }
  }
  
  throw lastError;
}

/**
 * 安全解析 JSON
 */
export function safeJsonParse<T>(json: string | null, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

/**
 * 哈希函数 (用于 API Key 等)
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 生成随机 API Key
 */
export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32);
}

/**
 * 验证邮箱格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证 URL 格式
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 解析查询参数
 */
export function parseQuery<T extends Record<string, string>>(
  queryString: string
): T {
  const params = new URLSearchParams(queryString);
  const result: Record<string, string> = {};
  
  params.forEach((value, key) => {
    result[key] = value;
  });
  
  return result as T;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 计算统计指标
 */
export function calculateMetrics(
  impressions: number,
  clicks: number,
  conversions: number,
  revenue: number,
  cost: number
): {
  ctr: number;
  cvr: number;
  epc: number;
  cpc: number;
  roi: number;
  profit: number;
} {
  const profit = revenue - cost;
  
  return {
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
    cvr: clicks > 0 ? (conversions / clicks) * 100 : 0,
    epc: clicks > 0 ? revenue / clicks : 0,
    cpc: clicks > 0 ? cost / clicks : 0,
    roi: cost > 0 ? (profit / cost) * 100 : 0,
    profit,
  };
}

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 */
export function getToday(): string {
  const now = new Date();
  return now.toISOString().substring(0, 10);
}

/**
 * 获取 N 天前的日期字符串 (YYYY-MM-DD)
 */
export function getDateDaysAgo(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() - days);
  return now.toISOString().substring(0, 10);
}
