# 部署指南

## 前提条件

1. Cloudflare账户
2. Node.js >= 20.0.0
3. pnpm >= 8.0.0
4. Wrangler CLI

## 安装Wrangler

```bash
npm install -g wrangler
```

## 配置Cloudflare

### 1. 登录Wrangler

```bash
wrangler login
```

### 2. 创建D1数据库

```bash
wrangler d1 create cat-tracker-db
```

记录返回的database_id。

### 3. 创建R2存储桶

```bash
wrangler r2 bucket create cat-tracker-storage
```

### 4. 配置wrangler.toml

```toml
name = "cat-tracker"
main = "src/index.ts"
compatibility_date = "2024-03-20"

[[d1_databases]]
binding = "DB"
database_name = "cat-tracker-db"
database_id = "your-database-id"

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "cat-tracker-storage"
```

## 数据库迁移

### 本地开发

```bash
wrangler d1 migrations apply cat-tracker-db --local
```

### 生产环境

```bash
wrangler d1 migrations apply cat-tracker-db
```

## 部署

### 本地开发

```bash
pnpm dev
```

### 部署到Staging

```bash
pnpm deploy:staging
```

### 部署到Production

```bash
pnpm deploy:production
```

## 环境变量

### 必需变量

```bash
# 创建密钥
wrangler secret put JWT_SECRET
wrangler secret put ENCRYPTION_KEY
wrangler secret put POSTBACK_SECRET
```

### 可选变量

```toml
[vars]
ENVIRONMENT = "production"
API_VERSION = "v1"
CORS_ORIGIN = "https://your-domain.com"
```

## 验证部署

### 健康检查

```bash
curl https://cat-tracker.workers.dev/health
```

### API测试

```bash
curl https://cat-tracker.workers.dev/api/campaigns
```

## 故障排除

### 数据库连接失败
- 检查database_id是否正确
- 确认数据库已创建
- 检查迁移是否已应用

### 部署失败
- 检查Wrangler登录状态
- 确认账户权限
- 查看错误日志

### 性能问题
- 检查缓存配置
- 查看D1查询性能
- 监控Workers CPU使用

## 监控

### Cloudflare Analytics
- 访问Cloudflare Dashboard
- 查看Workers Analytics
- 监控D1查询性能

### 日志
```bash
wrangler tail
```

## 回滚

```bash
# 查看部署历史
wrangler deployments list

# 回滚到指定版本
wrangler rollback --version <version-id>
```
