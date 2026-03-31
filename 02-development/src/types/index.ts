import type { D1Database } from '@cloudflare/workers-types';

export interface Env {
  // D1 Database
  DB: D1Database;
  
  // Durable Objects
  RATE_LIMITER: DurableObjectNamespace;
  SESSION_STORE: DurableObjectNamespace;
  REALTIME_AGGREGATOR: DurableObjectNamespace;
  
  // R2 Storage
  STORAGE: R2Bucket;
  
  // KV Cache
  CACHE: KVNamespace;
  
  // Environment variables
  ENVIRONMENT: string;
  API_VERSION: string;
  CORS_ORIGIN: string;
  
  // Secrets
  JWT_SECRET: string;
  ENCRYPTION_KEY: string;
  POSTBACK_SECRET: string;
}

// User types
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user' | 'viewer';
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

// Campaign types
export interface Campaign {
  id: number;
  name: string;
  slug: string;
  type: 'redirect' | 'flow';
  userId: number;
  domainId?: number;
  flowId?: number;
  offerId?: number;
  url?: string;
  trafficSourceId?: number;
  settings?: Record<string, unknown>;
  status: 'active' | 'paused' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

// Flow types
export interface Flow {
  id: number;
  name: string;
  userId: number;
  type: 'simple' | 'advanced';
  rules: FlowRule[];
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface FlowRule {
  id: string;
  name: string;
  weight: number;
  conditions?: RuleCondition[];
  target: {
    type: 'offer' | 'landing' | 'url';
    id?: number;
    url?: string;
  };
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'gt' | 'lt' | 'gte' | 'lte';
  value: string | string[] | number;
}

// Offer types
export interface Offer {
  id: number;
  name: string;
  url: string;
  payout: number;
  currency: string;
  networkId?: number;
  userId: number;
  status: 'active' | 'paused' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

// Click types
export interface Click {
  id: number;
  clickId: string;
  campaignId: number;
  flowId?: number;
  offerId?: number;
  ip: string;
  country?: string;
  region?: string;
  city?: string;
  device?: string;
  os?: string;
  osVersion?: string;
  browser?: string;
  browserVersion?: string;
  source?: string;
  medium?: string;
  referrer?: string;
  params?: Record<string, string>;
  createdAt: Date;
}

// Conversion types
export interface Conversion {
  id: number;
  clickId: string;
  revenue: number;
  cost: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  transactionId?: string;
  createdAt: Date;
}

// Tracking types
export interface TrackingParams {
  campaignSlug: string;
  query: Record<string, string>;
  headers: Headers;
}

export interface TrackingResult {
  clickId: string;
  redirectUrl: string;
  method: '302' | 'js' | 'meta';
}

// Report types
export interface ReportQuery {
  from: Date;
  to: Date;
  campaignId?: number;
  flowId?: number;
  offerId?: number;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  dimensions?: string[];
}

export interface ReportData {
  date: string;
  clicks: number;
  uniqueClicks: number;
  conversions: number;
  revenue: number;
  cost: number;
  profit: number;
  roi: number;
  ctr: number;
  epc: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Filter types
export interface FilterParams {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
}
