/**
 * 类型定义文件
 */

// ============================================
// 数据库模型类型
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  role: 'admin' | 'manager' | 'user';
  api_key: string | null;
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface ApiKey {
  id: string;
  user_id: string;
  key_hash: string;
  name: string | null;
  permissions: string[]; // ['read', 'write', 'admin']
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'traffic' | 'content' | 'push' | 'native';
  status: 'active' | 'paused' | 'deleted';
  traffic_source: string | null;
  traffic_source_id: string | null;
  distribution_type: 'weighted' | 'ab_test' | 'geo' | 'device';
  distribution_config: DistributionConfig | null;
  daily_budget: number | null;
  total_budget: number | null;
  budget_spent: number;
  start_date: string | null;
  end_date: string | null;
  attribution_window: number;
  click_id_param: string;
  tracking_code: string | null;
  postback_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: string;
  name: string;
  campaign_id: string | null;
  affiliate_network_id: string | null;
  external_offer_id: string | null;
  payout_type: 'cpa' | 'cpl' | 'cps' | 'revshare';
  payout_value: number;
  payout_currency: string;
  target_url: string;
  preview_url: string | null;
  status: 'active' | 'paused' | 'deleted';
  daily_cap: number | null;
  total_cap: number | null;
  current_daily_conversions: number;
  current_total_conversions: number;
  geo_targeting: string[] | null;
  device_targeting: DeviceTargeting | null;
  conversion_track_method: 'postback' | 'pixel' | 'iframe';
  created_at: string;
  updated_at: string;
}

export interface Lander {
  id: string;
  name: string;
  campaign_id: string | null;
  url: string;
  weight: number;
  status: 'active' | 'paused' | 'deleted';
  tracking_params: Record<string, string> | null;
  total_clicks: number;
  total_cost: number;
  created_at: string;
  updated_at: string;
}

export interface AffiliateNetwork {
  id: string;
  name: string;
  api_url: string | null;
  api_key: string | null;
  api_secret: string | null;
  postback_url: string | null;
  postback_params: Record<string, string> | null;
  status: 'active' | 'paused' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface Click {
  id: string;
  click_id: string;
  campaign_id: string;
  offer_id: string | null;
  lander_id: string | null;
  traffic_source: string | null;
  traffic_source_click_id: string | null;
  ip: string | null;
  user_agent: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  device_type: 'desktop' | 'mobile' | 'tablet' | null;
  os: string | null;
  os_version: string | null;
  browser: string | null;
  browser_version: string | null;
  referrer: string | null;
  landing_url: string | null;
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  sub4: string | null;
  sub5: string | null;
  sub6: string | null;
  sub7: string | null;
  sub8: string | null;
  sub9: string | null;
  sub10: string | null;
  clicked_at: string;
  created_at: string;
  date_partition: string;
}

export interface Conversion {
  id: string;
  conversion_id: string;
  click_id: string;
  campaign_id: string;
  offer_id: string | null;
  revenue: number;
  cost: number;
  profit: number;
  status: 'approved' | 'pending' | 'rejected' | 'duplicate';
  conversion_type: 'lead' | 'sale' | 'install' | 'signup';
  external_conversion_id: string | null;
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  sub4: string | null;
  sub5: string | null;
  converted_at: string;
  created_at: string;
  date_partition: string;
}

export interface Impression {
  id: string;
  impression_id: string;
  campaign_id: string;
  offer_id: string | null;
  lander_id: string | null;
  ip: string | null;
  user_agent: string | null;
  country: string | null;
  device_type: 'desktop' | 'mobile' | 'tablet' | null;
  impressed_at: string;
  created_at: string;
  date_partition: string;
}

export interface HourlyStats {
  id: string;
  campaign_id: string;
  offer_id: string | null;
  lander_id: string | null;
  stat_date: string;
  stat_hour: number;
  impressions: number;
  clicks: number;
  unique_clicks: number;
  conversions: number;
  approved_conversions: number;
  pending_conversions: number;
  rejected_conversions: number;
  revenue: number;
  cost: number;
  profit: number;
  country: string | null;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyStats {
  id: string;
  campaign_id: string;
  offer_id: string | null;
  lander_id: string | null;
  stat_date: string;
  impressions: number;
  clicks: number;
  unique_clicks: number;
  conversions: number;
  approved_conversions: number;
  pending_conversions: number;
  rejected_conversions: number;
  revenue: number;
  cost: number;
  profit: number;
  ctr: number;
  cvr: number;
  epc: number;
  cpc: number;
  roi: number;
  country: string | null;
  device_type: string | null;
  os: string | null;
  browser: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 配置类型
// ============================================

export interface DistributionConfig {
  type: 'weighted' | 'ab_test' | 'geo' | 'device';
  rules: DistributionRule[];
  offers: OfferDistribution[];
  landers: LanderDistribution[];
}

export interface DistributionRule {
  id: string;
  name: string;
  priority: number;
  conditions: RuleCondition[];
  action: RuleAction;
}

export interface RuleCondition {
  field: 'country' | 'device_type' | 'os' | 'browser' | 'isp';
  operator: 'equals' | 'not_equals' | 'in' | 'not_in';
  value: string | string[];
}

export interface RuleAction {
  type: 'offer' | 'lander' | 'redirect';
  target_id: string;
  weight?: number;
}

export interface OfferDistribution {
  offer_id: string;
  weight: number;
  active: boolean;
}

export interface LanderDistribution {
  lander_id: string;
  weight: number;
  active: boolean;
}

export interface DeviceTargeting {
  os?: string[];
  browser?: string[];
  device_type?: ('desktop' | 'mobile' | 'tablet')[];
}

// ============================================
// API 请求/响应类型
// ============================================

// 点击追踪
export interface TrackClickRequest {
  campaign_id: string;
  traffic_source?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;
  sub6?: string;
  sub7?: string;
  sub8?: string;
  sub9?: string;
  sub10?: string;
}

export interface TrackClickResponse {
  click_id: string;
  redirect_url: string;
  offer_id: string;
}

// Postback
export interface PostbackRequest {
  clickid: string;
  payout: number;
  status: 'approved' | 'pending' | 'rejected';
  txid?: string;
  sub1?: string;
  sub2?: string;
  sub3?: string;
  sub4?: string;
  sub5?: string;
}

export interface PostbackResponse {
  success: boolean;
  conversion_id?: string;
  message: string;
}

// 报表
export interface ReportQuery {
  start_date: string;
  end_date: string;
  campaign_ids?: string;
  offer_ids?: string;
  country?: string;
  device_type?: string;
  group_by?: 'date' | 'campaign' | 'offer' | 'country' | 'device';
}

export interface ReportRow {
  campaign_id?: string;
  campaign_name?: string;
  offer_id?: string;
  offer_name?: string;
  date?: string;
  country?: string;
  device_type?: string;
  impressions: number;
  clicks: number;
  unique_clicks: number;
  conversions: number;
  approved_conversions: number;
  pending_conversions: number;
  rejected_conversions: number;
  revenue: number;
  cost: number;
  profit: number;
  ctr: number;
  cvr: number;
  epc: number;
  cpc: number;
  roi: number;
}

export interface ReportResponse {
  data: ReportRow[];
  summary: ReportSummary;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface ReportSummary {
  total_impressions: number;
  total_clicks: number;
  total_unique_clicks: number;
  total_conversions: number;
  total_approved_conversions: number;
  total_pending_conversions: number;
  total_rejected_conversions: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  overall_ctr: number;
  overall_cvr: number;
  overall_epc: number;
  overall_cpc: number;
  overall_roi: number;
}

// 认证
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: Partial<User>;
  message?: string;
}

// ============================================
// Durable Objects 类型
// ============================================

export interface SessionState {
  clickId: string;
  campaignId: string;
  offerId: string | null;
  createdAt: number;
  expiresAt: number;
  attributes: {
    ip: string;
    userAgent: string;
    country: string;
    deviceType: string;
    os: string;
    browser: string;
  };
  conversions: Array<{
    conversionId: string;
    status: string;
    revenue: number;
    timestamp: number;
  }>;
}

export interface StatsState {
  currentHour: {
    hour: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    cost: number;
  };
  byCountry: Map<string, HourlyStats>;
  byDevice: Map<string, HourlyStats>;
  byOffer: Map<string, HourlyStats>;
  pendingFlush: Array<Partial<HourlyStats>>;
}

export interface RouterState {
  campaignId: string;
  config: DistributionConfig;
  distribution: {
    offerStats: Map<string, number>;
    landerStats: Map<string, number>;
  };
}

// ============================================
// 工具类型
// ============================================

export interface GeoInfo {
  country: string;
  region: string;
  city: string;
  isp: string;
}

export interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  os: string;
  osVersion: string;
  browser: string;
  browserVersion: string;
}

export interface ApiContext {
  user?: User;
  permissions: string[];
  ip: string;
  userAgent: string;
}

// ============================================
// 环境类型
// ============================================

export type Env = {
  DB: D1Database;
  SESSION_MANAGER: DurableObjectNamespace;
  STATS_AGGREGATOR: DurableObjectNamespace;
  TRAFFIC_ROUTER: DurableObjectNamespace;
  ENVIRONMENT: string;
  API_VERSION: string;
  LOG_LEVEL: string;
  JWT_SECRET: string;
  DEFAULT_DOMAIN?: string;
};
