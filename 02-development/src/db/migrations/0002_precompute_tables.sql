-- Migration: 0002_precompute_tables.sql
-- 创建预计算表结构，用于报表查询优化
-- 注意：这些表存储聚合数据，减少实时查询压力

-- 缓存存储表（L4缓存）
CREATE TABLE IF NOT EXISTS cache_store (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_expires ON cache_store(expires_at);

-- 小时统计表（预计算）
CREATE TABLE IF NOT EXISTS hourly_stats (
  hour DATETIME NOT NULL,
  campaign_id INTEGER NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (hour, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_hourly_stats_hour ON hourly_stats(hour);
CREATE INDEX IF NOT EXISTS idx_hourly_stats_campaign ON hourly_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_hourly_stats_hour_campaign ON hourly_stats(hour, campaign_id);

-- 日统计表（预计算）
CREATE TABLE IF NOT EXISTS daily_stats (
  date DATE NOT NULL,
  campaign_id INTEGER NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (date, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
CREATE INDEX IF NOT EXISTS idx_daily_stats_campaign ON daily_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_daily_stats_date_campaign ON daily_stats(date, campaign_id);

-- 月统计表（预计算）
CREATE TABLE IF NOT EXISTS monthly_stats (
  month DATE NOT NULL, -- 存储每月第一天
  campaign_id INTEGER NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  unique_clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (month, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_monthly_stats_month ON monthly_stats(month);
CREATE INDEX IF NOT EXISTS idx_monthly_stats_campaign ON monthly_stats(campaign_id);

-- 实时聚合表（内存表，用于快速查询）
CREATE TABLE IF NOT EXISTS realtime_aggregates (
  campaign_id INTEGER PRIMARY KEY,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  cost REAL NOT NULL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 维度统计表（用于多维分析）
CREATE TABLE IF NOT EXISTS dimension_stats (
  date DATE NOT NULL,
  campaign_id INTEGER NOT NULL,
  dimension_type TEXT NOT NULL, -- 'country', 'device', 'os', 'browser', 'source'
  dimension_value TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (date, campaign_id, dimension_type, dimension_value)
);

CREATE INDEX IF NOT EXISTS idx_dimension_stats_date ON dimension_stats(date);
CREATE INDEX IF NOT EXISTS idx_dimension_stats_campaign ON dimension_stats(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dimension_stats_type ON dimension_stats(dimension_type);

-- 预计算任务日志表
CREATE TABLE IF NOT EXISTS precompute_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_name TEXT NOT NULL,
  status TEXT NOT NULL, -- 'running', 'completed', 'failed'
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  records_processed INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_precompute_logs_task ON precompute_logs(task_name);
CREATE INDEX IF NOT EXISTS idx_precompute_logs_status ON precompute_logs(status);
