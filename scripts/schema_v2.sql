-- ============================================
-- AffiliateTrack Database Schema V2
-- Version: 2.0.0
-- Compatible with: Cloudflare D1 (SQLite)
-- Based on: Keitaro Tracker Features
-- ============================================

-- ============================================
-- 用户与权限表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user', -- admin, manager, user
    api_key TEXT UNIQUE,
    status TEXT DEFAULT 'active', -- active, suspended, deleted
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
);

-- API 密钥表
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT,
    permissions TEXT, -- JSON: ["read", "write", "admin"]
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 基础配置表
-- ============================================

-- 域名表
CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    type TEXT DEFAULT 'tracker', -- tracker, landing, both
    ssl_enabled INTEGER DEFAULT 0,
    ssl_auto_renew INTEGER DEFAULT 0,
    ssl_expires_at TEXT,
    is_default INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active', -- active, pending, error
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 分组表
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL, -- campaign, offer, landing, traffic_source, affiliate_network
    position INTEGER DEFAULT 0,
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 流量源模板表
-- ============================================

-- 流量源表
CREATE TABLE IF NOT EXISTS traffic_sources (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    template TEXT, -- 预设模板名称 (Facebook, Google Ads, etc.)
    parameters TEXT, -- JSON: [{alias, name, macro}]
    s2s_postback TEXT, -- S2S Postback URL 模板
    s2s_postback_params TEXT, -- JSON: 参数配置
    send_only_status INTEGER DEFAULT 0, -- 仅发送状态
    cost_parameter TEXT, -- 成本参数名
    cost_token TEXT, -- 成本 Token
    revenue_parameter TEXT, -- 收入参数名
    revenue_token TEXT, -- 收入 Token
    click_id_parameter TEXT DEFAULT 'clickid',
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 流量源预设参数模板
CREATE TABLE IF NOT EXISTS traffic_source_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    parameters TEXT, -- JSON
    postback_url TEXT,
    postback_params TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 联盟网络模板表
-- ============================================

-- 联盟网络表 (更新版)
CREATE TABLE IF NOT EXISTS affiliate_networks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    template TEXT, -- 预设模板名称
    offer_parameters TEXT, -- JSON: [{param, macro}] 用于传递 clickid
    postback_url TEXT, -- Postback URL 模板
    postback_params TEXT, -- JSON: [{param, macro}]
    macros TEXT, -- JSON: 支持的宏列表
    append_click_id INTEGER DEFAULT 1, -- 自动追加 clickid
    click_id_macro TEXT DEFAULT '{subid}',
    status_macro TEXT DEFAULT '{status}',
    payout_macro TEXT DEFAULT '{amount}',
    transaction_id_macro TEXT DEFAULT '{transaction_id}',
    notes TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 联盟网络预设模板
CREATE TABLE IF NOT EXISTS affiliate_network_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    offer_parameters TEXT, -- JSON
    postback_url TEXT,
    postback_params TEXT,
    macros TEXT, -- JSON
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 广告活动管理表 (更新版)
-- ============================================

-- 广告活动表
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    alias TEXT UNIQUE NOT NULL, -- 短链接代码 如 "6D5NTB"
    group_id TEXT,
    domain_id TEXT,
    traffic_source_id TEXT,
    
    -- 流量分发配置
    flow_rotation TEXT DEFAULT 'position', -- position, weight
    traffic_loss REAL DEFAULT 0, -- 流量损失百分比
    
    -- 唯一性设置
    uniqueness_mode TEXT DEFAULT 'ip_ua', -- ip_ua, ip, parameter, cookie
    uniqueness_ttl INTEGER DEFAULT 24, -- 小时
    
    -- 成本配置
    cost_model TEXT DEFAULT 'cpc', -- cpc, cpm, cpa, revshare, auto
    cost_value REAL DEFAULT 0,
    cost_currency TEXT DEFAULT 'USD',
    cost_from_parameter INTEGER DEFAULT 1, -- 从参数获取成本
    
    -- 预算控制
    daily_budget REAL,
    total_budget REAL,
    budget_spent REAL DEFAULT 0,
    
    -- 时间控制
    start_date TEXT,
    end_date TEXT,
    
    -- 归因设置
    attribution_window INTEGER DEFAULT 86400, -- 秒
    
    -- 追踪代码
    tracking_code TEXT,
    tracking_method TEXT DEFAULT 'redirect', -- redirect, iframe, local
    
    -- API Token
    api_token TEXT UNIQUE,
    
    -- 状态
    status TEXT DEFAULT 'active', -- active, paused, deleted
    
    -- 审计
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL,
    FOREIGN KEY (traffic_source_id) REFERENCES traffic_sources(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- Flows 和 Streams 表
-- ============================================

-- Flow 表 (流量流程)
CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    name TEXT,
    type TEXT DEFAULT 'regular', -- forced, regular, default
    position INTEGER DEFAULT 0,
    weight INTEGER DEFAULT 100,
    collect_clicks INTEGER DEFAULT 1,
    
    -- 方案配置
    schema_type TEXT DEFAULT 'split', -- split, redirect, action
    schema_config TEXT, -- JSON: 分流配置
    
    -- 状态
    status TEXT DEFAULT 'active',
    
    -- 统计
    total_clicks INTEGER DEFAULT 0,
    total_unique_clicks INTEGER DEFAULT 0,
    total_bots INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Stream 表 (流量流)
CREATE TABLE IF NOT EXISTS streams (
    id TEXT PRIMARY KEY,
    flow_id TEXT NOT NULL,
    
    -- 类型
    type TEXT DEFAULT 'landing_offer', -- landing_offer, offer, redirect, action
    
    -- 关联
    landing_id TEXT,
    offer_id TEXT,
    
    -- 重定向配置
    redirect_url TEXT,
    redirect_type TEXT DEFAULT 'http', -- http, meta, js, curl, double_meta, form_submit
    
    -- 权重和位置
    weight INTEGER DEFAULT 100,
    position INTEGER DEFAULT 0,
    
    -- 状态
    status TEXT DEFAULT 'active',
    
    -- 统计
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE,
    FOREIGN KEY (landing_id) REFERENCES landings(id) ON DELETE SET NULL,
    FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL
);

-- ============================================
-- 过滤器表
-- ============================================

-- Flow 过滤器
CREATE TABLE IF NOT EXISTS flow_filters (
    id TEXT PRIMARY KEY,
    flow_id TEXT NOT NULL,
    
    -- 过滤条件
    field TEXT NOT NULL, -- country, device_type, os, browser, ip, etc.
    operator TEXT DEFAULT 'equals', -- equals, not_equals, in, not_in, contains, regex, between
    value TEXT, -- JSON 或单个值
    
    -- 逻辑
    logic TEXT DEFAULT 'and', -- and, or
    
    position INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
);

-- ============================================
-- Landing Pages 表 (更新版)
-- ============================================

-- 落地页表
CREATE TABLE IF NOT EXISTS landings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_id TEXT,
    
    -- 类型
    type TEXT DEFAULT 'redirect', -- local, redirect, preload
    
    -- URL 配置
    url TEXT,
    folder_path TEXT, -- 本地路径
    
    -- 追踪代码配置
    tracking_method TEXT DEFAULT 'redirect', -- js_adapter, kclient_php, kclient_js, none
    tracking_code TEXT,
    
    -- Offer 链接代码
    offer_link_code TEXT DEFAULT '{offer}',
    
    -- 域名
    domain_id TEXT,
    
    -- 统计
    total_clicks INTEGER DEFAULT 0,
    total_lp_clicks INTEGER DEFAULT 0,
    lp_ctr REAL DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    
    -- 状态
    status TEXT DEFAULT 'active', -- active, paused, deleted
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);

-- ============================================
-- Offers 表 (更新版)
-- ============================================

-- Offer 表
CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    group_id TEXT,
    affiliate_network_id TEXT,
    external_offer_id TEXT,
    
    -- 类型
    type TEXT DEFAULT 'redirect', -- local, redirect, preload
    
    -- URL
    target_url TEXT NOT NULL,
    preview_url TEXT,
    
    -- Payout 配置
    payout_type TEXT DEFAULT 'cpa', -- cpa, cpl, cps, revshare
    payout_value REAL DEFAULT 0,
    payout_currency TEXT DEFAULT 'USD',
    payout_auto INTEGER DEFAULT 0, -- 从 Postback 自动获取
    
    -- 限制
    daily_cap INTEGER,
    total_cap INTEGER,
    current_daily_conversions INTEGER DEFAULT 0,
    current_total_conversions INTEGER DEFAULT 0,
    
    -- 定向
    countries TEXT, -- JSON: ["US", "UK", "CA"]
    device_targeting TEXT, -- JSON: {"os": [], "browser": [], "device_type": []}
    
    -- 追踪配置
    conversion_track_method TEXT DEFAULT 'postback', -- postback, pixel, iframe
    postback_url TEXT,
    pixel_url TEXT,
    
    -- 允许 Upsell
    allow_upsell INTEGER DEFAULT 0,
    upsell_offer_id TEXT,
    
    -- 状态
    status TEXT DEFAULT 'active', -- active, paused, deleted
    
    -- 统计
    total_clicks INTEGER DEFAULT 0,
    total_conversions INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    total_rejected INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0,
    total_cost REAL DEFAULT 0,
    
    -- 备注
    notes TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (affiliate_network_id) REFERENCES affiliate_networks(id) ON DELETE SET NULL
);

-- ============================================
-- 追踪数据表 (更新版)
-- ============================================

-- 点击表
CREATE TABLE IF NOT EXISTS clicks (
    id TEXT PRIMARY KEY,
    click_id TEXT UNIQUE NOT NULL,
    
    -- 关联
    campaign_id TEXT NOT NULL,
    flow_id TEXT,
    stream_id TEXT,
    offer_id TEXT,
    landing_id TEXT,
    traffic_source_id TEXT,
    
    -- 流量源信息
    traffic_source TEXT,
    traffic_source_click_id TEXT,
    
    -- 网络
    ip TEXT,
    ipv6 TEXT,
    user_agent TEXT,
    
    -- 地理
    country TEXT,
    country_code TEXT,
    region TEXT,
    city TEXT,
    city_id INTEGER,
    isp TEXT,
    isp_id INTEGER,
    connection_type TEXT, -- dialup, mobile, cable
    mobile_operator TEXT,
    
    -- 设备
    device_type TEXT, -- desktop, mobile, tablet
    device_model TEXT,
    device_brand TEXT,
    os TEXT,
    os_version TEXT,
    browser TEXT,
    browser_version TEXT,
    browser_language TEXT,
    screen_resolution TEXT,
    
    -- 来源
    referrer TEXT,
    referrer_domain TEXT,
    landing_url TEXT,
    keyword TEXT,
    
    -- 自定义参数 (Sub ID 1-30)
    sub1 TEXT, sub2 TEXT, sub3 TEXT, sub4 TEXT, sub5 TEXT,
    sub6 TEXT, sub7 TEXT, sub8 TEXT, sub9 TEXT, sub10 TEXT,
    sub11 TEXT, sub12 TEXT, sub13 TEXT, sub14 TEXT, sub15 TEXT,
    sub16 TEXT, sub17 TEXT, sub18 TEXT, sub19 TEXT, sub20 TEXT,
    sub21 TEXT, sub22 TEXT, sub23 TEXT, sub24 TEXT, sub25 TEXT,
    sub26 TEXT, sub27 TEXT, sub28 TEXT, sub29 TEXT, sub30 TEXT,
    
    -- 成本
    cost REAL DEFAULT 0,
    
    -- 检测
    is_bot INTEGER DEFAULT 0,
    is_proxy INTEGER DEFAULT 0,
    is_unique_campaign INTEGER DEFAULT 1,
    is_unique_flow INTEGER DEFAULT 1,
    is_unique_global INTEGER DEFAULT 1,
    
    -- 时间
    clicked_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    date_partition TEXT, -- YYYY-MM-DD
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE SET NULL,
    FOREIGN KEY (stream_id) REFERENCES streams(id) ON DELETE SET NULL,
    FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL,
    FOREIGN KEY (landing_id) REFERENCES landings(id) ON DELETE SET NULL
);

-- 转化表
CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    conversion_id TEXT UNIQUE NOT NULL,
    
    -- 关联
    click_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    flow_id TEXT,
    stream_id TEXT,
    offer_id TEXT,
    landing_id TEXT,
    
    -- 金额
    revenue REAL NOT NULL,
    cost REAL DEFAULT 0,
    profit REAL,
    
    -- 状态
    status TEXT DEFAULT 'approved', -- approved, pending, rejected, duplicate
    conversion_type TEXT DEFAULT 'lead', -- lead, sale, signup, install, rebill
    
    -- 外部信息
    external_conversion_id TEXT,
    external_click_id TEXT,
    transaction_id TEXT,
    
    -- 自定义参数
    sub1 TEXT, sub2 TEXT, sub3 TEXT, sub4 TEXT, sub5 TEXT,
    
    -- 时间
    converted_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    date_partition TEXT, -- YYYY-MM-DD
    
    FOREIGN KEY (click_id) REFERENCES clicks(click_id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL
);

-- 展示表
CREATE TABLE IF NOT EXISTS impressions (
    id TEXT PRIMARY KEY,
    impression_id TEXT UNIQUE NOT NULL,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    landing_id TEXT,
    ip TEXT,
    user_agent TEXT,
    country TEXT,
    device_type TEXT,
    impressed_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    date_partition TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- ============================================
-- 报表与统计表
-- ============================================

-- 小时统计汇总表
CREATE TABLE IF NOT EXISTS hourly_stats (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    flow_id TEXT,
    stream_id TEXT,
    offer_id TEXT,
    landing_id TEXT,
    traffic_source_id TEXT,
    affiliate_network_id TEXT,
    
    stat_date TEXT NOT NULL,
    stat_hour INTEGER NOT NULL,
    
    -- 流量指标
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    unique_clicks_global INTEGER DEFAULT 0,
    bots INTEGER DEFAULT 0,
    proxies INTEGER DEFAULT 0,
    
    -- 转化指标
    conversions INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    approved_conversions INTEGER DEFAULT 0,
    pending_conversions INTEGER DEFAULT 0,
    rejected_conversions INTEGER DEFAULT 0,
    
    -- 财务指标
    revenue REAL DEFAULT 0,
    cost REAL DEFAULT 0,
    profit REAL DEFAULT 0,
    
    -- 维度
    country TEXT,
    device_type TEXT,
    os TEXT,
    browser TEXT,
    connection_type TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(campaign_id, flow_id, stream_id, offer_id, landing_id, stat_date, stat_hour, country, device_type)
);

-- 日统计汇总表
CREATE TABLE IF NOT EXISTS daily_stats (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    flow_id TEXT,
    stream_id TEXT,
    offer_id TEXT,
    landing_id TEXT,
    traffic_source_id TEXT,
    affiliate_network_id TEXT,
    
    stat_date TEXT NOT NULL,
    
    -- 流量指标
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    unique_clicks_global INTEGER DEFAULT 0,
    bots INTEGER DEFAULT 0,
    proxies INTEGER DEFAULT 0,
    
    -- 转化指标
    conversions INTEGER DEFAULT 0,
    leads INTEGER DEFAULT 0,
    sales INTEGER DEFAULT 0,
    approved_conversions INTEGER DEFAULT 0,
    pending_conversions INTEGER DEFAULT 0,
    rejected_conversions INTEGER DEFAULT 0,
    
    -- 财务指标
    revenue REAL DEFAULT 0,
    cost REAL DEFAULT 0,
    profit REAL DEFAULT 0,
    
    -- 计算指标
    ctr REAL DEFAULT 0,
    cvr REAL DEFAULT 0,
    epc REAL DEFAULT 0,
    cpc REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    
    -- LP 指标
    lp_clicks INTEGER DEFAULT 0,
    lp_ctr REAL DEFAULT 0,
    
    -- 维度
    country TEXT,
    device_type TEXT,
    os TEXT,
    browser TEXT,
    connection_type TEXT,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(campaign_id, flow_id, stream_id, offer_id, landing_id, stat_date, country, device_type)
);

-- ============================================
-- 系统配置表
-- ============================================

-- 系统设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 机器人列表
CREATE TABLE IF NOT EXISTS bot_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'user_agent', -- user_agent, ip, ip_range
    patterns TEXT, -- JSON 数组
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- IP 黑白名单
CREATE TABLE IF NOT EXISTS ip_lists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'blacklist', -- blacklist, whitelist
    list_type TEXT DEFAULT 'ip', -- ip, ip_range, cidr
    value TEXT NOT NULL,
    notes TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 转化类型配置
CREATE TABLE IF NOT EXISTS conversion_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    label TEXT,
    status_filter TEXT, -- approved, pending, rejected
    color TEXT DEFAULT '#22c55e',
    position INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 自定义指标
CREATE TABLE IF NOT EXISTS custom_metrics (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    label TEXT,
    formula TEXT NOT NULL, -- 计算公式
    format TEXT DEFAULT 'number', -- number, currency, percent
    decimals INTEGER DEFAULT 2,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    old_value TEXT,
    new_value TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 创建索引
-- ============================================

-- 点击表索引
CREATE INDEX IF NOT EXISTS idx_clicks_campaign_id ON clicks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_clicks_click_id ON clicks(click_id);
CREATE INDEX IF NOT EXISTS idx_clicks_date_partition ON clicks(date_partition);
CREATE INDEX IF NOT EXISTS idx_clicks_campaign_date ON clicks(campaign_id, date_partition);
CREATE INDEX IF NOT EXISTS idx_clicks_flow_id ON clicks(flow_id);
CREATE INDEX IF NOT EXISTS idx_clicks_stream_id ON clicks(stream_id);
CREATE INDEX IF NOT EXISTS idx_clicks_country ON clicks(country);
CREATE INDEX IF NOT EXISTS idx_clicks_device_type ON clicks(device_type);

-- 转化表索引
CREATE INDEX IF NOT EXISTS idx_conversions_click_id ON conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conversions_campaign_id ON conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversions_date_partition ON conversions(date_partition);
CREATE INDEX IF NOT EXISTS idx_conversions_status ON conversions(status);

-- 流量流程索引
CREATE INDEX IF NOT EXISTS idx_flows_campaign_id ON flows(campaign_id);
CREATE INDEX IF NOT EXISTS idx_streams_flow_id ON streams(flow_id);

-- 统计表索引
CREATE INDEX IF NOT EXISTS idx_hourly_stats_date ON hourly_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(stat_date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_campaign ON daily_stats(campaign_id, stat_date);

-- ============================================
-- 初始数据
-- ============================================

-- 默认系统设置
INSERT OR IGNORE INTO settings (key, value, description) VALUES
    ('system_name', 'AffiliateTrack', '系统名称'),
    ('system_version', '2.0.0', '系统版本'),
    ('default_timezone', 'UTC', '默认时区'),
    ('default_currency', 'USD', '默认货币'),
    ('click_expiration', '86400', '点击有效期(秒)'),
    ('attribution_window', '86400', '归因窗口(秒)'),
    ('max_postback_retries', '3', 'Postback最大重试次数'),
    ('rate_limit_requests', '1000', 'API速率限制(请求/分钟)'),
    ('track_bots', '1', '是否追踪机器人'),
    ('track_proxies', '1', '是否追踪代理'),
    ('default_redirect_type', 'http', '默认重定向类型');

-- 默认域名
INSERT OR IGNORE INTO domains (id, name, type, is_default, status) VALUES
    ('domain_default', 'tracker.example.com', 'tracker', 1, 'active');

-- 默认转化类型
INSERT OR IGNORE INTO conversion_types (id, name, label, status_filter, color, position) VALUES
    ('conv_lead', 'lead', 'Lead', 'approved', '#3b82f6', 1),
    ('conv_sale', 'sale', 'Sale', 'approved', '#22c55e', 2),
    ('conv_signup', 'signup', 'Signup', 'approved', '#8b5cf6', 3),
    ('conv_install', 'install', 'Install', 'approved', '#f59e0b', 4),
    ('conv_rebill', 'rebill', 'Rebill', 'approved', '#ec4899', 5),
    ('conv_rejected', 'rejected', 'Rejected', 'rejected', '#ef4444', 6),
    ('conv_pending', 'pending', 'Pending', 'pending', '#f97316', 7);

-- 默认分组
INSERT OR IGNORE INTO groups (id, name, entity_type, color) VALUES
    ('group_default', 'Default', 'campaign', '#3b82f6');

-- 流量源预设模板
INSERT OR IGNORE INTO traffic_source_templates (id, name, parameters, description) VALUES
    ('ts_facebook', 'Facebook.com', '[{"alias":"sub1","name":"ad_id","macro":"{{ad.id}}"},{"alias":"sub2","name":"adset_id","macro":"{{adset.id}}"},{"alias":"sub3","name":"campaign_id","macro":"{{campaign.id}}"}]', 'Facebook Ads'),
    ('ts_google', 'Google Ads', '[{"alias":"sub1","name":"creative","macro":"{creative}"},{"alias":"sub2","name":"keyword","macro":"{keyword}"},{"alias":"sub3","name":"matchtype","macro":"{matchtype}"}]', 'Google Ads'),
    ('ts_propeller', 'PropellerAds', '[{"alias":"sub1","name":"campaignid","macro":"{campaignid}"},{"alias":"sub2","name":"zoneid","macro":"{zoneid}"}]', 'PropellerAds'),
    ('ts_mgid', 'MGID', '[{"alias":"sub1","name":"campaign_id","macro":"{campaign_id}"},{"alias":"sub2","name":"widget_id","macro":"{widget_id}"}]', 'MGID');

-- 联盟网络预设模板
INSERT OR IGNORE INTO affiliate_network_templates (id, name, offer_parameters, postback_params, macros, description) VALUES
    ('an_clickdealer', 'ClickDealer', '[{"param":"subid","macro":"{subid}"}]', '[{"param":"subid","macro":"{subid}"},{"param":"status","macro":"{status}"},{"param":"amount","macro":"{payout}"}]', '["{subid}","{status}","{payout}","{transaction_id}"]', 'ClickDealer Network'),
    ('an_maxbounty', 'MaxBounty', '[{"param":"subid","macro":"{subid}"}]', '[{"param":"subid","macro":"{subid}"},{"param":"status","macro":"{status}"},{"param":"amount","macro":"{payout}"}]', '["{subid}","{status}","{payout}"]', 'MaxBounty Network'),
    ('an_cpagrip', 'CPA Grip', '[{"param":"tracking_id","macro":"{subid}"}]', '[{"param":"tracking_id","macro":"{subid}"},{"param":"status","macro":"{status}"},{"param":"amount","macro":"{payout}"}]', '["{subid}","{status}","{payout}"]', 'CPA Grip Network');

-- 创建默认管理员账户 (密码: admin123)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, status) VALUES
    ('usr_admin', 'admin@affiliatetrack.local', 
     '240be518fabd2724ddb6f04eeb9d5b041d15d4e7d8b3c8e4d8e7c8b3c8e4d8e7', 
     'Administrator', 'admin', 'active');

-- 默认机器人列表
INSERT OR IGNORE INTO bot_lists (id, name, type, patterns, is_active) VALUES
    ('bot_googlebot', 'Googlebot', 'user_agent', '["Googlebot","Googlebot-Image","Googlebot-News","Googlebot-Video"]', 1),
    ('bot_bingbot', 'Bingbot', 'user_agent', '["bingbot","BingPreview"]', 1),
    ('bot_slurp', 'Yahoo Slurp', 'user_agent', '["Slurp"]', 1),
    ('bot_baiduspider', 'Baiduspider', 'user_agent', '["Baiduspider"]', 1),
    ('bot_yandex', 'Yandex', 'user_agent', '["YandexBot","YandexImages"]', 1),
    ('bot_facebook', 'Facebook', 'user_agent', '["facebookexternalhit","Facebot"]', 1),
    ('bot_twitter', 'Twitter', 'user_agent', '["Twitterbot"]', 1),
    ('bot_linkedin', 'LinkedIn', 'user_agent', '["LinkedInBot"]', 1),
    ('bot_pinterest', 'Pinterest', 'user_agent', '["Pinterest"]', 1),
    ('bot_generic', 'Generic Bots', 'user_agent', '["bot","crawler","spider","scraper","curl","wget","python-requests","httpclient","node-fetch"]', 1);
