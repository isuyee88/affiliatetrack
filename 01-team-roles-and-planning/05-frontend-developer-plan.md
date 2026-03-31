# Agent: 前端开发工程师 - 规划方案

## 规划方案提交
**Agent**: 前端开发工程师 (Frontend Developer)  
**日期**: 2026-03-30  
**版本**: v1.0

---

## 1. 技术栈与框架选型

### 1.1 核心技术栈

| 组件 | 技术选型 | 版本 | 选型理由 |
|------|----------|------|----------|
| **框架** | React | ^18.2 | 组件化，生态丰富 |
| **语言** | TypeScript | ^5.3 | 类型安全，开发体验好 |
| **构建工具** | Vite | ^5.0 | 快速构建，优化输出 |
| **路由** | React Router | ^6.20 | 声明式路由 |
| **状态管理** | Zustand | ^4.4 | 轻量，TypeScript友好 |
| **数据获取** | TanStack Query | ^5.0 | 缓存，自动刷新 |
| **UI组件** | Radix UI + Tailwind | Latest | 无障碍，可定制 |
| **图表** | Recharts | ^2.10 | React原生，灵活 |
| **表单** | React Hook Form | ^7.48 | 性能优秀，验证集成 |
| **验证** | Zod | ^3.22 | 类型安全 |
| **日期** | date-fns | ^3.0 | 轻量，Tree-shaking |
| **图标** | Lucide React | Latest | 现代，一致 |

### 1.2 项目结构

```
frontend/
├── src/
│   ├── main.tsx                 # 应用入口
│   ├── App.tsx                  # 根组件
│   ├── routes.tsx               # 路由配置
│   ├── components/
│   │   ├── ui/                  # 基础UI组件
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Toast.tsx
│   │   │   └── index.ts
│   │   ├── layout/              # 布局组件
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── MainLayout.tsx
│   │   │   └── index.ts
│   │   ├── charts/              # 图表组件
│   │   │   ├── LineChart.tsx
│   │   │   ├── BarChart.tsx
│   │   │   ├── PieChart.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   └── index.ts
│   │   ├── forms/               # 表单组件
│   │   │   ├── CampaignForm.tsx
│   │   │   ├── FlowForm.tsx
│   │   │   ├── OfferForm.tsx
│   │   │   └── index.ts
│   │   └── common/              # 通用组件
│   │       ├── DataTable.tsx
│   │       ├── DateRangePicker.tsx
│   │       ├── FilterBar.tsx
│   │       ├── Loading.tsx
│   │       └── ErrorBoundary.tsx
│   ├── pages/
│   │   ├── Dashboard/
│   │   │   ├── index.tsx
│   │   │   ├── StatsOverview.tsx
│   │   │   ├── RecentActivity.tsx
│   │   │   └── PerformanceChart.tsx
│   │   ├── Campaigns/
│   │   │   ├── index.tsx
│   │   │   ├── CampaignList.tsx
│   │   │   ├── CampaignDetail.tsx
│   │   │   └── CampaignCreate.tsx
│   │   ├── Flows/
│   │   ├── Offers/
│   │   ├── Reports/
│   │   ├── Settings/
│   │   └── Login/
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useCampaigns.ts
│   │   ├── useReports.ts
│   │   ├── useLocalStorage.ts
│   │   └── useDebounce.ts
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── uiStore.ts
│   │   └── index.ts
│   ├── lib/
│   │   ├── api.ts               # API客户端
│   │   ├── utils.ts             # 工具函数
│   │   ├── constants.ts         # 常量
│   │   └── validators.ts        # 验证规则
│   ├── types/
│   │   ├── api.ts
│   │   ├── models.ts
│   │   └── index.ts
│   └── styles/
│       ├── globals.css
│       └── tailwind.config.js
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 2. 性能优化策略

### 2.1 代码分割与懒加载

```typescript
// routes.tsx
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Loading } from './components/common/Loading';

// 懒加载页面组件
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const CampaignDetail = lazy(() => import('./pages/Campaigns/CampaignDetail'));
const Flows = lazy(() => import('./pages/Flows'));
const Offers = lazy(() => import('./pages/Offers'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));

export function AppRoutes() {
  return (
    <Suspense fallback={<Loading fullscreen />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/flows" element={<Flows />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### 2.2 资源优化

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true }),
  ],
  build: {
    target: 'esnext',
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // 第三方库分包
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          charts: ['recharts'],
          utils: ['date-fns', 'lodash-es'],
        },
      },
    },
    // 资源内联阈值
    assetsInlineLimit: 4096,
    // 代码分割
    chunkSizeWarningLimit: 500,
  },
  // 预构建优化
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
});
```

### 2.3 图片优化

```typescript
// components/ui/OptimizedImage.tsx
import { useState, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  placeholder?: string;
  lazy?: boolean;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  placeholder,
  lazy = true,
}: OptimizedImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className="relative overflow-hidden">
      {!loaded && placeholder && (
        <img
          src={placeholder}
          alt=""
          className="absolute inset-0 w-full h-full blur-sm"
        />
      )}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
```

---

## 3. 核心组件设计

### 3.1 Dashboard页面

```typescript
// pages/Dashboard/index.tsx
import { useQuery } from '@tanstack/react-query';
import { StatsOverview } from './StatsOverview';
import { PerformanceChart } from './PerformanceChart';
import { RecentActivity } from './RecentActivity';
import { DateRangePicker } from '../../components/common/DateRangePicker';
import { api } from '../../lib/api';

export function Dashboard() {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 7),
    to: new Date(),
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', dateRange],
    queryFn: () => api.reports.getSummary(dateRange),
    staleTime: 30000, // 30秒缓存
  });

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {/* 统计概览 */}
      <StatsOverview data={stats?.overview} loading={isLoading} />

      {/* 性能图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceChart
          data={stats?.clicksOverTime}
          title="Clicks Over Time"
          loading={isLoading}
        />
        <PerformanceChart
          data={stats?.conversionsOverTime}
          title="Conversions Over Time"
          loading={isLoading}
        />
      </div>

      {/* 最近活动 */}
      <RecentActivity activities={stats?.recentActivity} />
    </div>
  );
}
```

### 3.2 数据表格组件

```typescript
// components/common/DataTable.tsx
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  pagination?: boolean;
  sorting?: boolean;
  filtering?: boolean;
}

export function DataTable<T>({
  data,
  columns,
  loading,
  pagination = true,
  sorting = true,
  filtering = true,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: filtering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: pagination ? getPaginationRowModel() : undefined,
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <Loading />
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      
      {pagination && <DataTablePagination table={table} />}
    </div>
  );
}
```

### 3.3 图表组件

```typescript
// components/charts/PerformanceChart.tsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface PerformanceChartProps {
  data: Array<{ date: string; value: number }>;
  title: string;
  loading?: boolean;
  color?: string;
}

export function PerformanceChart({
  data,
  title,
  loading,
  color = '#3b82f6',
}: PerformanceChartProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <Loading />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MM/dd')}
            />
            <YAxis />
            <Tooltip
              contentStyle={{ borderRadius: '8px' }}
              labelFormatter={(value) => format(new Date(value), 'yyyy-MM-dd')}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

---

## 4. 状态管理设计

### 4.1 Zustand Store

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const response = await api.auth.login({ email, password });
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
```

### 4.2 TanStack Query配置

```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1分钟
      gcTime: 300000, // 5分钟
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

---

## 5. 可测量目标

### 5.1 Lighthouse评分目标

| 指标 | 目标值 | 测量方法 | 参考标准 |
|------|--------|----------|----------|
| **Performance** | ≥92 | Lighthouse CI | Google Web Vitals |
| **Accessibility** | ≥96 | Lighthouse CI | WCAG 2.1 AA |
| **Best Practices** | ≥96 | Lighthouse CI | Security/UX |
| **SEO** | ≥96 | Lighthouse CI | Search Optimization |

### 5.2 Web Vitals目标

| 指标 | 目标值 | 测量方法 | 参考标准 |
|------|--------|----------|----------|
| **First Contentful Paint (FCP)** | <1.0s | Web Vitals | Good: <1.8s |
| **Largest Contentful Paint (LCP)** | <2.0s | Web Vitals | Good: <2.5s |
| **First Input Delay (FID)** | <50ms | Web Vitals | Good: <100ms |
| **Cumulative Layout Shift (CLS)** | <0.1 | Web Vitals | Good: <0.1 |
| **Time to Interactive (TTI)** | <2.5s | Lighthouse | Good: <3.8s |
| **Total Blocking Time (TBT)** | <200ms | Lighthouse | Good: <200ms |

### 5.3 资源加载目标

| 指标 | 目标值 | 测量方法 | 优化策略 |
|------|--------|----------|----------|
| **Bundle Size (Gzipped)** | <200KB | Build Analysis | Code Splitting |
| **JavaScript Size** | <150KB | Build Analysis | Tree Shaking |
| **CSS Size** | <30KB | Build Analysis | PurgeCSS |
| **Image Size** | <100KB avg | Lighthouse | WebP/AVIF |
| **Font Loading** | <1.5s | Web Vitals | Font Display |

### 5.4 交互性能目标

| 指标 | 目标值 | 测量方法 | 参考标准 |
|------|--------|----------|----------|
| **Route Transition** | <100ms | React Profiler | Instant Feel |
| **Modal Open** | <50ms | React Profiler | Instant Feel |
| **Form Input** | <16ms | React Profiler | 60fps |
| **Chart Render** | <100ms | React Profiler | Smooth |
| **Table Sort** | <50ms | React Profiler | Instant |

---

## 6. 无障碍设计

### 6.1 ARIA规范

```typescript
// components/ui/Button.tsx
import { forwardRef } from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={loading || props.disabled}
        aria-busy={loading}
        aria-disabled={loading || props.disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          buttonVariants[variant],
          buttonSizes[size]
        )}
        {...props}
      >
        {loading && (
          <span className="mr-2">
            <LoadingSpinner size="sm" />
          </span>
        )}
        {children}
      </button>
    );
  }
);
```

### 6.2 键盘导航

```typescript
// hooks/useKeyboardNavigation.ts
export function useKeyboardNavigation(
  itemCount: number,
  onSelect: (index: number) => void
) {
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) =>
            prev < itemCount - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'Enter':
          if (focusedIndex >= 0) {
            onSelect(focusedIndex);
          }
          break;
        case 'Escape':
          setFocusedIndex(-1);
          break;
      }
    },
    [itemCount, focusedIndex, onSelect]
  );

  return { focusedIndex, setFocusedIndex, handleKeyDown };
}
```

---

## 7. 评审投票

### 自评
**投票**: ✅ 通过

**理由**:
1. 技术栈选型现代，性能优秀
2. Lighthouse评分目标明确，参考Google Web Vitals标准
3. 代码分割和懒加载策略完善
4. 无障碍设计符合WCAG 2.1 AA标准
5. 交互性能目标可达，用户体验优秀

### 证据
- [技术栈选型](#11-核心技术栈)
- [性能优化策略](#2-性能优化策略)
- [Lighthouse目标](#51-lighthouse评分目标)
- [Web Vitals目标](#52-web-vitals目标)

---

**Agent签名**: 前端开发工程师  
**日期**: 2026-03-30
