# CloudAffiliate Tracker - 仓库结构

## 目录结构

```
cloudaffiliate-tracker/
├── .github/
│   └── workflows/
│       └── ci-cd.yml           # GitHub Actions CI/CD
├── docs/
│   ├── architecture.md         # 架构设计文档
│   └── deployment.md           # 部署指南
├── frontend/
│   ├── src/
│   │   ├── components/         # React组件
│   │   ├── hooks/              # 自定义Hooks
│   │   ├── pages/              # 页面组件
│   │   └── lib/                # 工具库
│   ├── public/                 # 静态资源
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── src/
│   ├── cache/                  # 多级缓存系统
│   │   ├── types.ts
│   │   ├── edge-cache.ts
│   │   ├── durable-object-cache.ts
│   │   ├── database-cache.ts
│   │   └── multi-tier-cache.ts
│   ├── cron/                   # 定时任务
│   │   └── precompute.ts
│   ├── db/
│   │   ├── migrations/         # 数据库迁移
│   │   │   ├── 0001_initial.sql
│   │   │   └── 0002_precompute_tables.sql
│   │   └── schema/
│   │       └── index.ts
│   ├── middleware/             # 中间件
│   │   ├── auth.ts
│   │   ├── cors.ts
│   │   ├── rate-limit.ts
│   │   └── error-handler.ts
│   ├── routes/                 # API路由
│   │   ├── api/
│   │   │   ├── campaigns.ts
│   │   │   ├── flows.ts
│   │   │   ├── offers.ts
│   │   │   └── reports.ts
│   │   ├── tracking.ts
│   │   └── postback.ts
│   ├── services/               # 业务服务
│   │   ├── tracking.service.ts
│   │   ├── precompute.service.ts
│   │   └── report.service.ts
│   ├── sse/                    # 实时推送
│   │   └── realtime-aggregator.ts
│   ├── ssr/                    # 服务端渲染
│   │   └── index.tsx
│   ├── types/                  # 类型定义
│   │   └── index.ts
│   ├── utils/                  # 工具函数
│   │   └── index.ts
│   └── index.ts                # 入口文件
├── tests/                      # 测试文件
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/                    # 脚本
│   └── git-commit.bat
├── 01-team-roles-and-planning/ # 开发计划文档
│   ├── 01-development-team-agents.md
│   ├── 02-architect-plan.md
│   ├── 03-product-manager-plan.md
│   ├── 04-backend-developer-plan.md
│   ├── 05-frontend-developer-plan.md
│   ├── 06-qa-engineer-plan.md
│   ├── 07-devops-engineer-plan.md
│   ├── 08-uiux-designer-plan.md
│   ├── 09-security-engineer-plan.md
│   ├── 10-performance-engineer-plan.md
│   ├── 11-technical-writer-plan.md
│   ├── 12-planning-review-meeting.md
│   └── 13-enhanced-architecture-plan-v2.md
├── .gitignore
├── LICENSE
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── wrangler.toml
└── drizzle.config.ts
```

## 提交到GitHub的文件清单

### 源代码（必需）
- [x] src/ - 后端源代码
- [x] frontend/src/ - 前端源代码
- [x] tests/ - 测试文件

### 配置文件（必需）
- [x] package.json
- [x] pnpm-workspace.yaml
- [x] tsconfig.json
- [x] wrangler.toml
- [x] drizzle.config.ts
- [x] .gitignore

### 文档（必需）
- [x] README.md
- [x] LICENSE
- [x] docs/architecture.md
- [x] docs/deployment.md

### CI/CD（必需）
- [x] .github/workflows/ci-cd.yml

### 开发计划（必需）
- [x] 01-team-roles-and-planning/*.md

### 忽略的文件
- [ ] node_modules/
- [ ] dist/
- [ ] .wrangler/
- [ ] .env
- [ ] *.log
- [ ] coverage/
- [ ] 02-development/ (开发过程文件)
- [ ] 03-review/ (评审过程文件)
- [ ] 04-delivery/ (交付过程文件)
- [ ] 05-testing/ (测试过程文件)

## 提交步骤

### 1. 创建GitHub仓库

1. 访问 https://github.com/new
2. 输入仓库名称: `cloudaffiliate-tracker`
3. 选择公开或私有
4. 不要初始化README（本地已有）
5. 点击 "Create repository"

### 2. 本地提交

```bash
# 进入项目目录
cd cloudaffiliate-tracker

# 运行提交脚本
scripts\git-commit.bat
```

### 3. 手动提交（备选）

```bash
# 初始化Git
git init
git branch -m main

# 添加远程仓库
git remote add origin https://github.com/yourusername/cloudaffiliate-tracker.git

# 添加文件
git add src/ frontend/src/ docs/ tests/ scripts/
git add package.json pnpm-workspace.yaml tsconfig.json wrangler.toml drizzle.config.ts
git add README.md LICENSE .gitignore
git add .github/workflows/ci-cd.yml
git add 01-team-roles-and-planning/

# 提交
git commit -m "Initial commit: CloudAffiliate Tracker v1.0.0"

# 推送
git push -u origin main
```

## 提交后验证

### 检查GitHub仓库
1. 访问 https://github.com/yourusername/cloudaffiliate-tracker
2. 确认文件已上传
3. 检查README显示正常

### 检查GitHub Actions
1. 访问 Actions 标签页
2. 确认CI/CD流程正常运行
3. 检查测试是否通过

### 检查Secrets配置
1. 访问 Settings -> Secrets
2. 添加 CLOUDFLARE_API_TOKEN
3. 添加其他必要密钥

## 仓库信息

- **仓库名称**: cloudaffiliate-tracker
- **主要语言**: TypeScript
- **许可证**: MIT
- **Topics**: affiliate, tracking, cloudflare, workers, react, typescript

## 后续维护

### 定期更新
- 依赖包更新
- 安全补丁
- 功能迭代

### 分支策略
- main: 生产分支
- develop: 开发分支
- feature/*: 功能分支
- hotfix/*: 紧急修复

### 发布流程
1. 更新版本号
2. 创建Release
3. 打Tag
4. 部署到生产
