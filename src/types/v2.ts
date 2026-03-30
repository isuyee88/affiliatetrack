/**
 * 扩展类型定义文件 V2
 * 基于 Keitaro 功能对标
 */

// ============================================
// 基础配置类型
// ============================================

export interface Domain {
  id: string;
  name: string;
  type: 'tracker' | 'landing' | 'both';
  ssl_enabled: boolean;
  ssl_auto_renew: boolean;
  ssl_expires_at: string | null;
  is_default: boolean;
  status: 'active' | 'pending' | 'error';
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  entity_type: 'campaign' | 'offer' | 'landing' | 'traffic_source' | 'affiliate_network';
  position: number;
  color: string;
  created_at: string;
}

// ============================================
// 流量源类型
// ============================================

export interface TrafficSourceParameter {
  alias: string;      // 参数别名, 如 sub1
  name: string;       // 参数名, 如 utm_source
  macro: string;      // 宏, 如 {source}
}

export interface TrafficSource {
  id: string;
  name: string;
  template: string | null;
  parameters: TrafficSourceParameter[];
  s2s_postback: string | null;
  s2s_postback_params: Record<string, string> | null;
  send_only_status: boolean;
  cost_parameter: string | null;
  cost_token: string | null;
  revenue_parameter: string | null;
  revenue_token: string | null;
  click_id_parameter: string;
  notes: string | null;
  status: 'active' | 'paused' | 'deleted';
  created_at: string;
  updated_at: string;
  
  // 统计字段
  total_clicks?: number;
  total_cost?: number;
  total_conversions?: number;
  total_revenue?: number;
  total_profit?: number;
  roi?: number;
  epc?: number;
  cpc?: number;
}

export interface TrafficSourceTemplate {
  id: string;
  name: string;
  parameters: TrafficSourceParameter[];
  postback_url: string | null;
  postback_params: Record<string, string> | null;
  description: string | null;
  created_at: string;
}

// ============================================
// 联盟网络类型
// ============================================

export interface AffiliateNetworkParameter {
  param: string;      // 参数名
  macro: string;      // 宏, 如 {subid}
}

export interface AffiliateNetworkV2 {
  id: string;
  name: string;
  template: string | null;
  offer_parameters: AffiliateNetworkParameter[];
  postback_url: string | null;
  postback_params: AffiliateNetworkParameter[];
  macros: string[];
  append_click_id: boolean;
  click_id_macro: string;
  status_macro: string;
  payout_macro: string;
  transaction_id_macro: string;
  notes: string | null;
  status: 'active' | 'paused' | 'deleted';
  created_at: string;
  updated_at: string;
  
  // 统计字段
  offers_count?: number;
  total_clicks?: number;
  total_conversions?: number;
  total_revenue?: number;
  total_profit?: number;
  roi?: number;
  epc?: number;
  cpc?: number;
}

// ============================================
// Flow 和 Stream 类型
// ============================================

export interface FlowSchema {
  type: 'split' | 'redirect' | 'action';
  landings: Array<{ id: string; weight: number }>;
  offers: Array<{ id: string; weight: number }>;
  redirect_url?: string;
  action_type?: string;
}

export interface Flow {
  id: string;
  campaign_id: string;
  name: string;
  type: 'forced' | 'regular' | 'default';
  position: number;
  weight: number;
  collect_clicks: boolean;
  schema_type: string;
  schema_config: FlowSchema | null;
  status: 'active' | 'paused' | 'deleted';
  
  // 统计
  total_clicks: number;
  total_unique_clicks: number;
  total_bots: number;
  
  // 过滤器
  filters?: FlowFilter[];
  streams?: Stream[];
  
  created_at: string;
  updated_at: string;
}

export interface FlowFilter {
  id: string;
  flow_id: string;
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in' | 'contains' | 'regex' | 'between' | 'empty' | 'not_empty';
  value: string | string[] | { from: string; to: string };
  logic: 'and' | 'or';
  position: number;
  created_at: string;
}

export interface Stream {
  id: string;
  flow_id: string;
  type: 'landing_offer' | 'offer' | 'redirect' | 'action';
  
  // 关联
  landing_id: string | null;
  offer_id: string | null;
  
  // 重定向
  redirect_url: string | null;
  redirect_type: 'http' | 'meta' | 'js' | 'curl' | 'double_meta' | 'form_submit' | 'iframe';
  
  // 权重
  weight: number;
  position: number;
  
  status: 'active' | 'paused' | 'deleted';
  
  // 统计
  total_clicks: number;
  total_conversions: number;
  
  created_at: string;
  updated_at: string;
}

// ============================================
// Landing Page 类型 (更新版)
// ============================================

export interface LandingV2 {
  id: string;
  name: string;
  group_id: string | null;
  
  // 类型
  type: 'local' | 'redirect' | 'preload';
  
  // URL
  url: string | null;
  folder_path: string | null;
  
  // 追踪
  tracking_method: 'js_adapter' | 'kclient_php' | 'kclient_js' | 'none' | 'redirect';
  tracking_code: string | null;
  offer_link_code: string;
  
  // 域名
  domain_id: string | null;
  
  // 统计
  total_clicks: number;
  total_lp_clicks: number;
  lp_ctr: number;
  total_conversions: number;
  
  status: 'active' | 'paused' | 'deleted';
  
  created_at: string;
  updated_at: string;
}

// ============================================
// Offer 类型 (更新版)
// ============================================

export interface OfferV2 {
  id: string;
  name: string;
  group_id: string | null;
  affiliate_network_id: string | null;
  external_offer_id: string | null;
  
  // 类型
  type: 'local' | 'redirect' | 'preload';
  
  // URL
  target_url: string;
  preview_url: string | null;
  
  // Payout
  payout_type: 'cpa' | 'cpl' | 'cps' | 'revshare';
  payout_value: number;
  payout_currency: string;
  payout_auto: boolean;
  
  // 限制
  daily_cap: number | null;
  total_cap: number | null;
  current_daily_conversions: number;
  current_total_conversions: number;
  
  // 定向
  countries: string[] | null;
  device_targeting: DeviceTargetingV2 | null;
  
  // 追踪
  conversion_track_method: 'postback' | 'pixel' | 'iframe';
  postback_url: string | null;
  pixel_url: string | null;
  
  // Upsell
  allow_upsell: boolean;
  upsell_offer_id: string | null;
  
  status: 'active' | 'paused' | 'deleted';
  
  // 统计
  total_clicks: number;
  total_conversions: number;
  total_leads: number;
  total_sales: number;
  total_rejected: number;
  total_revenue: number;
  total_cost: number;
  
  notes: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface DeviceTargetingV2 {
  os?: string[];
  browser?: string[];
  device_type?: ('desktop' | 'mobile' | 'tablet')[];
}

// ============================================
// 点击和转化日志类型
// ============================================

export interface ClickLog {
  id: string;
  click_id: string;
  campaign_id: string;
  campaign_name?: string;
  flow_id: string | null;
  stream_id: string | null;
  offer_id: string | null;
  offer_name?: string;
  landing_id: string | null;
  landing_name?: string;
  
  ip: string | null;
  user_agent: string | null;
  
  country: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  isp: string | null;
  connection_type: string | null;
  
  device_type: string | null;
  os: string | null;
  os_version: string | null;
  browser: string | null;
  browser_version: string | null;
  
  referrer: string | null;
  keyword: string | null;
  
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  sub4: string | null;
  sub5: string | null;
  
  cost: number;
  
  is_bot: boolean;
  is_proxy: boolean;
  
  clicked_at: string;
  created_at: string;
}

export interface ConversionLog {
  id: string;
  conversion_id: string;
  click_id: string;
  campaign_id: string;
  campaign_name?: string;
  offer_id: string | null;
  offer_name?: string;
  
  revenue: number;
  cost: number;
  profit: number;
  
  status: 'approved' | 'pending' | 'rejected' | 'duplicate';
  conversion_type: string;
  
  external_conversion_id: string | null;
  transaction_id: string | null;
  
  sub1: string | null;
  sub2: string | null;
  sub3: string | null;
  
  converted_at: string;
  created_at: string;
}

// ============================================
// 系统配置类型
// ============================================

export interface BotList {
  id: string;
  name: string;
  type: 'user_agent' | 'ip' | 'ip_range';
  patterns: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IPList {
  id: string;
  name: string;
  type: 'blacklist' | 'whitelist';
  list_type: 'ip' | 'ip_range' | 'cidr';
  value: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ConversionTypeV2 {
  id: string;
  name: string;
  label: string;
  status_filter: 'approved' | 'pending' | 'rejected' | null;
  color: string;
  position: number;
  is_active: boolean;
  created_at: string;
}

// ============================================
// API 请求类型
// ============================================

export interface ClicksLogQuery {
  start_date: string;
  end_date: string;
  campaign_id?: string;
  offer_id?: string;
  landing_id?: string;
  country?: string;
  device_type?: string;
  is_bot?: boolean;
  is_proxy?: boolean;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ConversionsLogQuery {
  start_date: string;
  end_date: string;
  campaign_id?: string;
  offer_id?: string;
  status?: string;
  conversion_type?: string;
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// ============================================
// 过滤器字段定义
// ============================================

export const FILTER_FIELDS = {
  // 地理
  country: { label: 'Country', type: 'select' },
  city: { label: 'City', type: 'text' },
  region: { label: 'Region', type: 'text' },
  
  // 设备
  device_type: { label: 'Device Type', type: 'select', options: ['desktop', 'mobile', 'tablet'] },
  os: { label: 'OS', type: 'text' },
  os_version: { label: 'OS Version', type: 'text' },
  browser: { label: 'Browser', type: 'text' },
  browser_version: { label: 'Browser Version', type: 'text' },
  
  // 网络
  ip: { label: 'IP Address', type: 'text' },
  isp: { label: 'ISP', type: 'text' },
  connection_type: { label: 'Connection Type', type: 'select', options: ['dialup', 'mobile', 'cable'] },
  
  // 检测
  is_bot: { label: 'Is Bot', type: 'boolean' },
  is_proxy: { label: 'Is Proxy', type: 'boolean' },
  
  // 来源
  referrer: { label: 'Referrer', type: 'text' },
  keyword: { label: 'Keyword', type: 'text' },
  
  // 自定义参数
  sub1: { label: 'Sub ID 1', type: 'text' },
  sub2: { label: 'Sub ID 2', type: 'text' },
  sub3: { label: 'Sub ID 3', type: 'text' },
  sub4: { label: 'Sub ID 4', type: 'text' },
  sub5: { label: 'Sub ID 5', type: 'text' },
  
  // 时间
  clicked_at: { label: 'Click Time', type: 'datetime' },
  converted_at: { label: 'Conversion Time', type: 'datetime' },
  
  // 唯一性
  uniqueness_campaign: { label: 'Unique (Campaign)', type: 'boolean' },
  uniqueness_flow: { label: 'Unique (Flow)', type: 'boolean' },
  uniqueness_global: { label: 'Unique (Global)', type: 'boolean' },
} as const;

export const REDIRECT_TYPES = [
  { value: 'http', label: 'HTTP Redirect (302)' },
  { value: 'meta', label: 'Meta Refresh' },
  { value: 'js', label: 'JavaScript Redirect' },
  { value: 'curl', label: 'CURL (Server-side)' },
  { value: 'double_meta', label: 'Double Meta Redirect' },
  { value: 'form_submit', label: 'Form Submit' },
  { value: 'iframe', label: 'Open in iframe' },
] as const;

export const COST_MODELS = [
  { value: 'cpc', label: 'CPC (Cost per Click)' },
  { value: 'cpm', label: 'CPM (Cost per Mille)' },
  { value: 'cpa', label: 'CPA (Cost per Action)' },
  { value: 'revshare', label: 'RevShare (Revenue Share)' },
  { value: 'auto', label: 'Auto (From Postback)' },
] as const;

export const UNIQUENESS_MODES = [
  { value: 'ip_ua', label: 'IP + User-Agent' },
  { value: 'ip', label: 'IP Only' },
  { value: 'parameter', label: 'Parameter' },
  { value: 'cookie', label: 'Cookie' },
] as const;

export const FLOW_TYPES = [
  { value: 'forced', label: 'Forced Flow (Highest Priority)' },
  { value: 'regular', label: 'Regular Flow' },
  { value: 'default', label: 'Default Flow (Fallback)' },
] as const;
