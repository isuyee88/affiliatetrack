# Agent: 前端开发工程师 - 规划方案 V2（优化版）

## 规划方案提交
**Agent**: 前端开发工程师 (Frontend Developer)  
**日期**: 2026-03-31  
**版本**: v2.0  
**优化重点**: SSR支持、多维表格、时间选择组件、Pretext集成

---

## 1. 技术栈与框架选型（优化版）

### 1.1 核心技术栈更新

| 组件 | 技术选型 | 版本 | 选型理由 |
|------|----------|------|----------|
| **框架** | React | ^18.2 | 组件化，生态丰富 |
| **渲染模式** | SSR + Hydration | - | 首屏性能，SEO友好 |
| **实时通信** | SSE (EventSource) | Native | 服务器推送，简单可靠 |
| **语言** | TypeScript | ^5.3 | 类型安全 |
| **构建工具** | Vite | ^5.0 | 快速构建 |
| **路由** | React Router | ^6.20 | 声明式路由，支持SSR |
| **状态管理** | Zustand | ^4.4 | 轻量，SSR友好 |
| **数据获取** | TanStack Query | ^5.0 | 缓存，自动刷新，SSR支持 |
| **服务端数据** | React Router Loaders | ^6.20 | SSR数据获取 |
| **UI组件** | Radix UI + Tailwind | Latest | 无障碍，可定制 |
| **图表** | Recharts | ^2.10 | React原生 |
| **表格** | TanStack Table | ^8.0 | 虚拟滚动，多维分组 |
| **日期处理** | date-fns | ^3.0 | 轻量，Tree-shaking |
| **文本布局** | Pretext (Phase 2) | ^1.0 | 自适应列宽（可选） |
| **图标** | Lucide React | Latest | 现代，一致 |

### 1.2 项目结构（SSR支持）

```
frontend/
├── src/
│   ├── entry-client.tsx         # 客户端入口（hydration）
│   ├── entry-server.tsx         # 服务端入口（SSR渲染）
│   ├── App.tsx                  # 根组件
│   ├── routes.tsx               # 路由配置（含loader）
│   ├──
│   ├── components/
│   │   ├── ui/                  # 基础UI组件
│   │   ├── layout/              # 布局组件
│   │   ├── charts/              # 图表组件
│   │   ├── tables/              # 表格组件（新增）
│   │   │   ├── DataTable.tsx    # 多维数据表格
│   │   │   ├── VirtualTable.tsx # 虚拟滚动表格
│   │   │   ├── GroupedTable.tsx # 分组表格
│   │   │   └── TableToolbar.tsx # 表格工具栏
│   │   ├── forms/               # 表单组件
│   │   ├── date-picker/         # 时间选择组件（新增）
│   │   │   ├── DateRangePicker.tsx
│   │   │   ├── TimePresetSelector.tsx
│   │   │   ├── CustomDateRange.tsx
│   │   │   └── DateShortcuts.tsx
│   │   └── common/              # 通用组件
│   │       ├── SSRSafe.tsx      # SSR安全包装器
│   │       ├── LiveStats.tsx    # SSE实时统计组件
│   │       └── ErrorBoundary.tsx
│   ├──
│   ├── pages/
│   │   ├── Dashboard/
│   │   │   ├── index.tsx
│   │   │   ├── loader.ts        # SSR数据loader
│   │   │   ├── StatsOverview.tsx
│   │   │   ├── RealTimeChart.tsx # SSE实时图表
│   │   │   └── PerformanceChart.tsx
│   │   ├── Campaigns/
│   │   ├── Flows/
│   │   ├── Offers/
│   │   ├── Reports/
│   │   │   ├── index.tsx
│   │   │   ├── loader.ts
│   │   │   ├── ReportTable.tsx   # 多维报表表格
│   │   │   └── ReportFilters.tsx
│   │   └── Settings/
│   ├──
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSSE.ts            # SSE连接hook（新增）
│   │   ├── useRealTimeStats.ts  # 实时统计hook（新增）
│   │   ├── useDateRange.ts      # 时间范围hook（新增）
│   │   ├── useCampaigns.ts
│   │   ├── useReports.ts
│   │   ├── useVirtualScroll.ts  # 虚拟滚动hook（新增）
│   │   └── useDebounce.ts
│   ├──
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── uiStore.ts
│   │   ├── realTimeStore.ts     # 实时数据store（新增）
│   │   └── dateRangeStore.ts    # 时间范围store（新增）
│   ├──
│   ├── lib/
│   │   ├── api.ts
│   │   ├── ssr.ts               # SSR工具函数（新增）
│   │   ├── sse.ts               # SSE客户端工具（新增）
│   │   ├── pretext.ts           # Pretext集成（Phase 2）
│   │   ├── utils.ts
│   │   ├── constants.ts
│   │   └── validators.ts
│   ├──
│   ├── types/
│   │   ├── api.ts
│   │   ├── models.ts
│   │   ├── table.ts             # 表格类型定义（新增）
│   │   └── date.ts              # 日期类型定义（新增）
│   └──
│   └── styles/
│       ├── globals.css
│       └── tailwind.config.js
├──
├── server/                      # SSR服务端代码
│   ├── index.ts                 # Worker入口
│   ├── render.tsx               # React SSR渲染
│   ├── routes.ts                # 服务端路由
│   └── cache.ts                 # SSR缓存策略
├──
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── wrangler.toml                # Worker配置
```

---

## 2. SSR 实现方案

### 2.1 SSR 渲染流程

```typescript
// server/render.tsx
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../src/App';

interface RenderOptions {
  url: string;
  initialData?: Record<string, any>;
}

export async function render({ url, initialData }: RenderOptions) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000,
        gcTime: 300000,
      },
    },
  });
  
  // 预取数据
  if (initialData) {
    for (const [key, value] of Object.entries(initialData)) {
      queryClient.setQueryData([key], value);
    }
  }
  
  // SSR渲染
  const html = renderToString(
    <QueryClientProvider client={queryClient}>
      <StaticRouter location={url}>
        <App />
      </StaticRouter>
    </QueryClientProvider>
  );
  
  // 提取 dehydrated state
  const dehydratedState = dehydrate(queryClient);
  
  return { html, dehydratedState };
}

// 生成完整HTML
export function generateHTML(
  html: string,
  dehydratedState: any,
  initialData: Record<string, any>
): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudAffiliate Tracker</title>
  <link rel="stylesheet" href="/static/styles.css">
</head>
<body>
  <div id="root">${html}</div>
  
  <!-- 注入初始数据 -->
  <script>
    window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};
    window.__REACT_QUERY_STATE__ = ${JSON.stringify(dehydratedState)};
  </script>
  
  <!-- 客户端JS -->
  <script type="module" src="/static/entry-client.js"></script>
</body>
</html>`;
}
```

### 2.2 客户端 Hydration

```typescript
// src/entry-client.tsx
import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, HydrationBoundary } from '@tanstack/react-query';
import App from './App';

// 恢复服务端状态
const dehydratedState = window.__REACT_QUERY_STATE__;
const initialData = window.__INITIAL_DATA__;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      gcTime: 300000,
    },
  },
});

hydrateRoot(
  document.getElementById('root')!,
  <QueryClientProvider client={queryClient}>
    <HydrationBoundary state={dehydratedState}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HydrationBoundary>
  </QueryClientProvider>
);
```

### 2.3 路由 Loader 模式

```typescript
// src/pages/Dashboard/loader.ts
import { QueryClient } from '@tanstack/react-query';

export interface DashboardLoaderData {
  stats: DashboardStats;
  recentCampaigns: Campaign[];
  timeRange: TimeRange;
}

export async function dashboardLoader(
  queryClient: QueryClient
): Promise<DashboardLoaderData> {
  // 并行获取数据
  const [stats, recentCampaigns] = await Promise.all([
    queryClient.fetchQuery({
      queryKey: ['dashboard-stats'],
      queryFn: () => fetchDashboardStats(),
      staleTime: 30000,
    }),
    queryClient.fetchQuery({
      queryKey: ['recent-campaigns'],
      queryFn: () => fetchRecentCampaigns(5),
      staleTime: 60000,
    }),
  ]);
  
  return {
    stats,
    recentCampaigns,
    timeRange: getDefaultTimeRange(),
  };
}

// src/routes.tsx
import { createBrowserRouter } from 'react-router-dom';
import { dashboardLoader } from './pages/Dashboard/loader';

export const routes = [
  {
    path: '/',
    element: <Dashboard />,
    loader: dashboardLoader,
  },
  {
    path: '/campaigns',
    element: <Campaigns />,
    loader: campaignsLoader,
  },
  {
    path: '/reports',
    element: <Reports />,
    loader: reportsLoader,
  },
];
```

---

## 3. SSE 实时数据推送

### 3.1 SSE Hook 实现

```typescript
// src/hooks/useSSE.ts
import { useEffect, useRef, useCallback } from 'react';
import { useRealTimeStore } from '../stores/realTimeStore';

interface SSEOptions {
  url: string;
  onMessage?: (data: any) => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnects?: number;
}

export function useSSE(options: SSEOptions) {
  const { url, onMessage, onError, reconnectInterval = 5000, maxReconnects = 10 } = options;
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const connect = useCallback(() => {
    if (eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }
    
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;
    
    eventSource.onopen = () => {
      console.log('SSE connected');
      reconnectCountRef.current = 0;
    };
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (e) {
        console.error('SSE message parse error:', e);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      onError?.(error);
      
      eventSource.close();
      
      // 自动重连
      if (reconnectCountRef.current < maxReconnects) {
        reconnectCountRef.current++;
        reconnectTimerRef.current = setTimeout(() => {
          console.log(`SSE reconnecting... (${reconnectCountRef.current}/${maxReconnects})`);
          connect();
        }, reconnectInterval);
      }
    };
  }, [url, onMessage, onError, reconnectInterval, maxReconnects]);
  
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);
  
  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);
  
  return { disconnect };
}

// 实时统计Hook
export function useRealTimeStats(campaignId?: string) {
  const { stats, updateStats } = useRealTimeStore();
  
  useSSE({
    url: campaignId 
      ? `/api/sse/connect?campaignId=${campaignId}`
      : '/api/sse/connect',
    onMessage: (data) => {
      if (data.type === 'stats_update') {
        updateStats(data.payload);
      }
    },
  });
  
  return stats;
}
```

### 3.2 实时统计组件

```typescript
// src/components/common/LiveStats.tsx
import { useRealTimeStats } from '../../hooks/useSSE';
import { StatsCard } from '../charts/StatsCard';

interface LiveStatsProps {
  campaignId?: string;
}

export function LiveStats({ campaignId }: LiveStatsProps) {
  const stats = useRealTimeStats(campaignId);
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="实时点击"
        value={stats.clicks}
        change={stats.clicksChange}
        isLive
      />
      <StatsCard
        title="实时转化"
        value={stats.conversions}
        change={stats.conversionsChange}
        isLive
      />
      <StatsCard
        title="实时收入"
        value={stats.revenue}
        prefix="$"
        change={stats.revenueChange}
        isLive
      />
      <StatsCard
        title="转化率"
        value={stats.conversionRate}
        suffix="%"
        change={stats.conversionRateChange}
        isLive
      />
    </div>
  );
}

// 实时图表组件
export function RealTimeChart({ campaignId }: LiveStatsProps) {
  const stats = useRealTimeStats(campaignId);
  const [data, setData] = useState<ChartData[]>([]);
  
  useEffect(() => {
    // 添加新数据点
    setData(prev => {
      const newData = [...prev, {
        time: new Date(),
        clicks: stats.clicks,
        conversions: stats.conversions,
      }];
      // 保留最近60个点
      return newData.slice(-60);
    });
  }, [stats]);
  
  return (
    <LineChart data={data} isLive>
      <XAxis dataKey="time" tickFormatter={formatTime} />
      <YAxis />
      <Line type="monotone" dataKey="clicks" stroke="#3b82f6" />
      <Line type="monotone" dataKey="conversions" stroke="#10b981" />
    </LineChart>
  );
}
```

---

## 4. 多维表格组件设计

### 4.1 数据表格配置

```typescript
// src/types/table.ts
export interface ColumnDef<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  accessorFn?: (row: T) => any;
  cell?: (info: CellContext<T>) => React.ReactNode;
  enableSorting?: boolean;
  enableGrouping?: boolean;
  enableResizing?: boolean;
  size?: number;
  minSize?: number;
  maxSize?: number;
  meta?: {
    align?: 'left' | 'center' | 'right';
    format?: 'number' | 'currency' | 'percent' | 'date';
    decimals?: number;
  };
}

export interface TableConfig<T> {
  columns: ColumnDef<T>[];
  enableGrouping?: boolean;
  enableSorting?: boolean;
  enableFiltering?: boolean;
  enablePagination?: boolean;
  enableVirtualization?: boolean;
  enableColumnResize?: boolean;
  groupBy?: string[];
  aggregations?: Record<string, AggregationFn>;
}

export type AggregationFn = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'custom';
```

### 4.2 多维数据表格组件

```typescript
// src/components/tables/DataTable.tsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  config?: TableConfig<T>;
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  config = {},
  loading,
  onRowClick,
}: DataTableProps<T>) {
  const {
    enableGrouping = true,
    enableSorting = true,
    enableFiltering = true,
    enablePagination = true,
    enableVirtualization = data.length > 100,
    enableColumnResize = true,
    groupBy = [],
  } = config;
  
  const table = useReactTable({
    data,
    columns,
    state: {
      grouping: groupBy,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getGroupedRowModel: enableGrouping ? getGroupedRowModel() : undefined,
    getExpandedRowModel: enableGrouping ? getExpandedRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
  });
  
  // 虚拟滚动
  const { rows } = table.getRowModel();
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });
  
  return (
    <div className="rounded-md border">
      {/* 工具栏 */}
      <TableToolbar table={table} />
      
      {/* 表格 */}
      <div ref={parentRef} className="overflow-auto max-h-[600px]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="relative"
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {/* 拖拽调整列宽 */}
                    {enableColumnResize && header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn(
                          'absolute right-0 top-0 h-full w-1 cursor-col-resize',
                          header.column.getIsResizing() && 'bg-primary'
                        )}
                      />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          
          <TableBody>
            {enableVirtualization ? (
              // 虚拟滚动模式
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => onRowClick?.(row.original)}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </div>
            ) : (
              // 普通模式
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* 分页 */}
      {enablePagination && <DataTablePagination table={table} />}
    </div>
  );
}
```

### 4.3 分组表格组件

```typescript
// src/components/tables/GroupedTable.tsx
import { DataTable } from './DataTable';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface GroupedTableProps<T> extends DataTableProps<T> {
  groupBy: string[];
  groupAggregations?: Record<string, AggregationFn>;
}

export function GroupedTable<T>({
  groupBy,
  groupAggregations,
  ...props
}: GroupedTableProps<T>) {
  // 扩展列定义以支持分组
  const columnsWithGrouping = useMemo(() => {
    return props.columns.map((col) => ({
      ...col,
      aggregatedCell: ({ row, getValue }: any) => {
        // 分组行显示聚合值
        if (row.getIsGrouped()) {
          const aggregation = groupAggregations?.[col.id];
          const values = row.subRows.map((r: any) => r.getValue(col.id));
          
          switch (aggregation) {
            case 'sum':
              return formatNumber(sum(values));
            case 'avg':
              return formatNumber(avg(values));
            case 'count':
              return values.length;
            default:
              return getValue();
          }
        }
        return getValue();
      },
    }));
  }, [props.columns, groupAggregations]);
  
  return (
    <DataTable
      {...props}
      columns={columnsWithGrouping}
      config={{
        ...props.config,
        enableGrouping: true,
        groupBy,
      }}
    />
  );
}

// 分组行渲染
function GroupedRow({ row, toggleExpanded }: any) {
  return (
    <TableRow
      className="bg-muted/50 cursor-pointer hover:bg-muted"
      onClick={toggleExpanded}
    >
      <TableCell colSpan={row.getVisibleCells().length}>
        <div className="flex items-center gap-2">
          {row.getIsExpanded() ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span className="font-medium">
            {row.groupingValue} ({row.subRows.length})
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}
```

---

## 5. 时间选择组件设计

### 5.1 时间预设配置

```typescript
// src/lib/constants/date.ts
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
} from 'date-fns';

export interface TimePreset {
  id: string;
  label: string;
  labelZh: string;
  getRange: () => { start: Date; end: Date };
  icon?: string;
}

export const