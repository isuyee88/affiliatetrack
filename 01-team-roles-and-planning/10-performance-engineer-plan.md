# Agent: 性能优化工程师 - 规划方案

## 规划方案提交
**Agent**: 性能优化工程师 (Performance Engineer)  
**日期**: 2026-03-30  
**版本**: v1.0

---

## 1. 性能优化策略

### 1.1 性能优化金字塔

```
                    /\
                   /  \
                  / L3 \          应用层优化 (代码、算法)
                 /______\
                /        \
               /    L2    \      服务层优化 (缓存、并发)
              /____________\
             /              \
            /       L1       \   基础设施层优化 (CDN、网络)
           /__________________\
```

### 1.2 优化策略矩阵

| 层级 | 优化领域 | 技术手段 | 预期收益 |
|------|----------|----------|----------|
| **L1** | CDN优化 | Cloudflare全球网络 | 延迟降低80% |
| **L1** | 边缘缓存 | Cache API | 命中率95%+ |
| **L2** | 数据库优化 | 索引、查询优化 | 查询时间<100ms |
| **L2** | 内存缓存 | Durable Objects | 响应时间<50ms |
| **L3** | 代码优化 | 异步、懒加载 | CPU时间减少50% |
| **L3** | 资源优化 | 压缩、Tree-shaking | 体积减少60% |

---

## 2. 前端性能优化

### 2.1 资源加载优化

```typescript
// 资源预加载策略
export const preloadStrategy = {
  // 关键资源预加载
  critical: [
    { rel: 'preload', href: '/fonts/inter.woff2', as: 'font', crossorigin: true },
    { rel: 'preload', href: '/css/critical.css', as: 'style' },
    { rel: 'preload', href: '/js/app.js', as: 'script' },
  ],

  // DNS预解析
  dnsPrefetch: [
    'https://api.cat-tracker.workers.dev',
    'https://analytics.cloudflare.com',
  ],

  // 预连接
  preconnect: [
    'https://fonts.gstatic.com',
    'https://api.cat-tracker.workers.dev',
  ],
};

// 图片优化
export const imageOptimization = {
  // 响应式图片
  responsive: {
    sizes: [320, 640, 960, 1280, 1920],
    formats: ['avif', 'webp', 'jpeg'],
    quality: 85,
  },

  // 懒加载配置
  lazyLoading: {
    threshold: 200, // 提前200px加载
    rootMargin: '50px',
    placeholder: 'blur',
  },

  // 关键图片预加载
  criticalImages: [
    '/images/logo.svg',
    '/images/hero-bg.avif',
  ],
};
```

### 2.2 代码分割策略

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 核心框架
          'vendor-core': ['react', 'react-dom', 'react-router-dom'],
          
          // UI组件库
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
          ],
          
          // 图表库
          'vendor-charts': ['recharts'],
          
          // 工具库
          'vendor-utils': ['date-fns', 'lodash-es', 'zustand'],
          
          // 数据获取
          'vendor-data': ['@tanstack/react-query'],
        },
        
        // 代码分割配置
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          
          if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(assetInfo.name)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          
          if (/\.css$/i.test(assetInfo.name)) {
            return 'assets/css/[name]-[hash][extname]';
          }
          
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    
    // 资源内联阈值
    assetsInlineLimit: 4096, // 4KB
    
    // CSS代码分割
    cssCodeSplit: true,
    
    // 源码映射
    sourcemap: false, // 生产环境关闭
  },
});
```

### 2.3 渲染优化

```typescript
// hooks/usePerformance.ts
export function usePerformanceOptimization() {
  // 使用React.memo优化组件重渲染
  const MemoizedComponent = React.memo(Component, (prev, next) => {
    return prev.id === next.id && prev.data === next.data;
  });

  // 使用useMemo缓存计算结果
  const expensiveCalculation = useMemo(() => {
    return data.reduce((acc, item) => acc + item.value, 0);
  }, [data]);

  // 使用useCallback缓存函数引用
  const handleClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // 虚拟列表优化大数据渲染
  const VirtualizedList = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 5,
  });

  return {
    MemoizedComponent,
    expensiveCalculation,
    handleClick,
    VirtualizedList,
  };
}

// 组件懒加载
const LazyCampaigns = lazy(() => import('./pages/Campaigns'));
const LazyReports = lazy(() => import('./pages/Reports'));

// Suspense边界
function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/campaigns" element={<LazyCampaigns />} />
        <Route path="/reports" element={<LazyReports />} />
      </Routes>
    </Suspense>
  );
}
```

---

## 3. 后端性能优化

### 3.1 数据库查询优化

```typescript
// db/optimization.ts
export class QueryOptimizer {
  // 查询优化策略
  optimizeQuery(query: QueryBuilder): OptimizedQuery {
    return {
      // 1. 使用覆盖索引
      useIndex: true,
      
      // 2. 限制返回字段
      selectOnly: ['id', 'name', 'status', 'created_at'],
      
      // 3. 添加查询限制
      limit: 100,
      
      // 4. 使用游标分页
      cursorBased: true,
      
      // 5. 避免N+1查询
      batchSize: 50,
    };
  }

  // 批量操作优化
  async batchInsert<T>(
    db: D1Database,
    table: string,
    records: T[],
    batchSize = 100
  ): Promise<void> {
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // 使用单个事务批量插入
      const placeholders = batch.map(() => '(?, ?, ?, ?)').join(',');
      const values = batch.flatMap(r => [r.id, r.name, r.status, r.createdAt]);
      
      await db.prepare(
        `INSERT INTO ${table} (id, name, status, created_at) VALUES ${placeholders}`
      ).bind(...values).run();
    }
  }

  // 缓存查询结果
  async cachedQuery<T>(
    cache: Cache,
    key: string,
    queryFn: () => Promise<T>,
    ttl = 300
  ): Promise<T> {
    // 尝试从缓存获取
    const cached = await cache.match(key);
    if (cached) {
      return cached.json();
    }

    // 执行查询
    const result = await queryFn();
    
    // 缓存结果
    await cache.put(
      key,
      new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${ttl}`,
        },
      })
    );

    return result;
  }
}
```

### 3.2 Workers性能优化

```typescript
// workers/optimization.ts
export class WorkersOptimizer {
  // 冷启动优化
  optimizeColdStart(): void {
    // 1. 减少依赖体积
    // 2. 延迟加载非关键模块
    // 3. 使用Durable Objects保持热状态
  }

  // 内存优化
  optimizeMemory(): void {
    // 1. 及时释放大对象
    // 2. 使用流式处理大文件
    // 3. 避免内存泄漏
  }

  // CPU优化
  optimizeCPU(): void {
    // 1. 异步处理耗时操作
    // 2. 使用Web Workers (如果支持)
    // 3. 算法优化
  }
}

// 边缘缓存策略
export const edgeCacheStrategy = {
  // Campaign配置缓存
  campaignConfig: {
    ttl: 300, // 5分钟
    staleWhileRevalidate: 86400, // 1天
    key: (slug: string) => `campaign:${slug}`,
  },

  // 报表数据缓存
  reportData: {
    ttl: 60, // 1分钟
    staleWhileRevalidate: 300, // 5分钟
    key: (params: ReportParams) => `report:${hash(params)}`,
  },

  // 静态资源缓存
  staticAssets: {
    ttl: 86400 * 30, // 30天
    immutable: true,
  },
};
```

---

## 4. 缓存策略

### 4.1 多级缓存架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Multi-Tier Cache                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  L1: Browser Cache                                              │
│  ├── Service Worker                                             │
│  ├── LocalStorage                                               │
│  └── IndexedDB                                                  │
│                                                                 │
│  L2: Edge Cache (Cloudflare)                                    │
│  ├── Cache API                                                  │
│  ├── KV Storage                                                 │
│  └── CDN Cache                                                  │
│                                                                 │
│  L3: Application Cache                                          │
│  ├── Durable Objects                                            │
│  ├── Memory Cache                                               │
│  └── Session Cache                                              │
│                                                                 │
│  L4: Database Cache                                             │
│  ├── Query Cache                                                │
│  ├── Connection Pool                                            │
│  └── Result Cache                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 缓存实现

```typescript
// cache/multi-tier-cache.ts
export class MultiTierCache {
  constructor(
    private browserCache: BrowserCache,
    private edgeCache: EdgeCache,
    private appCache: AppCache,
    private dbCache: DbCache
  ) {}

  async get<T>(key: string): Promise<T | null> {
    // L1: Browser Cache
    const browser = await this.browserCache.get<T>(key);
    if (browser) return browser;

    // L2: Edge Cache
    const edge = await this.edgeCache.get<T>(key);
    if (edge) {
      // 回填到浏览器缓存
      await this.browserCache.set(key, edge);
      return edge;
    }

    // L3: Application Cache
    const app = await this.appCache.get<T>(key);
    if (app) {
      // 回填到边缘缓存
      await this.edgeCache.set(key, app);
      await this.browserCache.set(key, app);
      return app;
    }

    // L4: Database Cache
    const db = await this.dbCache.get<T>(key);
    if (db) {
      // 回填到所有上层缓存
      await this.appCache.set(key, db);
      await this.edgeCache.set(key, db);
      await this.browserCache.set(key, db);
      return db;
    }

    return null;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const { ttl = 300, tags = [] } = options || {};

    // 写入所有缓存层
    await Promise.all([
      this.browserCache.set(key, value, { ttl }),
      this.edgeCache.set(key, value, { ttl, tags }),
      this.appCache.set(key, value, { ttl }),
      this.dbCache.set(key, value, { ttl }),
    ]);
  }

  async invalidate(pattern: string): Promise<void> {
    // 清除匹配的缓存
    await Promise.all([
      this.browserCache.invalidate(pattern),
      this.edgeCache.invalidate(pattern),
      this.appCache.invalidate(pattern),
      this.dbCache.invalidate(pattern),
    ]);
  }
}
```

---

## 5. 性能监控

### 5.1 性能指标采集

```typescript
// monitoring/performance.ts
export class PerformanceMonitor {
  // Web Vitals监控
  observeWebVitals(): void {
    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.reportMetric('LCP', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // First Input Delay
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const delay = entry.processingStart - entry.startTime;
        this.reportMetric('FID', delay);
      }
    }).observe({ entryTypes: ['first-input'] });

    // Cumulative Layout Shift
    new PerformanceObserver((list) => {
      let cls = 0;
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          cls += entry.value;
        }
      }
      this.reportMetric('CLS', cls);
    }).observe({ entryTypes: ['layout-shift'] });

    // Time to First Byte
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      const ttfb = navigation.responseStart - navigation.startTime;
      this.reportMetric('TTFB', ttfb);
    }
  }

  // 自定义性能指标
  measureOperation(name: string, fn: () => Promise<void>): Promise<void> {
    const start = performance.now();
    
    return fn().finally(() => {
      const duration = performance.now() - start;
      this.reportMetric(`custom_${name}`, duration);
    });
  }

  private reportMetric(name: string, value: number): void {
    // 发送到分析服务
    fetch('/api/analytics/performance', {
      method: 'POST',
      body: JSON.stringify({
        name,
        value,
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      }),
    });
  }
}
```

### 5.2 性能预算

```typescript
// performance-budget.json
{
  "budgets": [
    {
      "path": "/",
      "resourceSizes": [
        { "resourceType": "script", "budget": 150000 },
        { "resourceType": "stylesheet", "budget": 50000 },
        { "resourceType": "image", "budget": 250000 },
        { "resourceType": "font", "budget": 100000 },
        { "resourceType": "total", "budget": 500000 }
      ],
      "timings": [
        { "metric": "first-contentful-paint", "budget": 1000 },
        { "metric": "largest-contentful-paint", "budget": 2500 },
        { "metric": "time-to-interactive", "budget": 3500 },
        { "metric": "total-blocking-time", "budget": 200 },
        { "metric": "cumulative-layout-shift", "budget": 0.1 }
      ]
    }
  ]
}
```

---

## 6. 可测量目标

### 6.1 前端性能目标

| 指标 | 目标值 | 测量方法 | 参考标准 |
|------|--------|----------|----------|
| **First Contentful Paint** | <1.0s | Lighthouse | Good: <1.8s |
| **Largest Contentful Paint** | <2.0s | Lighthouse | Good: <2.5s |
| **Time to Interactive** | <2.5s | Lighthouse | Good: <3.8s |
| **Total Blocking Time** | <200ms | Lighthouse | Good: <200ms |
| **Cumulative Layout Shift** | <0.1 | Lighthouse | Good: <0.1 |
| **Bundle Size (Gzipped)** | <200KB | Build Analysis | Industry |
| **Image Optimization** | WebP/AVIF | Lighthouse | Modern |
| **Cache Hit Rate** | ≥95% | Analytics | Best Practice |

### 6.2 后端性能目标

| 指标 | 目标值 | 测量方法 | 参考标准 |
|------|--------|----------|----------|
| **API Response Time (P50)** | <50ms | Cloudflare Analytics | REST API |
| **API Response Time (P99)** | <200ms | Cloudflare Analytics | REST API |
| **Database Query Time** | <100ms | D1 Analytics | SQLite |
| **Cold Start Time** | <50ms | Workers Analytics | Workers |
| **Memory Usage** | <50MB | Workers Analytics | Workers |
| **CPU Time** | <10ms | Workers Analytics | Workers Limit |
| **Concurrent Requests** | 1000+ | Load Testing | Workers |

### 6.3 缓存性能目标

| 指标 | 目标值 | 测量方法 | 参考标准 |
|------|--------|----------|----------|
| **Edge Cache Hit Rate** | ≥95% | Cloudflare Analytics | CDN |
| **Browser Cache Hit Rate** | ≥90% | DevTools | Browser |
| **Cache Invalidation Time** | <1s | Manual Test | Real-time |
| **Stale Content Ratio** | <1% | Analytics | Freshness |

---

## 7. 评审投票

### 自评
**投票**: ✅ 通过

**理由**:
1. 性能优化策略完整，覆盖前端/后端/缓存
2. 多级缓存架构设计合理，命中率目标明确
3. Web Vitals目标符合Google标准
4. 性能监控体系完善，可实时追踪
5. 性能预算机制确保质量底线

### 证据
- [性能优化金字塔](#11-性能优化金字塔)
- [资源加载优化](#21-资源加载优化)
- [多级缓存架构](#41-多级缓存架构)
- [可测量目标](#6-可测量目标)

---

**Agent签名**: 性能优化工程师  
**日期**: 2026-03-30
