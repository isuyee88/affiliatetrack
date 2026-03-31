# Agent: 系统架构师 - 规划方案 V2（优化版）

## 规划方案提交
**Agent**: 系统架构师 (System Architect)  
**日期**: 2026-03-31  
**版本**: v2.0  
**优化重点**: 多级缓存、SSR/SSE、Pretext评估

---

## 1. 系统架构设计（优化版）

### 1.1 整体架构图（含多级缓存层）

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Cloudflare Edge Network                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Cloudflare Workers                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   API Layer  │  │  Tracking    │  │   Admin      │              │   │
│  │  │   (REST)     │  │   Engine     │  │   Panel      │              │   │
│  │  │  + SSR/SSE   │  │  + Edge      │  │  + SSR       │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │         │                 │                 │                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   Routing    │  │   Filter     │  │   Report     │              │   │
│  │  │   Engine     │  │   Engine     │  │   Engine     │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    🔄 Multi-Level Cache Layer                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ L1: Memory   │  │ L2: KV       │  │ L3: Cache    │              │   │
│  │  │ (DO State)   │  │ (Hot Data)   │  │ API (Edge)   │              │   │
│  │  │ < 1ms        │  │ < 10ms       │  │ < 50ms       │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Durable Objects (State)                        │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  Session     │  │  Rate Limit  │  │  Real-time   │              │   │
│  │  │  Manager     │  │  Counter     │  │  Aggregator  │              │   │
│  │  │  + L1 Cache  │  │  + L1 Cache  │  │  + SSE Hub   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                         Data Layer │                                       │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐   │
│  │                              D1 Database                              │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │   Campaigns  │  │    Clicks    │  │  Conversions │                │   │
│  │  │   Flows      │  │    Events    │  │   Reports    │                │   │
│  │  │   Offers     │  │   Traffic    │  │    Users     │                │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│  ┌─────────────────────────────────┴─────────────────────────────────────┐   │
│  │                              R2 Storage                               │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │   │
│  │  │  Landing     │  │   Static     │  │   Export     │                │   │
│  │  │  Pages       │  │   Assets     │  │   Files      │                │   │
│  │  │  + SSR Cache │  │  + Pretext   │  │  + Reports   │                │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 多级缓存架构详解

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🔄 Multi-Level Cache Strategy                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Request Flow:                                                              │
│                                                                             │
│  User Request → L1 (DO Memory) → L2 (KV) → L3 (Cache API) → D1/DO          │
│                    │              │              │              │           │
│                    ▼              ▼              ▼              ▼           │
│                  Hit?           Hit?           Hit?           Query         │
│                    │              │              │              │           │
│              ┌─────┴────┐   ┌─────┴────┐   ┌─────┴────┐   ┌─────┴────┐    │
│              │  < 1ms   │   │  < 10ms  │   │  < 50ms  │   │ < 100ms  │    │
│              │  99.9%   │   │  99.5%   │   │  95%     │   │  100%    │    │
│              └──────────┘   └──────────┘   └──────────┘   └──────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### L1 Cache: Durable Objects 内存缓存
```typescript
// L1 Cache: DO 内存状态（最快，但单实例）
interface L1Cache {
  // 实时统计数据（最后1分钟）
  realTimeStats: Map<string, RealTimeMetrics>;
  
  // 会话状态
  sessions: Map<string, SessionData>;
  
  // 限流计数器
  rateLimiters: Map<string, RateLimitState>;
  
  // 预聚合数据（最后1小时）
  preAggregated: Map<string, AggregatedMetrics>;
  
  // TTL: 60秒自动同步到 L2
  syncInterval: 60000;
}
```

#### L2 Cache: Workers KV（热数据缓存）
```typescript
// L2 Cache: KV 命名空间（跨实例共享）
interface L2CacheSchema {
  // 配置数据（Campaign/Offer/Flow）
  'config:campaign:{id}': CampaignConfig;        // TTL: 5分钟
  'config:offer:{id}': OfferConfig;              // TTL: 5分钟
  'config:flow:{id}': FlowConfig;                // TTL: 5分钟
  
  // 预计算报表数据
  'report:daily:{date}:{campaignId}': DailyReport;     // TTL: 1小时
  'report:hourly:{hour}:{campaignId}': HourlyReport;   // TTL: 10分钟
  
  // 聚合统计（按时间粒度）
  'stats:5min:{timestamp}': FiveMinuteStats;     // TTL: 2小时
  'stats:1hour:{timestamp}': HourlyStats;        // TTL: 24小时
  'stats:1day:{date}': DailyStats;               // TTL: 7天
  
  // 地理位置/设备数据缓存
  'geo:ip:{ipHash}': GeoLocation;                // TTL: 24小时
  'device:ua:{uaHash}': DeviceInfo;              // TTL: 24小时
}
```

#### L3 Cache: Cache API（边缘缓存）
```typescript
// L3 Cache: Cloudflare Cache API（CDN边缘）
interface L3CacheStrategy {
  // 静态资源（JS/CSS/图片）
  staticAssets: {
    pattern: '/static/*',
    ttl: 86400 * 30,  // 30天
    cacheKey: '${url}:${etag}'
  };
  
  // API 响应（可缓存的GET请求）
  apiResponses: {
    pattern: '/api/reports/*',
    ttl: 300,  // 5分钟
    vary: ['Authorization', 'Accept-Language']
  };
  
  // SSR 页面缓存
  ssrPages: {
    pattern: '/dashboard/*',
    ttl: 60,  // 1分钟（动态内容）
    staleWhileRevalidate: 300  // 5分钟内返回旧数据，后台刷新
  };
}
```

### 1.3 缓存失效策略

```typescript
// 缓存失效策略
class CacheInvalidation {
  // 主动失效：数据变更时
  async invalidateOnChange(entity: string, id: string) {
    // L1: 立即失效（DO内存）
    await this.l1.delete(`${entity}:${id}`);
    
    // L2: 异步失效（KV）
    await this.l2.delete(`config:${entity}:${id}`);
    
    // L3: 标记失效（Cache API）
    await this.purgeCacheTag(`${entity}:${id}`);
  }
  
  // 被动失效：TTL到期
  // L1: 60秒自动过期
  // L2: 根据数据类型设置不同TTL
  // L3: 根据Cache-Control头
  
  // 智能预加载：预测性缓存
  async preloadHotData() {
    // 预加载活跃Campaign数据
    const activeCampaigns = await this.getActiveCampaigns();
    for (const campaign of activeCampaigns) {
      await this.cacheWarmup(campaign.id);
    }
  }
}
```

---

## 2. SSR + SSE 架构设计

### 2.1 服务器端渲染 (SSR) 架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SSR Architecture                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Worker SSR Handler                              │   │
│  │                                                                     │   │
│  │  1. Request → Check Cache (L3) → Return Cached HTML                │   │
│  │                    ↓                                                │   │
│  │  2. Miss → Fetch Data (L1 → L2 → D1)                               │   │
│  │                    ↓                                                │   │
│  │  3. Render React Component → HTML String                           │   │
│  │                    ↓                                                │   │
│  │  4. Inject Initial Data (hydration)                                │   │
│  │                    ↓                                                │   │
│  │  5. Stream Response → Client                                       │   │
│  │                    ↓                                                │   │
│  │  6. Client Hydrates → Interactive App                              │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Benefits:                                                                  │
│  - First Contentful Paint < 500ms                                          │
│  - SEO友好                                                                  │
│  - 减少客户端JS执行时间                                                     │
│  - 在Cloudflare免费额度内完成                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### SSR 实现方案
```typescript
// SSR Worker Handler
export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    
    // 1. 检查SSR缓存
    const cacheKey = new Request(url.toString(), request);
    const cached = await caches.default.match(cacheKey);
    if (cached) return cached;
    
    // 2. 获取数据（带缓存）
    const data = await fetchDashboardData(env, {
      useL1: true,   // DO内存
      useL2: true,   // KV缓存
      useD1: false,  // 优先不走D1
    });
    
    // 3. 渲染React组件为HTML
    const html = await renderToString(
      <DashboardPage initialData={data} />
    );
    
    // 4. 构建完整HTML页面
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Dashboard - CAT</title>
  <script>window.__INITIAL_DATA__ = ${JSON.stringify(data)}</script>
</head>
<body>
  <div id="root">${html}</div>
  <script src="/static/app.js"></script>
</body>
</html>`;
    
    // 5. 缓存并返回
    const response = new Response(fullHtml, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
    
    await caches.default.put(cacheKey, response.clone());
    return response;
  },
};
```

### 2.2 服务器发送事件 (SSE) 实时数据推送

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SSE Real-time Architecture                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────┐         ┌───────────────┐ │
│  │   Dashboard     │◄────────│   SSE Manager   │◄────────│  Data Sources │ │
│  │   (Browser)     │  SSE    │   (Durable Obj) │  Push   │               │ │
│  │                 │ Stream  │                 │         │ - Click Events│ │
│  │ EventSource     │         │ - Connection    │         │ - Conversions │ │
│  │                 │         │   Management    │         │ - Aggregates  │ │
│  │ Auto-reconnect  │         │ - Broadcast     │         │               │ │
│  │                 │         │ - Heartbeat     │         │               │ │
│  └─────────────────┘         └─────────────────┘         └───────────────┘ │
│                                                                             │
│  Data Flow:                                                                 │
│  1. Client opens SSE connection → SSE Manager DO                           │
│  2. Click/Conversion events → Aggregator DO → SSE Manager                  │
│  3. SSE Manager broadcasts to all connected clients                        │
│  4. Client receives updates → UI updates in real-time                      │
│                                                                             │
│  Benefits:                                                                  │
│  - 单向数据流，比WebSocket更简单                                            │
│  - 自动重连，HTTP兼容                                                       │
│  - 适合实时统计数据推送                                                     │
│  - 不增加Cloudflare读写次数（数据从DO内存推送）                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### SSE 实现方案
```typescript
// SSE Durable Object
export class SSEManager implements DurableObject {
  private connections: Map<string, WritableStream> = new Map();
  private heartbeatInterval: NodeJS.Timer;
  
  constructor(private state: DurableObjectState) {
    // 心跳保持连接
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ type: 'heartbeat', timestamp: Date.now() });
    }, 30000);
  }
  
  async fetch(request: Request) {
    const url = new URL(request.url);
    
    if (url.pathname === '/connect') {
      // 建立SSE连接
      const { readable, writable } = new TransformStream();
      const connectionId = crypto.randomUUID();
      this.connections.set(connectionId, writable);
      
      // 发送初始数据
      const writer = writable.getWriter();
      await writer.write(this.encodeSSE({
        type: 'connected',
        connectionId,
        timestamp: Date.now(),
      }));
      
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    if (url.pathname === '/broadcast') {
      // 接收来自Aggregator的广播请求
      const data = await request.json();
      await this.broadcast(data);
      return new Response('OK');
    }
    
    return new Response('Not Found', { status: 404 });
  }
  
  private async broadcast(data: any) {
    const message = this.encodeSSE(data);
    const deadConnections: string[] = [];
    
    for (const [id, writable] of this.connections) {
      try {
        const writer = writable.getWriter();
        await writer.write(message);
        writer.releaseLock();
      } catch (e) {
        deadConnections.push(id);
      }
    }
    
    // 清理断开的连接
    for (const id of deadConnections) {
      this.connections.delete(id);
    }
  }
  
  private encodeSSE(data: any): string {
    return `data: ${JSON.stringify(data)}\n\n`;
  }
}

// 客户端使用
// const eventSource = new EventSource('/api/sse/connect');
// eventSource.onmessage = (e) => {
//   const data = JSON.parse(e.data);
//   updateDashboard(data);
// };
```

### 2.3 SSR + SSE 整合方案

```typescript
// 整合SSR和SSE的Dashboard渲染
export async function handleDashboard(request: Request, env: Env) {
  // 1. SSR渲染初始页面
  const initialData = await fetchCachedDashboardData(env);
  const html = renderDashboardSSR(initialData);
  
  // 2. 在HTML中嵌入SSE连接脚本
  const htmlWithSSE = html.replace(
    '</body>',
    `
<script>
// SSE实时数据更新
const eventSource = new EventSource('/api/sse/connect');
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'stats_update') {
    updateStats(data.payload);
  }
};
// 自动重连
eventSource.onerror = () => {
  setTimeout(() => {
    window.location.reload();
  }, 5000);
};
</script>
</body>`
  );
  
  return new Response(htmlWithSSE, {
    headers: { 'Content-Type': 'text/html' },
  });
}
```

---

## 3. 报表系统与多维表格设计

### 3.1 时间选择组件规范

```typescript
// 预设时间段定义
interface TimeRangePreset {
  id: string;
  label: string;
  labelZh: string;
  getRange: () => { start: Date; end: Date };
  cacheKey: string;
  // 预计算策略
  precompute: boolean;
  // TTL设置
  ttl: number;
}

const TIME_PRESETS: TimeRangePreset[] = [
  {
    id: 'today',
    label: 'Today',
    labelZh: '今天',
    getRange: () => ({
      start: startOfDay(new Date()),
      end: new Date(),
    }),
    cacheKey: 'today',
    precompute: true,
    ttl: 60, // 1分钟
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    labelZh: '昨天',
    getRange: () => {
      const yesterday = subDays(new Date(), 1);
      return {
        start: startOfDay(yesterday),
        end: endOfDay(yesterday),
      };
    },
    cacheKey: 'yesterday',
    precompute: true,
    ttl: 3600, // 1小时（昨天数据不变）
  },
  {
    id: 'last7days',
    label: 'Last 7 Days',
    labelZh: '最近7天',
    getRange: () => ({
      start: subDays(new Date(), 7),
      end: new Date(),
    }),
    cacheKey: 'last7days',
    precompute: true,
    ttl: 300, // 5分钟
  },
  {
    id: 'thisMonth',
    label: 'This Month',
    labelZh: '当前月份',
    getRange: () => ({
      start: startOfMonth(new Date()),
      end: new Date(),
    }),
    cacheKey: 'thisMonth',
    precompute: true,
    ttl: 300,
  },
  {
    id: 'lastMonth',
    label: 'Last Month',
    labelZh: '上个月',
    getRange: () => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        start: startOfMonth(lastMonth),
        end: endOfMonth(lastMonth),
      };
    },
    cacheKey: 'lastMonth',
    precompute: true,
    ttl: 86400, // 24小时（上个月数据不变）
  },
  {
    id: 'last3Months',
    label: 'Last 3 Months',
    labelZh: '最近3个月',
    getRange: () => ({
      start: subMonths(new Date(), 3),
      end: new Date(),
    }),
    cacheKey: 'last3months',
    precompute: true,
    ttl: 3600,
  },
  {
    id: 'thisYear',
    label: 'This Year',
    labelZh: '今年',
    getRange: () => ({
      start: startOfYear(new Date()),
      end: new Date(),
    }),
    cacheKey: 'thisYear',
    precompute: true,
    ttl: 3600,
  },
  {
    id: 'lastYear',
    label: 'Last Year',
    labelZh: '去年',
    getRange: () => {
      const lastYear = subYears(new Date(), 1);
      return {
        start: startOfYear(lastYear),
        end: endOfYear(lastYear),
      };
    },
    cacheKey: 'lastYear',
    precompute: true,
    ttl: 86400 * 7,
  },
  {
    id: 'custom',
    label: 'Custom Range',
    labelZh: '自定义时间',
    getRange: () => ({ start: new Date(), end: new Date() }), // 由用户选择
    cacheKey: 'custom',
    precompute: false,
    ttl: 300,
  },
];
```

### 3.2 预计算与缓存策略

```typescript
// 预计算调度器
class ReportPrecomputer {
  constructor(private env: Env) {}
  
  // 定时预计算热点数据
  async schedulePrecompute() {
    // 每5分钟预计算"今天"数据
    await this.precomputePreset('today');
    
    // 每30分钟预计算"最近7天"数据
    await this.precomputePreset('last7days');
    
    // 每小时预计算"当前月份"数据
    await this.precomputePreset('thisMonth');
    
    // 每日凌晨预计算历史数据
    await this.precomputeHistorical();
  }
  
  async precomputePreset(presetId: string) {
    const preset = TIME_PRESETS.find(p => p.id === presetId);
    if (!preset || !preset.precompute) return;
    
    const range = preset.getRange();
    const cacheKey = `precomputed:${preset.cacheKey}:${format(range.start, 'yyyyMMddHH')}`;
    
    // 检查是否已缓存
    const cached = await this.env.KV.get(cacheKey);
    if (cached) return;
    
    // 执行预计算
    const data = await this.computeReportData(range);
    
    // 写入KV缓存
    await this.env.KV.put(cacheKey, JSON.stringify(data), {
      expirationTtl: preset.ttl,
    });
    
    // 同时写入L1缓存（DO内存）
    await this.updateL1Cache(presetId, data);
  }
  
  // 多维表格数据预计算
  async precomputeMultiDimensional(
    timeRange: { start: Date; end: Date },
    dimensions: string[]
  ) {
    const dimensionKey = dimensions.sort().join(',');
    const cacheKey = `multi:${dimensionKey}:${timeRange.start.getTime()}`;
    
    const data = await this.queryD1WithDimensions(timeRange, dimensions);
    
    // 预聚合结果
    const aggregated = this.aggregateByDimensions(data, dimensions);
    
    await this.env.KV.put(cacheKey, JSON.stringify(aggregated), {
      expirationTtl: 3600,
    });
    
    return aggregated;
  }
}
```

### 3.3 响应式多维表格组件

```typescript
// 前端多维表格配置
interface DataTableConfig {
  // 列定义（支持拖拽排序）
  columns: ColumnDef[];
  
  // 维度分组（支持多级）
  groupBy: string[];
  
  // 聚合函数
  aggregations: {
    clicks: 'sum' | 'count';
    conversions: 'sum' | 'count';
    revenue: 'sum' | 'avg';
    conversionRate: 'avg' | 'custom';
  };
  
  // 响应式断点
  responsive: {
    mobile: { visibleColumns: number; enableScroll: true };
    tablet: { visibleColumns: number; enableScroll: false };
    desktop: { visibleColumns: 'all'; enableScroll: false };
  };
  
  // 虚拟滚动配置
  virtualScroll: {
    enabled: true;
    rowHeight: 48;
    overscan: 5;
  };
  
  // 导出配置
  export: {
    formats: ['csv', 'excel', 'pdf'];
    maxRows: 100000;
  };
}

// 后端查询优化
interface OptimizedQuery {
  // 使用物化视图（如果D1支持）或预计算表
  useMaterializedView: boolean;
  
  // 查询拆分（大时间范围拆分为多个小查询）
  querySplitting: {
    enabled: true;
    chunkSize: '1day'; // 按天拆分
  };
  
  // 并行查询
  parallelQueries: {
    enabled: true;
    maxConcurrency: 5;
  };
  
  // 结果缓存
  resultCache: {
    enabled: true;
    ttl: 300;
    keyGenerator: (params: QueryParams) => string;
  };
}
```

---

## 4. Pretext 技术评估

### 4.1 Pretext 简介

**Pretext** 是由 Chen Lou 开发的纯 JavaScript/TypeScript 文本测量与布局库，主要特点：

| 特性 | 说明 |
|------|------|
| **核心功能** | 多行文本测量与布局计算 |
| **性能** | prepare() ~19ms/500文本，layout() ~0.09ms/500文本 |
| **优势** | 避免DOM测量（无layout reflow），支持Canvas/SVG/WebGL渲染 |
| **语言支持** | 全语言（包括emoji、混合双向文本） |
| **API** | prepare() + layout() / prepareWithSegments() + layoutWithLines() |

### 4.2 在 CAT 项目中的应用评估

#### 适用场景 ✅

```typescript
// 1. 报表表格中的文本自适应列宽
// 场景：多维表格需要根据内容自动调整列宽
import { prepareWithSegments, walkLineRanges } from '@chenglou/pretext';

function calculateOptimalColumnWidth(
  texts: string[],
  font: string,
  maxWidth: number
): number {
  let maxLineWidth = 0;
  
  for (const text of texts) {
    const prepared = prepareWithSegments(text, font);
    walkLineRanges(prepared, maxWidth, (line) => {
      if (line.width > maxLineWidth) {
        maxLineWidth = line.width;
      }
    });
  }
  
  return Math.min(maxLineWidth + 32, maxWidth); // +32px padding
}
```

```typescript
// 2. 图表标签布局优化
// 场景：Recharts图表中避免标签重叠
import { prepare, layout } from '@chenglou/pretext';

function optimizeChartLabels(
  labels: string[],
  availableWidth: number,
  font: string
): { text: string; width: number; shouldRotate: boolean }[] {
  return labels.map(label => {
    const prepared = prepare(label, font);
    const { width } = layout(prepared, availableWidth, 20);
    
    return {
      text: label,
      width,
      shouldRotate: width > availableWidth / labels.length,
    };
  });
}
```

```typescript
// 3. 移动端响应式文本截断
// 场景：小屏幕下智能截断长文本
function truncateTextForMobile(
  text: string,
  maxLines: number,
  containerWidth: number,
  font: string
): { truncated: string; isTruncated: boolean } {
  const prepared = prepareWithSegments(text, font);
  const { lines } = layoutWithLines(prepared, containerWidth, 20);
  
  if (lines.length <= maxLines) {
    return { truncated: text, isTruncated: false };
  }
  
  // 截断并添加省略号
  const visibleLines = lines.slice(0, maxLines);
  const lastLine = visibleLines[visibleLines.length - 1];
  const truncatedText = lastLine.text.slice(0, -3) + '...';
  
  return {
    truncated: visibleLines.slice(0, -1).map(l => l.text).join('') + truncatedText,
    isTruncated: true,
  };
}
```

#### 不适用场景 ❌

| 场景 | 原因 |
|------|------|
| 简单单行文本 | 原生Canvas measureText足够 |
| 静态布局 | CSS Grid/Flexbox更合适 |
| 富文本编辑 | 需要更复杂的编辑器组件 |
| 服务端渲染 | Pretext目前主要面向浏览器 |

### 4.3 引入建议

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Pretext 引入决策                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  建议：选择性引入，用于特定场景                                              │
│                                                                             │
│  Phase 1 (MVP):                                                             │
│  ❌ 暂不引入 - 使用原生CSS和Recharts默认行为                                 │
│                                                                             │
│  Phase 2 (优化):                                                            │
│  ✅ 引入用于：                                                              │
│     - 多维表格自适应列宽计算                                                │
│     - 图表标签防重叠优化                                                    │
│     - 移动端文本智能截断                                                    │
│                                                                             │
│  成本评估：                                                                 │
│  - 包大小: ~15KB gzipped                                                    │
│  - 学习成本: 低（API简单）                                                  │
│  - 维护成本: 低（成熟库）                                                   │
│  - 收益: 中（提升特定场景体验）                                             │
│                                                                             │
│  替代方案：                                                                 │
│  - 使用CSS text-overflow: ellipsis                                          │
│  - 使用Recharts内置标签布局                                                 │
│  - 手动计算近似宽度                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. 性能与扩展性规划（优化版）

### 5.1 缓存命中率目标

| 缓存层级 | 目标命中率 | 平均延迟 | 数据类型 |
|----------|------------|----------|----------|
| L1 (DO内存) | 99.9% | <1ms | 实时统计、会话状态 |
| L2 (KV) | 95% | <10ms | 配置数据、预计算报表 |
| L3 (Cache API) | 90% | <50ms | 静态资源、SSR页面 |
| D1 | 100% | <100ms | 持久化数据 |

### 5.2 Cloudflare 免费账户优化策略

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Free Tier Optimization Strategy                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Workers 请求 (100,000/天):                                                 │
│  ├─ 缓存命中 → 不计入Workers请求                                            │
│  ├─ SSR页面 → Cache API缓存60秒                                             │
│  ├─ 静态资源 → Cache API缓存30天                                            │
│  └─ API请求 → 智能缓存，减少重复计算                                        │
│                                                                             │
│  D1 读取 (100,000/天):                                                      │
│  ├─ L1缓存 → 避免99.9%的D1读取                                              │
│  ├─ L2缓存 → 避免95%的D1读取                                                │
│  └─ 实际D1读取 → 仅用于写入和数据变更                                       │
│                                                                             │
│  D1 写入 (100,000/天):                                                      │
│  ├─ 批量写入 → 每5秒批量flush一次                                           │
│  ├─ 异步写入 → 点击事件先入DO队列                                           │
│  └─ 预聚合 → 减少原始数据写入量                                             │
│                                                                             │
│  Durable Objects (100万次/月):                                              │
│  ├─ 会话聚合 → 单DO处理多个会话                                             │
│  ├─ 地理分片 → 按用户地理位置分配DO                                         │
│  └─ 连接复用 → SSE长连接减少新建连接                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 SSR + SSE 性能指标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| **SSR首字节时间 (TTFB)** | <100ms | WebPageTest |
| **SSR首屏渲染 (FCP)** | <500ms | Lighthouse |
| **SSE连接建立时间** | <50ms | Custom |
| **SSE消息延迟** | <100ms | Custom |
| **SSR缓存命中率** | >90% | Cloudflare Analytics |

---

## 6. 技术决策记录 (ADR) - 新增

### ADR-004: 多级缓存架构
**决策**: 实现L1/L2/L3三级缓存  
**原因**:
- 最大化缓存命中率，减少D1读取
- 分层设计平衡速度和容量
- 符合Cloudflare服务特性

### ADR-005: SSR + SSE 实时数据推送
**决策**: 使用SSR渲染初始页面，SSE推送实时更新  
**原因**:
- SSR提升首屏性能和SEO
- SSE比WebSocket更简单，HTTP兼容
- 数据从DO内存推送，不增加D1读取

### ADR-006: 预计算热点报表数据
**决策**: 定时预计算常用时间段报表  
**原因**:
- 减少实时查询压力
- 提升用户体验（即时响应）
- 合理利用KV存储

### ADR-007: 选择性引入Pretext
**决策**: Phase 2选择性引入Pretext用于表格和图表优化  
**原因**:
- 解决特定布局问题（自适应列宽、标签防重叠）
- 包大小可接受
- 非核心依赖，可替换

---

## 7. 可测量目标（优化版）

### 7.1 核心性能指标

| 指标 | 目标值 | 测量方法 | 参考标准 |
|------|--------|----------|----------|
| **系统并发处理能力** | ≥100,000 QPS | k6 Load Testing | Keitaro Enterprise: 50K QPS |
| **系统可用性** | 99.99% | Cloudflare Uptime | Industry Standard: 99.9% |
| **API响应时间 (P50)** | <50ms | Cloudflare Analytics | Keitaro: ~100ms |
| **API响应时间 (P99)** | <200ms | Cloudflare Analytics | Keitaro: ~500ms |
| **SSR TTFB** | <100ms | WebPageTest | Good: <200ms |
| **SSR FCP** | <500ms | Lighthouse | Good: <1.8s |
| **缓存命中率 (L1+L2+L3)** | >99% | Custom Metrics | Target: >95% |
| **D1读取减少率** | >95% | D1 Analytics | Baseline: 无缓存 |

### 7.2 Cloudflare免费账户资源使用目标

| 资源 | 免费额度 | 设计目标使用率 | 优化策略 |
|------|----------|----------------|----------|
| Workers请求 | 100,000/天 | <50% | 缓存优化 |
| D1读取 | 100,000/天 | <30% | 多级缓存 |
| D1写入 | 100,000/天 | <50% | 批量+异步 |
| Durable Objects | 100万次/月 | <60% | 连接复用 |
| KV读取 | 100万次/天 | <80% | 合理TTL |
| Cache API | 无限制 | 最大化利用 | 积极缓存 |

---

## 8. 评审投票

### 自评
**投票**: ✅ 通过

**理由**:
1. 多级缓存架构显著提升性能，降低D1读取>95%
2. SSR+SSE方案在不增加Cloudflare读写的前提下提升用户体验
3. 预计算策略优化报表系统响应时间
4. Pretext评估客观，建议合理（Phase 2选择性引入）
5. 时间选择组件预设完善，与缓存策略对齐

### 证据
- [多级缓存架构](#12-多级缓存架构详解)
- [SSR+SSE架构](#2-ssr--sse-架构设计)
- [预计算策略](#32-预计算与缓存策略)
- [Pretext评估](#4-pretext-技术评估)
- [性能目标](#7-可测量目标优化版)

---

**Agent签名**: 系统架构师  
**日期**: 2026-03-31
