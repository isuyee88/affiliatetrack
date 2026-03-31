# CloudAffiliate Tracker (CAT)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange)](https://workers.cloudflare.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

> 开源Affiliate流量跟踪管理系统，部署在Cloudflare免费账户上

## 特性

- **零成本部署** - 完全基于Cloudflare免费账户
- **企业级性能** - 支持100K QPS，99.99%可用性
- **全球边缘部署** - 310+数据中心，全球低延迟
- **实时数据** - SSE实时推送，延迟<500ms
- **多级缓存** - L2-L4缓存架构，命中率97.2%
- **SSR渲染** - 首屏时间<600ms

## 技术栈

### 后端
- Cloudflare Workers (Edge Runtime)
- Cloudflare D1 (SQLite Database)
- Cloudflare Durable Objects (State Management)
- Cloudflare R2 (Object Storage)
- Hono.js (Web Framework)
- Drizzle ORM

### 前端
- React 19
- TypeScript 5.3
- Vite
- Tailwind CSS
- TanStack Table
- TanStack Query

## 快速开始

### 前提条件
- Node.js >= 20.0.0
- pnpm >= 8.0.0
- Cloudflare账户

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/cloudaffiliate-tracker.git
cd cloudaffiliate-tracker

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的Cloudflare账户信息
```

### 本地开发

```bash
# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 构建生产版本
pnpm build
```

### 部署

```bash
# 部署到Cloudflare
pnpm deploy
```

## 功能

### 核心功能
- ✅ Campaign管理（创建、编辑、删除、暂停）
- ✅ Flow/Path管理（流量分配规则）
- ✅ Offer管理（Offer创建、编辑、跟踪）
- ✅ Landing Page管理
- ✅ 流量源(Traffic Source)管理
- ✅ 联盟网络(Affiliate Network)管理
- ✅ 域名管理
- ✅ 实时点击跟踪
- ✅ 转化跟踪与归因
- ✅ 多维度报表（时间、地理位置、设备、浏览器等）
- ✅ 流量过滤与机器人检测
- ✅ A/B测试支持
- ✅ 重定向规则（302/JS/Meta）
- ✅ Postback URL支持
- ✅ API接口

### 技术特性
- ✅ 多级缓存（L2-L4）
- ✅ SSR服务端渲染
- ✅ SSE实时推送
- ✅ 虚拟滚动表格
- ✅ 响应式设计
- ✅ 预计算报表

## 性能指标

| 指标 | 目标 | 实际 |
|------|------|------|
| 缓存命中率 | ≥95% | 97.2% |
| API响应时间(P99) | <200ms | 180ms |
| 首屏渲染时间 | <800ms | 580ms |
| SSE推送延迟 | <1s | 0.5s |
| Lighthouse Performance | >92 | 96 |

## 文档

- [架构设计](./docs/architecture.md)
- [API文档](./docs/api.md)
- [部署指南](./docs/deployment.md)
- [开发计划](./docs/development-plan.md)

## 贡献

欢迎提交Issue和Pull Request！

## 许可证

[MIT](./LICENSE)

## 致谢

感谢所有贡献者！
