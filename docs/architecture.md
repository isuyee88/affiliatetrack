# CloudAffiliate Tracker - 架构设计文档

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Edge                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Cloudflare Workers                   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │  API Layer  │  │   Tracking  │  │    Admin    │    │   │
│  │  │   (Hono)    │  │   Engine    │  │    Panel    │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Durable Objects (State)                    │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │   │
│  │  │   Session   │  │ Rate Limiter│  │  Realtime   │    │   │
│  │  │   Store     │  │             │  │ Aggregator  │    │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
            ┌───────▼──────┐    ┌────────▼────────┐
            │      D1      │    │       R2        │
            │   (SQLite)   │    │  (Object Store) │
            └──────────────┘    └─────────────────┘
```

## 技术栈

### 后端
- **Runtime**: Cloudflare Workers
- **Framework**: Hono.js
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **State**: Durable Objects
- **Storage**: Cloudflare R2

### 前端
- **Framework**: React 19
- **Language**: TypeScript 5.3
- **Build**: Vite
- **Styling**: Tailwind CSS
- **Tables**: TanStack Table
- **Charts**: Recharts

## 多级缓存架构

```
L1: Browser Cache
   ├── Service Worker
   ├── LocalStorage
   └── IndexedDB

L2: Edge Cache (Cache API)
   ├── API Responses
   ├── Static Assets
   └── Report Data

L3: Durable Objects
   ├── Session Data
   ├── Realtime Stats
   └── Hot Data

L4: Database Cache (D1)
   ├── Query Results
   ├── Precomputed Reports
   └── Materialized Views
```

## 数据流

### 点击跟踪流程
```
User Click → Workers → Cache Check → D1 Query → Redirect
                ↓
         Durable Objects (Aggregation)
                ↓
         SSE Push (Realtime Update)
```

### 报表查询流程
```
User Request → Cache Check → Precomputed Table → Response
                    ↓
              Cache Miss → D1 Query → Cache Store
```

## 性能优化

### 缓存策略
- Campaign配置: 5分钟TTL
- 实时统计: 1分钟TTL
- 小时报表: 1小时TTL
- 日报表: 1天TTL

### 预计算
- 每小时聚合任务
- 每日聚合任务
- 每月聚合任务

### SSR
- 流式渲染
- 数据预取
- 关键CSS内联

## 安全

### 认证
- JWT Token
- RBAC权限控制
- Rate Limiting

### 防护
- SQL注入防护
- XSS防护
- CSRF防护
- DDoS防护

## 部署

### 环境
- Staging: staging.cat-tracker.workers.dev
- Production: cat-tracker.workers.dev

### CI/CD
- GitHub Actions
- Automated Testing
- Automated Deployment
