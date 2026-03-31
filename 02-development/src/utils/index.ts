import { customAlphabet } from 'nanoid';

// Generate unique click ID (16 characters)
export const generateClickId = customAlphabet(
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  16
);

// Generate unique slug
export const generateSlug = (name: string): string => {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6)();
  return `${base}-${suffix}`;
};

// Parse user agent
export function parseUserAgent(userAgent: string): {
  device: string;
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
} {
  const result = {
    device: 'desktop',
    os: 'unknown',
    osVersion: '',
    browser: 'unknown',
    browserVersion: '',
  };

  if (!userAgent) return result;

  // Device detection
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(userAgent)) {
    result.device = /iPad|Tablet/i.test(userAgent) ? 'tablet' : 'mobile';
  }

  // OS detection
  if (/Windows NT 10\.0/i.test(userAgent)) {
    result.os = 'Windows';
    result.osVersion = '10';
  } else if (/Windows NT 6\.3/i.test(userAgent)) {
    result.os = 'Windows';
    result.osVersion = '8.1';
  } else if (/Windows NT 6\.2/i.test(userAgent)) {
    result.os = 'Windows';
    result.osVersion = '8';
  } else if (/Windows NT 6\.1/i.test(userAgent)) {
    result.os = 'Windows';
    result.osVersion = '7';
  } else if (/Mac OS X/i.test(userAgent)) {
    result.os = 'macOS';
    const match = userAgent.match(/Mac OS X (\d+[._]\d+)/);
    result.osVersion = match ? match[1].replace('_', '.') : '';
  } else if (/Android/i.test(userAgent)) {
    result.os = 'Android';
    const match = userAgent.match(/Android (\d+\.?\d*)/);
    result.osVersion = match ? match[1] : '';
  } else if (/iOS|iPhone|iPad|iPod/i.test(userAgent)) {
    result.os = 'iOS';
    const match = userAgent.match(/OS (\d+_\d+)/);
    result.osVersion = match ? match[1].replace('_', '.') : '';
  } else if (/Linux/i.test(userAgent)) {
    result.os = 'Linux';
  }

  // Browser detection
  if (/Chrome\/([\d.]+)/i.test(userAgent) && !/Edge|Edg\/([\d.]+)/i.test(userAgent)) {
    result.browser = 'Chrome';
    const match = userAgent.match(/Chrome\/([\d.]+)/);
    result.browserVersion = match ? match[1] : '';
  } else if (/Firefox\/([\d.]+)/i.test(userAgent)) {
    result.browser = 'Firefox';
    const match = userAgent.match(/Firefox\/([\d.]+)/);
    result.browserVersion = match ? match[1] : '';
  } else if (/Safari\/([\d.]+)/i.test(userAgent) && /Version\/([\d.]+)/i.test(userAgent)) {
    result.browser = 'Safari';
    const match = userAgent.match(/Version\/([\d.]+)/);
    result.browserVersion = match ? match[1] : '';
  } else if (/Edge\/([\d.]+)/i.test(userAgent) || /Edg\/([\d.]+)/i.test(userAgent)) {
    result.browser = 'Edge';
    const match = userAgent.match(/(?:Edge|Edg)\/([\d.]+)/);
    result.browserVersion = match ? match[1] : '';
  }

  return result;
}

// Get geo info from IP (simplified, in production use GeoIP service)
export async function getGeoInfo(ip: string): Promise<{
  country?: string;
  region?: string;
  city?: string;
} | null> {
  // In production, this would call a GeoIP service
  // For now, return null and rely on Cloudflare headers
  return null;
}

// Format currency
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Format number with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Calculate ROI
export function calculateROI(revenue: number, cost: number): number {
  if (cost === 0) return 0;
  return ((revenue - cost) / cost) * 100;
}

// Calculate CTR
export function calculateCTR(clicks: number, impressions: number): number {
  if (impressions === 0) return 0;
  return (clicks / impressions) * 100;
}

// Calculate EPC (Earnings Per Click)
export function calculateEPC(revenue: number, clicks: number): number {
  if (clicks === 0) return 0;
  return revenue / clicks;
}

// Sanitize user input
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 1000);
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate URL
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Sleep utility
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Deep clone
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Group by key
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    result[groupKey] = result[groupKey] || [];
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}

// Debounce
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}
