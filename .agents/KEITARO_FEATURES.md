# Keitaro 功能对标完整文档

## 1. 完整功能模块对比

### 导航结构对比

| Keitaro 模块 | AffiliateTrack 状态 | 优先级 | 说明 |
|-------------|-------------------|--------|------|
| Dashboard | ✅ 已实现 | P0 | 仪表盘概览 |
| Campaigns | ✅ 已实现 | P0 | 广告活动管理 |
| **Flows/Streams** | ⚠️ 部分实现 | P0 | 流量分发流程 |
| **Landing Pages** | ⚠️ 部分实现 | P0 | 落地页管理 |
| **Offers** | ✅ 已实现 | P0 | Offer 管理 |
| **Traffic Sources** | ⚠️ 部分实现 | P0 | 流量源模板 |
| **Affiliate Networks** | ⚠️ 部分实现 | P0 | 联盟网络模板 |
| Reports | ✅ 已实现 | P0 | 报表分析 |
| **Clicks Log** | ❌ 未实现 | P1 | 点击日志详情 |
| **Conversions Log** | ❌ 未实现 | P1 | 转化日志详情 |
| **Trends** | ❌ 未实现 | P2 | 趋势分析 |
| **Domains** | ❌ 未实现 | P1 | 域名管理 |
| **Groups** | ❌ 未实现 | P1 | 分组管理 |
| Users | ✅ 已实现 | P0 | 用户管理 |
| **Settings - Bot Lists** | ❌ 未实现 | P1 | 机器人列表 |
| **Settings - Geo DBs** | ❌ 未实现 | P1 | 地理数据库 |
| **Settings - Custom Metrics** | ❌ 未实现 | P2 | 自定义指标 |
| **Settings - Conversion Types** | ❌ 未实现 | P1 | 转化类型 |
| **Maintenance** | ❌ 未实现 | P2 | 系统维护 |
| **Integrations** | ❌ 未实现 | P2 | 第三方集成 |

---

## 2. 核心实体详细设计

### 2.1 Traffic Sources (流量源)

```
Traffic Source 结构:
├── id
├── name (名称)
├── template (预设模板)
├── parameters[] (参数定义)
│   ├── alias (别名, 如 sub1)
│   ├── name (参数名, 如 utm_source)
│   └── macro (宏, 如 {source})
├── s2s_postback (S2S Postback URL)
├── send_only_status (仅发送状态)
├── cost_parameter (成本参数)
├── cost_token (成本 Token)
├── status
└── created_at/updated_at
```

**预设模板示例**:
- Facebook.com
- Google Ads
- PropellerAds
- ZeroPark
- MGID
- Taboola
- Outbrain

### 2.2 Affiliate Networks (联盟网络)

```
Affiliate Network 结构:
├── id
├── name (名称)
├── template (预设模板)
├── offer_parameters[] (Offer 参数)
│   └── subid={subid} 等
├── postback_url (Postback URL 模板)
├── postback_params[] (Postback 参数)
│   ├── subid={subid}
│   ├── status={status}
│   └── amount={payout}
├── macros[] (支持的宏)
│   ├── {subid} - 点击ID
│   ├── {status} - 转化状态
│   ├── {amount} - 金额
│   └── {transaction_id} - 交易ID
├── status
└── created_at/updated_at
```

**预设模板示例**:
- ClickDealer
- MaxBounty
- CPA Grip
- Offer365
- Traffic Light

### 2.3 Flows (流量流程)

```
Flow 结构:
├── id
├── campaign_id
├── name (流程名称)
├── type (类型)
│   ├── forced (强制流程)
│   ├── regular (常规流程)
│   └── default (默认流程)
├── position (位置排序)
├── weight (权重, 用于分流测试)
├── collect_clicks (是否收集点击)
├── schema (流程方案)
│   ├── type (split/redirect/action)
│   ├── landings[] (落地页列表)
│   ├── offers[] (Offer列表)
│   └── weights[] (各元素权重)
├── filters[] (过滤器)
│   ├── field (过滤字段)
│   ├── operator (操作符)
│   ├── value (值)
│   └── logic (AND/OR)
├── status
└── created_at/updated_at
```

### 2.4 Streams (流量流)

```
Stream 结构:
├── id
├── flow_id
├── type (类型)
│   ├── landing+offer (LP + Offer)
│   ├── offer (直接Offer)
│   ├── redirect (重定向)
│   └── action (动作)
├── landing_id
├── offer_id
├── redirect_url
├── action_type
├── weight (权重)
├── position (位置)
└── status
```

### 2.5 Landing Pages (落地页)

```
Landing Page 结构:
├── id
├── name (名称)
├── group_id
├── type (类型)
│   ├── local (本地托管)
│   ├── redirect (重定向)
│   └── preload (预加载)
├── url (URL)
├── folder_path (本地路径)
├── tracking_code (追踪代码)
│   ├── js_adapter (JS适配器)
│   ├── kclient_php (PHP客户端)
│   └── kclient_js (JS客户端)
├── offer_link_code (Offer链接代码)
├── domain_id
├── status
├── clicks_count
├── lp_clicks_count
├── lp_ctr
├── conversions_count
└── created_at/updated_at
```

### 2.6 Domains (域名)

```
Domain 结构:
├── id
├── name (域名)
├── type (类型)
│   ├── tracker (追踪域名)
│   └── landing (落地页域名)
├── ssl_enabled (SSL开关)
├── ssl_auto_renew (SSL自动续期)
├── status
├── is_default (默认域名)
└── created_at/updated_at
```

### 2.7 Groups (分组)

```
Group 结构:
├── id
├── name (名称)
├── entity_type (实体类型)
│   ├── campaign
│   ├── offer
│   └── landing
├── position (排序)
├── color (颜色标识)
└── created_at
```

---

## 3. 过滤条件完整列表

### 3.1 逻辑与值过滤

| 过滤器 | 说明 | 示例 |
|-------|------|------|
| Parameter | 自定义参数 | sub1, sub2... |
| Referrer | 来源页面 | google.com |
| Keyword | 关键词 | buy now |
| Site | 网站 | example.com |
| Sub ID 1-30 | 子ID参数 | 自定义追踪参数 |
| Empty Value | 空值检测 | @empty |

### 3.2 时间与量过滤

| 过滤器 | 说明 | 配置 |
|-------|------|------|
| Date between | 日期范围 | 2024-01-01 ~ 2024-12-31 |
| Timetable | 时间表 | 按星期/小时 |
| Limit clicks | 点击限制 | 每小时/每日/总数 |

### 3.3 技术与网络过滤

| 过滤器 | 说明 | 配置 |
|-------|------|------|
| IP/IPv6 | IP地址 | CIDR, 区间, 掩码 |
| Proxy | 代理检测 | HTTP头检测 |
| Bot | 机器人检测 | 数据库 + UA |
| Connection Type | 连接类型 | Dialup/Mobile/Cable |
| ISP/Mobile Operator | 运营商 | 按名称匹配 |
| X-Requested-With | HTTP头 | AJAX请求检测 |
| UserAgent | 浏览器标识 | 正则匹配 |
| Languages | 语言 | Accept-Language |

### 3.4 设备与地理过滤

| 过滤器 | 说明 | 配置 |
|-------|------|------|
| Country | 国家 | ISO代码列表 |
| City | 城市 | 城市名称 |
| State/Region | 州/省 | 地区代码 |
| Device Type | 设备类型 | Desktop/Mobile/Tablet |
| Device Model | 设备型号 | iPhone, Galaxy等 |
| Browser | 浏览器 | Chrome, Safari等 |
| Browser Version | 浏览器版本 | >= 100 |
| OS | 操作系统 | Windows, iOS, Android |
| OS Version | 系统版本 | >= 14 |
| Uniqueness | 唯一性 | 流程/活动/全局 |

---

## 4. 重定向方式

| 类型 | 说明 | 适用场景 |
|-----|------|---------|
| HTTP redirect | 302/301跳转 | 标准重定向 |
| Meta redirect | HTML Meta刷新 | 绕过某些限制 |
| JS redirect | JavaScript跳转 | 灵活控制 |
| CURL | 服务端请求 | 隐藏目标URL |
| Double meta | 双重Meta跳转 | 绕过检测 |
| FormSubmit | 表单提交 | 特殊场景 |
| Open in iframe | iframe嵌入 | 无跳转展示 |
| REMOTE | 远程控制 | 高级场景 |

---

## 5. 追踪方式

| 类型 | 说明 | 特点 |
|-----|------|------|
| Local | 本地托管 | 上传ZIP, JS适配器 |
| Redirect | 重定向 | 外部URL, 追踪代码 |
| Preload | 预加载 | 服务端渲染 |
| iframe | 嵌入式 | 无跳转展示 |
| S2S Postback | 服务端回调 | 最准确 |
| Image Pixel | 图片像素 | 简单追踪 |
| JS Pixel | JS像素 | 客户端追踪 |

---

## 6. 成本模型

| 模型 | 说明 | 计算方式 |
|-----|------|---------|
| CPC | 按点击付费 | Cost = Clicks × CPC |
| CPM | 按千次展示付费 | Cost = (Impressions/1000) × CPM |
| CPA | 按行为付费 | Cost = Conversions × CPA |
| RevShare | 收入分成 | Revenue × Percentage |
| Auto | 自动成本 | 从Postback获取 |

---

## 7. 唯一性检测

| 方式 | 说明 | 精度 |
|-----|------|------|
| IP + User-Agent | IP加UA组合 | 高 |
| IP Only | 仅IP | 中 |
| Parameter | 参数唯一性 | 自定义 |
| Cookie | Cookie检测 | 高 |

---

## 8. 报表类型

| 报表 | 说明 | 维度 |
|-----|------|------|
| Campaign Performance | 活动表现 | 点击、转化、ROI |
| Landing Page Performance | 落地页表现 | LP CTR、转化 |
| Offer Performance | Offer表现 | EPC、CR |
| Traffic Source Performance | 流量源表现 | 成本、ROI |
| Clicks Log | 点击日志 | 详细点击记录 |
| Conversions Log | 转化日志 | 详细转化记录 |
| Trends | 趋势分析 | 时间维度变化 |
| Custom Report | 自定义报表 | 自选维度指标 |

---

## 9. 设置模块

### 9.1 Main Settings
- 时区设置
- 货币设置
- 语言设置
- 默认值配置

### 9.2 Bot Lists
- 预设机器人列表
- 自定义机器人UA
- IP范围黑名单

### 9.3 Geo DBs
- MaxMind GeoIP
- IP2Location
- 自定义地理数据

### 9.4 Custom Metrics
- 自定义计算指标
- 公式定义
- 显示格式

### 9.5 Conversion Types
- Lead (线索)
- Sale (销售)
- Signup (注册)
- Install (安装)
- Rejected (拒绝)
- 其他自定义类型

---

## 10. 宏变量完整列表

| 宏 | 说明 | 示例值 |
|---|------|--------|
| {subid} | 点击ID | abc123def456 |
| {clickid} | 点击ID(别名) | abc123def456 |
| {campaign_id} | 活动ID | 123 |
| {offer_id} | Offer ID | 456 |
| {landing_id} | 落地页ID | 789 |
| {source} | 流量源 | facebook |
| {keyword} | 关键词 | buy+now |
| {country} | 国家 | US |
| {city} | 城市 | New York |
| {region} | 地区 | NY |
| {device_type} | 设备类型 | mobile |
| {os} | 操作系统 | iOS |
| {browser} | 浏览器 | Safari |
| {ip} | IP地址 | 1.2.3.4 |
| {isp} | 运营商 | Verizon |
| {connection} | 连接类型 | mobile |
| {referrer} | 来源页面 | google.com |
| {sub1}~{sub30} | 自定义参数 | 自定义值 |
| {status} | 转化状态 | approved |
| {amount} | 金额 | 5.50 |
| {cost} | 成本 | 0.05 |
| {profit} | 利润 | 5.45 |
| {timestamp} | 时间戳 | 1704067200 |

---

## 11. 优先级实现计划

### Phase 1 - 核心功能 (必须)
1. ✅ 点击追踪
2. ✅ 转化追踪 (Postback)
3. ✅ Campaign 管理
4. ✅ Offer 管理
5. ⚠️ Landing Page 管理
6. ⚠️ Traffic Sources 模板
7. ⚠️ Affiliate Networks 模板
8. ⚠️ Flows/Streams 流量分发

### Phase 2 - 重要功能
1. ❌ Clicks Log 详情
2. ❌ Conversions Log 详情
3. ❌ Domains 管理
4. ❌ Groups 分组
5. ❌ Bot Lists
6. ❌ 完整过滤器

### Phase 3 - 增强功能
1. ❌ Trends 分析
2. ❌ Custom Metrics
3. ❌ 多种重定向方式
4. ❌ 本地落地页托管
5. ❌ Maintenance 维护

---

*文档基于 Keitaro Demo 站点 (demo.keitaro.io) 实际调研*
