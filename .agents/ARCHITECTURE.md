# AffiliateTrack 系统技术架构

## 1. 系统概览

### 1.1 技术选型

| 组件 | 技术选型 | 说明 |
|-----|---------|------|
| 运行时 | Cloudflare Workers | Edge 无服务器函数 |
| 数据库 | Cloudflare D1 | SQLite 边缘数据库 |
| 有状态服务 | Durable Objects | 分布式状态管理 |
| 前端 | React + Tailwind CSS | 管理后台 UI |
| API 风格 | RESTful + OpenAPI 3.0 | 标准 API 设计 |
| 认证 | JWT + API Key | 多种认证方式 |

### 1.2 系统架构图

```
                                    ┌─────────────────┐
                                    │   用户/流量源   │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
           │ 跟踪像素请求  │        │  点击跳转请求  │        │  Postback 请求 │
           │   /track.gif  │        │  /click/{id}  │        │  /postback    │
           └───────┬───────┘        └───────┬───────┘        └───────┬───────┘
                   │                        │                        │
                   └────────────────────────┼────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          Cloudflare Workers                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Router Worker                                │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Track API   │  │  Admin API   │  │  Report API  │              │   │
│  │  │  /track/*    │  │  /admin/*    │  │  /report/*   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│  ┌───────────────────────────────────┴─────────────────────────────────┐  │
│  │                      Durable Objects Cluster                         │  │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │  │
│  │  │ SessionManager │  │  StatsAggrega- │  │ TrafficRouter  │        │  │
│  │  │     DO         │  │     tor DO     │  │      DO        │        │  │
│  │  │ (会话状态)      │  │  (实时统计)    │  │  (流量分发)    │        │  │
│  │  └────────────────┘  └────────────────┘  └────────────────┘        │  │
│  └─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            Cloudflare D1 Database                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  campaigns  │ │   offers    │ │   clicks    │ │ conversions │          │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  landers    │ │aff_networks │ │   reports   │ │    users    │          │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                          │
│  │  api_keys   │ │   logs      │ │  settings   │                          │
│  └─────────────┘ └─────────────┘ └─────────────┘                          │
└──────────────────────────────────────────────────────────────────────────────┘
                                            │
                                            ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          管理后台 (React SPA)                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Dashboard  │ │  Campaigns  │ │   Offers    │ │   Reports   │          │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                          │
│  │   Users     │ │  Settings   │ │    Logs     │                          │
│  └─────────────┘ └─────────────┘ └─────────────┘                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 2. 数据库设计 (D1 Schema)

### 2.1 核心表结构

```sql
-- ============================================
-- 用户与权限表
-- ============================================

-- 用户表
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user', -- admin, manager, user
    api_key TEXT UNIQUE,
    status TEXT DEFAULT 'active', -- active, suspended, deleted
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
);

-- API 密钥表
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT,
    permissions TEXT, -- JSON: ["read", "write", "admin"]
    expires_at TEXT,
    last_used_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 广告活动管理表
-- ============================================

-- 广告活动表
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'traffic', -- traffic, content, push, native
    status TEXT DEFAULT 'active', -- active, paused, deleted
    traffic_source TEXT,
    traffic_source_id TEXT,
    
    -- 流量分发配置
    distribution_type TEXT DEFAULT 'weighted', -- weighted, ab_test, geo, device
    distribution_config TEXT, -- JSON
    
    -- 预算控制
    daily_budget REAL,
    total_budget REAL,
    budget_spent REAL DEFAULT 0,
    
    -- 时间控制
    start_date TEXT,
    end_date TEXT,
    
    -- 归因设置
    attribution_window INTEGER DEFAULT 86400, -- 秒，默认24小时
    click_id_param TEXT DEFAULT 'clickid',
    
    -- 追踪代码
    tracking_code TEXT,
    postback_url TEXT,
    
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Offer 表 (广告主/转化目标)
CREATE TABLE offers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    campaign_id TEXT,
    
    -- Offer 信息
    affiliate_network_id TEXT,
    external_offer_id TEXT,
    payout_type TEXT DEFAULT 'cpa', -- cpa, cpl, cps, revshare
    payout_value REAL NOT NULL,
    payout_currency TEXT DEFAULT 'USD',
    
    -- 目标 URL
    target_url TEXT NOT NULL,
    preview_url TEXT,
    
    -- 状态
    status TEXT DEFAULT 'active', -- active, paused, deleted
    
    -- 限制
    daily_cap INTEGER,
    total_cap INTEGER,
    current_daily_conversions INTEGER DEFAULT 0,
    current_total_conversions INTEGER DEFAULT 0,
    
    -- 地理限制
    geo_targeting TEXT, -- JSON: ["US", "UK", "CA"]
    device_targeting TEXT, -- JSON: {"os": ["windows", "mac"], "browser": ["chrome"]}
    
    -- 转化追踪
    conversion_track_method TEXT DEFAULT 'postback', -- postback, pixel, iframe
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (affiliate_network_id) REFERENCES affiliate_networks(id)
);

-- 落地页表
CREATE TABLE landers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    campaign_id TEXT,
    
    -- URL 配置
    url TEXT NOT NULL,
    
    -- 权重和限制
    weight INTEGER DEFAULT 100,
    status TEXT DEFAULT 'active',
    
    -- 追踪参数
    tracking_params TEXT, -- JSON: {"sub1": "value1"}
    
    -- 统计
    total_clicks INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- 联盟网络表
CREATE TABLE affiliate_networks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    
    -- API 配置
    api_url TEXT,
    api_key TEXT,
    api_secret TEXT,
    
    -- Postback 配置
    postback_url TEXT,
    postback_params TEXT, -- JSON
    
    -- 状态
    status TEXT DEFAULT 'active',
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 追踪数据表
-- ============================================

-- 点击表
CREATE TABLE clicks (
    id TEXT PRIMARY KEY,
    click_id TEXT UNIQUE NOT NULL,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    lander_id TEXT,
    
    -- 流量源信息
    traffic_source TEXT,
    traffic_source_click_id TEXT,
    
    -- 用户信息
    ip TEXT,
    user_agent TEXT,
    
    -- 地理信息
    country TEXT,
    region TEXT,
    city TEXT,
    isp TEXT,
    
    -- 设备信息
    device_type TEXT, -- desktop, mobile, tablet
    os TEXT,
    os_version TEXT,
    browser TEXT,
    browser_version TEXT,
    
    -- 来源信息
    referrer TEXT,
    landing_url TEXT,
    
    -- 自定义参数
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
    
    -- 时间戳
    clicked_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    
    -- 索引优化字段
    date_partition TEXT, -- YYYY-MM-DD
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (offer_id) REFERENCES offers(id)
);

-- 转化表
CREATE TABLE conversions (
    id TEXT PRIMARY KEY,
    conversion_id TEXT UNIQUE NOT NULL,
    click_id TEXT NOT NULL,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    
    -- 转化信息
    revenue REAL NOT NULL,
    cost REAL DEFAULT 0,
    profit REAL,
    
    -- 转化状态
    status TEXT DEFAULT 'approved', -- approved, pending, rejected, duplicate
    
    -- 转化类型
    conversion_type TEXT DEFAULT 'lead', -- lead, sale, install, signup
    
    -- 外部信息
    external_conversion_id TEXT,
    
    -- 自定义参数
    sub1 TEXT,
    sub2 TEXT,
    sub3 TEXT,
    sub4 TEXT,
    sub5 TEXT,
    
    -- 时间戳
    converted_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    
    -- 索引优化字段
    date_partition TEXT, -- YYYY-MM-DD
    
    FOREIGN KEY (click_id) REFERENCES clicks(click_id),
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
    FOREIGN KEY (offer_id) REFERENCES offers(id)
);

-- 展示表
CREATE TABLE impressions (
    id TEXT PRIMARY KEY,
    impression_id TEXT UNIQUE NOT NULL,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    lander_id TEXT,
    
    -- 用户信息
    ip TEXT,
    user_agent TEXT,
    country TEXT,
    device_type TEXT,
    
    -- 时间戳
    impressed_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    
    -- 索引优化字段
    date_partition TEXT, -- YYYY-MM-DD
    
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);

-- ============================================
-- 报表与统计表
-- ============================================

-- 小时统计汇总表
CREATE TABLE hourly_stats (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    lander_id TEXT,
    
    -- 时间维度
    stat_date TEXT NOT NULL, -- YYYY-MM-DD
    stat_hour INTEGER NOT NULL, -- 0-23
    
    -- 流量指标
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    
    -- 转化指标
    conversions INTEGER DEFAULT 0,
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
    
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    UNIQUE(campaign_id, offer_id, lander_id, stat_date, stat_hour, country, device_type)
);

-- 日统计汇总表
CREATE TABLE daily_stats (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    offer_id TEXT,
    lander_id TEXT,
    
    -- 时间维度
    stat_date TEXT NOT NULL, -- YYYY-MM-DD
    
    -- 流量指标
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    unique_clicks INTEGER DEFAULT 0,
    
    -- 转化指标
    conversions INTEGER DEFAULT 0,
    approved_conversions INTEGER DEFAULT 0,
    pending_conversions INTEGER DEFAULT 0,
    rejected_conversions INTEGER DEFAULT 0,
    
    -- 财务指标
    revenue REAL DEFAULT 0,
    cost REAL DEFAULT 0,
    profit REAL DEFAULT 0,
    
    -- 计算指标
    ctr REAL DEFAULT 0, -- 点击率
    cvr REAL DEFAULT 0, -- 转化率
    epc REAL DEFAULT 0, -- 每点击收益
    cpc REAL DEFAULT 0, -- 每点击成本
    roi REAL DEFAULT 0, -- 投资回报率
    
    -- 维度
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
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 操作日志表
CREATE TABLE audit_logs (
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
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 创建索引
-- ============================================

-- 点击表索引
CREATE INDEX idx_clicks_campaign_id ON clicks(campaign_id);
CREATE INDEX idx_clicks_click_id ON clicks(click_id);
CREATE INDEX idx_clicks_date_partition ON clicks(date_partition);
CREATE INDEX idx_clicks_campaign_date ON clicks(campaign_id, date_partition);

-- 转化表索引
CREATE INDEX idx_conversions_click_id ON conversions(click_id);
CREATE INDEX idx_conversions_campaign_id ON conversions(campaign_id);
CREATE INDEX idx_conversions_date_partition ON conversions(date_partition);

-- 统计表索引
CREATE INDEX idx_hourly_stats_date ON hourly_stats(stat_date);
CREATE INDEX idx_daily_stats_date ON daily_stats(stat_date);
CREATE INDEX idx_daily_stats_campaign ON daily_stats(campaign_id, stat_date);

-- ============================================
-- 初始数据
-- ============================================

-- 默认系统设置
INSERT INTO settings (key, value, description) VALUES
    ('system_name', 'AffiliateTrack', '系统名称'),
    ('system_version', '1.0.0', '系统版本'),
    ('default_timezone', 'UTC', '默认时区'),
    ('default_currency', 'USD', '默认货币'),
    ('click_expiration', '86400', '点击有效期(秒)'),
    ('attribution_window', '86400', '归因窗口(秒)'),
    ('max_postback_retries', '3', 'Postback最大重试次数'),
    ('rate_limit_requests', '1000', 'API速率限制(请求/分钟)');
```

## 3. Durable Objects 设计

### 3.1 SessionManager DO

```typescript
// 管理 Click Session 状态
export class SessionManager implements DurableObject {
  // 状态结构
  state = {
    clickId: string,
    campaignId: string,
    offerId: string | null,
    createdAt: number,
    expiresAt: number,
    attributes: {
      ip: string,
      userAgent: string,
      country: string,
      // ...更多属性
    },
    conversions: Array<{
      conversionId: string,
      status: string,
      revenue: number,
      timestamp: number
    }>
  };

  // 主要方法
  async createSession(clickData: ClickData): Promise<string>;
  async getSession(clickId: string): Promise<Session | null>;
  async addConversion(clickId: string, conversion: Conversion): Promise<void>;
  async expireSession(clickId: string): Promise<void>;
}
```

### 3.2 StatsAggregator DO

```typescript
// 实时统计聚合
export class StatsAggregator implements DurableObject {
  // 状态结构
  state = {
    // 按小时聚合的实时数据
    currentHour: {
      hour: number,
      impressions: number,
      clicks: number,
      conversions: number,
      revenue: number,
      cost: number
    },
    // 按维度细分
    byCountry: Map<string, Stats>,
    byDevice: Map<string, Stats>,
    byOffer: Map<string, Stats>,
    // 待写入 D1 的批次
    pendingFlush: Array<StatRecord>
  };

  // 主要方法
  async recordClick(stats: ClickStats): Promise<void>;
  async recordConversion(stats: ConversionStats): Promise<void>;
  async getRealtimeStats(campaignId: string): Promise<RealtimeStats>;
  async flush(): Promise<void>; // 将数据写入 D1
}
```

### 3.3 TrafficRouter DO

```typescript
// 流量分发决策
export class TrafficRouter implements DurableObject {
  // 状态结构
  state = {
    campaignId: string,
    config: {
      distributionType: 'weighted' | 'ab_test' | 'geo' | 'device',
      rules: Array<Rule>,
      offers: Array<OfferConfig>,
      landers: Array<LanderConfig>
    },
    // 实时分发统计
    distribution: {
      offerStats: Map<string, number>,
      landerStats: Map<string, number>
    }
  };

  // 主要方法
  async route(request: RouteRequest): Promise<RouteDecision>;
  async updateConfig(config: RoutingConfig): Promise<void>;
  async getDistributionStats(): Promise<DistributionStats>;
}
```

## 4. API 设计

### 4.1 API 端点概览

```
API 基础路径
├── /track                    # 追踪 API (公开)
│   ├── POST /click           # 记录点击
│   ├── GET /click/:id        # 获取点击信息
│   ├── POST /impression      # 记录展示
│   ├── POST /postback        # 接收 Postback
│   └── GET /pixel.gif        # 追踪像素
│
├── /admin                    # 管理 API (需认证)
│   ├── /campaigns
│   │   ├── GET /             # 列表
│   │   ├── POST /            # 创建
│   │   ├── GET /:id          # 详情
│   │   ├── PUT /:id          # 更新
│   │   └── DELETE /:id       # 删除
│   │
│   ├── /offers
│   │   ├── GET /             # 列表
│   │   ├── POST /            # 创建
│   │   ├── GET /:id          # 详情
│   │   ├── PUT /:id          # 更新
│   │   └── DELETE /:id       # 删除
│   │
│   ├── /landers
│   │   └── ... (同上)
│   │
│   ├── /affiliate-networks
│   │   └── ... (同上)
│   │
│   └── /users
│       ├── GET /             # 列表
│       ├── POST /            # 创建
│       ├── GET /:id          # 详情
│       ├── PUT /:id          # 更新
│       ├── DELETE /:id       # 删除
│       └── POST /:id/api-key # 生成 API Key
│
├── /report                   # 报表 API (需认证)
│   ├── GET /overview         # 总览
│   ├── GET /by-campaign      # 按活动
│   ├── GET /by-offer         # 按 Offer
│   ├── GET /by-country       # 按国家
│   ├── GET /by-device        # 按设备
│   ├── GET /by-date          # 按日期
│   └── GET /export           # 导出
│
└── /auth                     # 认证 API
    ├── POST /login           # 登录
    ├── POST /logout          # 登出
    ├── POST /refresh         # 刷新 Token
    └── GET /me               # 当前用户信息
```

### 4.2 核心 API 详细设计

#### 4.2.1 点击追踪 API

```yaml
POST /track/click
Description: 记录点击并返回重定向目标
Auth: None (公开 API)

Request:
  body:
    campaign_id: string (required)
    traffic_source: string (optional)
    sub1-sub10: string (optional)
    
Response:
  200:
    click_id: string
    redirect_url: string
    offer_id: string

Example:
  Request:
    POST /track/click
    {
      "campaign_id": "cp_abc123",
      "sub1": "google",
      "sub2": "search"
    }
    
  Response:
    {
      "click_id": "clk_xyz789",
      "redirect_url": "https://offer.example.com/?clickid=clk_xyz789",
      "offer_id": "off_def456"
    }
```

#### 4.2.2 Postback API

```yaml
POST /track/postback
Description: 接收转化 Postback
Auth: None (公开 API, 通过参数验证)

Request:
  query:
    clickid: string (required)
    payout: number (required)
    status: string (approved|pending|rejected)
    txid: string (optional, external transaction id)
    
Response:
  200:
    success: boolean
    conversion_id: string
    message: string

Example:
  Request:
    POST /track/postback?clickid=clk_xyz789&payout=5.50&status=approved&txid=ext123
    
  Response:
    {
      "success": true,
      "conversion_id": "conv_abc123",
      "message": "Conversion recorded successfully"
    }
```

#### 4.2.3 报表 API

```yaml
GET /report/by-campaign
Description: 按活动获取报表数据
Auth: Bearer Token

Request:
  query:
    start_date: string (YYYY-MM-DD)
    end_date: string (YYYY-MM-DD)
    campaign_ids: string (comma separated, optional)
    group_by: string (date|offer|country|device)
    
Response:
  200:
    data:
      - campaign_id: string
        campaign_name: string
        impressions: number
        clicks: number
        conversions: number
        revenue: number
        cost: number
        profit: number
        ctr: number
        cvr: number
        epc: number
        roi: number
    summary:
      total_impressions: number
      total_clicks: number
      total_conversions: number
      total_revenue: number
      total_cost: number
      total_profit: number

Example:
  Request:
    GET /report/by-campaign?start_date=2024-01-01&end_date=2024-01-31&group_by=date
    
  Response:
    {
      "data": [
        {
          "campaign_id": "cp_abc123",
          "campaign_name": "Campaign A",
          "impressions": 10000,
          "clicks": 500,
          "conversions": 25,
          "revenue": 125.50,
          "cost": 50.00,
          "profit": 75.50,
          "ctr": 5.0,
          "cvr": 5.0,
          "epc": 0.251,
          "roi": 151.0
        }
      ],
      "summary": {
        "total_impressions": 10000,
        "total_clicks": 500,
        "total_conversions": 25,
        "total_revenue": 125.50,
        "total_cost": 50.00,
        "total_profit": 75.50
      }
    }
```

## 5. 性能目标

| 指标 | 目标值 | 说明 |
|-----|--------|------|
| 点击 API 响应时间 | < 50ms (P95) | 边缘计算优势 |
| Postback API 响应时间 | < 100ms (P95) | 含数据库写入 |
| 报表 API 响应时间 | < 500ms (P95) | 复杂查询 |
| 并发处理能力 | > 10,000 QPS | Workers 分布式 |
| 数据持久化 | 99.99% | D1 + DO |
| 系统可用性 | 99.9% | Cloudflare SLA |

## 6. 安全设计

### 6.1 认证机制

```typescript
// 认证方式
type AuthMethod = 
  | { type: 'session'; token: string }      // Web UI 登录
  | { type: 'api_key'; key: string }        // API 调用
  | { type: 'jwt'; token: string };         // 第三方集成

// 权限级别
type Permission = 
  | 'read'           // 只读
  | 'write'          // 写入
  | 'admin';         // 管理员

// 资源权限矩阵
const permissionMatrix = {
  user: {
    campaigns: ['read', 'write'],
    offers: ['read', 'write'],
    reports: ['read'],
    settings: []
  },
  manager: {
    campaigns: ['read', 'write'],
    offers: ['read', 'write'],
    reports: ['read'],
    settings: ['read']
  },
  admin: {
    campaigns: ['read', 'write'],
    offers: ['read', 'write'],
    reports: ['read'],
    settings: ['read', 'write']
  }
};
```

### 6.2 安全措施

1. **输入验证**: 所有用户输入严格验证
2. **SQL 注入防护**: 使用参数化查询
3. **XSS 防护**: 输出编码和 CSP
4. **CSRF 防护**: Token 验证
5. **速率限制**: API 调用频率限制
6. **日志审计**: 敏感操作记录

## 7. 监控与告警

### 7.1 监控指标

```yaml
metrics:
  # 业务指标
  - name: clicks_per_second
    type: gauge
    description: 每秒点击数
    
  - name: conversions_per_second
    type: gauge
    description: 每秒转化数
    
  - name: postback_success_rate
    type: gauge
    description: Postback 成功率
    
  # 技术指标
  - name: api_latency_p50
    type: gauge
    description: API 延迟 P50
    
  - name: api_latency_p95
    type: gauge
    description: API 延迟 P95
    
  - name: api_latency_p99
    type: gauge
    description: API 延迟 P99
    
  - name: error_rate
    type: gauge
    description: 错误率
    
  - name: active_sessions
    type: gauge
    description: 活跃会话数

alerts:
  - name: high_error_rate
    condition: error_rate > 0.01
    severity: critical
    
  - name: slow_response
    condition: api_latency_p95 > 200
    severity: warning
    
  - name: low_conversion_rate
    condition: postback_success_rate < 0.95
    severity: warning
```

## 8. Cloudflare 免费额度限制

| 资源 | 免费额度 | 优化策略 |
|-----|---------|---------|
| Workers 请求 | 100,000/天 | 合理使用缓存 |
| Workers CPU 时间 | 10ms/请求 | 优化计算逻辑 |
| D1 存储 | 5GB | 数据压缩和清理 |
| D1 读取 | 500万/天 | 使用 DO 缓存热点数据 |
| D1 写入 | 10万/天 | 批量写入聚合 |
| Durable Objects | 免费试用 | 仅核心功能使用 |

---

*此架构文档由架构师 Agent 编写，需经团队评审通过*
