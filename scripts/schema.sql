-- ============================================
-- AffiliateTrack Database Schema
-- Version: 1.0.0
-- Compatible with: Cloudflare D1 (SQLite)
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
    role TEXT DEFAULT 'user',
    api_key TEXT UNIQUE,
    status TEXT DEFAULT 'active',
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
    permissions TEXT,
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 广告活动管理表
-- ============================================

-- 广告活动表
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'traffic',
    status TEXT DEFAULT 'active',
    traffic_source TEXT,
    traffic_source_id TEXT,
    distribution_type TEXT DEFAULT 'weighted',
    distribution_config TEXT,
    daily_budget REAL,
    total_budget REAL,
    budget_spent REAL DEFAULT 0,
    start_date TEXT,
    end_date TEXT,
    attribution_window INTEGER DEFAULT 86400,
    click_id_param TEXT DEFAULT 'clickid',
    tracking_code TEXT,
    postback_url TEXT,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Offer 表
CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    campaign_id TEXT,
    affiliate_network_id TEXT,
    external_offer_id TEXT,
    payout_type TEXT DEFAULT 'cpa',
    payout_value REAL NOT NULL,
    payout_currency TEXT DEFAULT 'USD',
    target_url TEXT NOT NULL,
    preview_url TEXT,
    status TEXT DEFAULT 'active',
    daily_cap INTEGER,
    total_cap INTEGER,
    current_daily_conversions INTEGER DEFAULT 0,
    current_total_conversions INTEGER DEFAULT 0,
    geo_targeting TEXT,
    device_targeting TEXT,
    conversion_track_method TEXT DEFAULT 'postback',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (affiliate_network_id) REFERENCES affiliate_networks(id) ON DELETE SET NULL
);

-- 落地页表
CREATE TABLE IF NOT EXISTS landers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    campaign_id TEXT,
    url TEXT NOT NULL,
    weight INTEGER DEFAULT 100,
    status TEXT DEFAULT 'active',
    tracking_params TEXT,
    total_clicks INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- 联盟网络表
CREATE TABLE IF NOT EXISTS affiliate_networks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_url TEXT,
    api_key TEXT,
    api_secret TEXT,
    postback_url TEXT,
    postback_params TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 追踪数据表
-- ============================================

-- 点击表
CREATE TABLE IF NOT EXISTS clicks (
    id TEXT PRIMARY KEY,
    click_id TEXT UNIQUE NOT NULL,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    lander_id TEXT,
    traffic_source TEXT,
    traffic_source_click_id TEXT,
    ip TEXT,
    user_agent TEXT,
    country TEXT,
    region TEXT,
    city TEXT,
    isp TEXT,
    device_type TEXT,
    os TEXT,
    os_version TEXT,
    browser TEXT,
    browser_version TEXT,
    referrer TEXT,
    landing_url TEXT,
    sub1 TEXT,
    sub2 TEXT,
    sub3 TEXT,
    sub4 TEXT,
    sub5 TEXT,
    sub6 TEXT,
    sub7 TEXT,
    sub8 TEXT,
    sub9 TEXT,
    sub10 TEXT,
    clicked_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    date_partition TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL
);

-- 转化表
CREATE TABLE IF NOT EXISTS conversions (
    id TEXT PRIMARY KEY,
    conversion_id TEXT UNIQUE NOT NULL,
    click_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    revenue REAL NOT NULL,
    cost REAL DEFAULT 0,
    profit REAL,
    status TEXT DEFAULT 'approved',
    conversion_type TEXT DEFAULT 'lead',
    external_conversion_id TEXT,
    sub1 TEXT,
    sub2 TEXT,
    sub3 TEXT,
    sub4 TEXT,
    sub5 TEXT,
    converted_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    date_partition TEXT,
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
    lander_id TEXT,
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
    offer_id TEXT,
    lander_id TEXT,
    stat_date TEXT NOT NULL,
    stat_hour INTEGER NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    approved_conversions INTEGER DEFAULT 0,
    pending_conversions INTEGER DEFAULT 0,
    rejected_conversions INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    cost REAL DEFAULT 0,
    profit REAL DEFAULT 0,
    country TEXT,
    device_type TEXT,
    os TEXT,
    browser TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(campaign_id, offer_id, lander_id, stat_date, stat_hour, country, device_type)
);

-- 日统计汇总表
CREATE TABLE IF NOT EXISTS daily_stats (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    lander_id TEXT,
    stat_date TEXT NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    approved_conversions INTEGER DEFAULT 0,
    pending_conversions INTEGER DEFAULT 0,
    rejected_conversions INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    cost REAL DEFAULT 0,
    profit REAL DEFAULT 0,
    ctr REAL DEFAULT 0,
    cvr REAL DEFAULT 0,
    epc REAL DEFAULT 0,
    cpc REAL DEFAULT 0,
    roi REAL DEFAULT 0,
    country TEXT,
    device_type TEXT,
    os TEXT,
    browser TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(campaign_id, offer_id, lander_id, stat_date, country, device_type)
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

-- 转化表索引
CREATE INDEX IF NOT EXISTS idx_conversions_click_id ON conversions(click_id);
CREATE INDEX IF NOT EXISTS idx_conversions_campaign_id ON conversions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_conversions_date_partition ON conversions(date_partition);

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
    ('system_version', '1.0.0', '系统版本'),
    ('default_timezone', 'UTC', '默认时区'),
    ('default_currency', 'USD', '默认货币'),
    ('click_expiration', '86400', '点击有效期(秒)'),
    ('attribution_window', '86400', '归因窗口(秒)'),
    ('max_postback_retries', '3', 'Postback最大重试次数'),
    ('rate_limit_requests', '1000', 'API速率限制(请求/分钟)');

-- 创建默认管理员账户 (密码: admin123)
-- 注意: 实际部署时请修改密码
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, status) VALUES
    ('usr_admin', 'admin@affiliatetrack.local', 
     '240be518fabd2724ddb6f04eeb9d5b041d15d4e7d8b3c8e4d8e7c8b3c8e4d8e7', 
     'Administrator', 'admin', 'active');
