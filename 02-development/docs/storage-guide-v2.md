# Cloudflare免费账户存储方案对比与选择指南

## 存储服务配额对比

| 服务 | 免费额度 | 限制类型 | 适用场景 | 风险等级 |
|------|----------|----------|----------|----------|
| **KV** | 100,000 reads/day<br>1,000 writes/day<br>1,000 deletes/day<br>1,000 list/day | 严格限制 | 低频配置数据 | ⚠️ 高风险 |
| **D1** | 100,000 reads/day<br>100,000 writes/day<br>5GB storage | 严格限制 | 关系型数据、缓存 | ✅ 中风险 |
| **Durable Objects** | 1,000,000 requests/month<br>400,000 GB-seconds | 月度限制 | 状态管理、实时数据 | ✅ 低风险 |
| **Cache API** | 无明确限制 | 区域隔离 | API响应、静态资源 | ✅ 无风险 |
| **R2** | 10GB storage<br>1,000,000 Class A ops/month<br>10,000,000 Class B ops/month | 月度限制 | 静态文件、备份 | ✅ 低风险 |

---

## 缓存架构修正方案 v2.1

### 核心原则

1. **KV仅用于低频配置**（<500次/天）
2. **高频数据直接使用Durable Objects**（100万次/月）
3. **报表数据使用Cache API + D1**（Cache API无限制）
4. **实时数据仅使用Durable Objects**（内存缓存）

### 存储方案选择矩阵

| 数据类型 | 预估写入频率 | 推荐方案 | 备选方案 | 避免使用 |
|----------|--------------|----------|----------|----------|
| **Campaign配置** | ~100次/天 | L2(Cache API) + L4(D1) | L3(DO) | ❌ KV |
| **Flow规则** | ~50次/天 | L2(Cache API) + L4(D1) | L3(DO) | ❌ KV |
| **Offer信息** | ~100次/天 | L2(Cache API) + L4(D1) | L3(DO) | ❌ KV |
| **实时统计** | ~50,000次/天 | L3(DO only) | - | ❌ KV, ❌ D1 |
| **小时报表** | ~24次/天 | L2(Cache API) + L4(D1) | - | ❌ KV |
| **日报表** | ~1次/天 | L2(Cache API) + L4(D1) | - | ❌ KV |
| **月报表** | ~1次/月 | L2(Cache API) + L4(D1) | - | ❌ KV |
| **用户会话** | ~10,000次/天 | L3(DO only) | - | ❌ KV, ❌ D1 |
| **点击事件缓冲** | ~100,000次/天 | L3(DO Buffer) | - | ❌ KV, ❌ D1 |
| **查询结果缓存** | ~5,000次/天 | L2(Cache API) + L3(DO) | - | ❌ KV |
| **静态资源** | ~10次/天 | L2(Cache API) | R2 | ❌ KV |

---

## 修正后的缓存层级架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    修正版多级缓存架构 v2.1                                  │
│                    (适配Cloudflare免费账户限制)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  L1: Browser Cache (Client-Side)                                           │
│  ├── Service Worker Cache (Static Assets)          TTL: 30 days            │
│  ├── LocalStorage (User Preferences)               TTL: Persistent         │
│  ├── IndexedDB (Report Data)                       TTL: 1 hour             │
│  └── Memory Cache (Active Session)                 TTL: Session            │
│                                                                             │
│  L2: Edge Cache (Cloudflare Cache API) ⚠️ 无写入限制                        │
│  ├── API Response Cache                            TTL: 5-60 min           │
│  ├── Report Data Cache                             TTL: 1-24 hours         │
│  └── Static Resource Cache                         TTL: 1-30 days          │
│  ⚠️ 注意：Cache API是区域性的，不同数据中心不共享                          │
│                                                                             │
│  L3: Durable Objects (Hot Data) ✅ 100万次/月                              │
│  ├── Real-time Stats Cache                         TTL: 1 min              │
│  ├── Session Store                                   TTL: 30 min           │
│  ├── Click Event Buffer                            TTL: 实时              │
│  └── Query Result Cache                            TTL: 5 min              │
│  ✅ 适合高频写入场景，月度配额充足                                          │
│                                                                             │
│  L4: Database Cache (D1) ✅ 10万次/天                                      │
│  ├── Query Result Cache                            TTL: 5-60 min           │
│  ├── Materialized Views (Pre-computed)             TTL: 1 hour             │
│  ├── Hourly Stats Table                            TTL: Permanent          │
│  ├── Daily Stats Table                             TTL: Permanent          │
│  └── Monthly Stats Table                           TTL: Permanent          │
│  ✅ 适合持久化缓存，日配额充足                                              │
│                                                                             │
│  ❌ 不使用：KV Namespace (仅1000次写入/天)                                  │
│     仅用于：系统配置、版本映射等极低频场景                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 高频数据写入方案

### 场景1：实时点击统计（~100,000次/天）

```typescript
// ❌ 错误方案：使用KV
await env.KV.put(`click:${clickId}`, data); // 会超限！

// ✅ 正确方案：使用Durable Objects
const id = env.SESSION_STORE.idFromName(`realtime:${campaignId}`);
const stub = env.SESSION_STORE.get(id);
await stub.fetch('https://internal/aggregate', {
  method: 'POST',
  body: JSON.stringify({ clickId, timestamp: Date.now() }),
});

// DO内部批量处理，定期写入D1
```

### 场景2：用户会话状态（~10,000次/天）

```typescript
// ❌ 错误方案：使用KV
await env.KV.put(`session:${sessionId}`, data); // 会超限！

// ✅ 正确方案：使用Durable Objects
const id = env.SESSION_STORE.idFromName(`session:${sessionId}`);
const stub = env.SESSION_STORE.get(id);
// DO自动保持状态，无需频繁写入
```

### 场景3：报表数据缓存（~24次/天）

```typescript
// ✅ 正确方案：使用Cache API + D1
// L2: Cache API（无限制）
const cache = await caches.open('reports');
await cache.put(request, response);

// L4: D1持久化（24次/天，安全）
await env.DB.prepare(`
  INSERT INTO daily_stats (...) VALUES (...)
`).run();
```

---

## 配额监控与告警

### 监控指标

```typescript
interface QuotaMonitor {
  // KV配额（严格限制）
  kv: {
    dailyWrites: number;
    limit: 1000;
    used: number; // 百分比
    status: 'safe' | 'warning' | 'critical';
  };
  
  // D1配额
  d1: {
    dailyReads: number;
    dailyWrites: number;
    readLimit: 100000;
    writeLimit: 100000;
    used: number;
    status: 'safe' | 'warning' | 'critical';
  };
  
  // DO配额（月度）
  do: {
    monthlyRequests: number;
    limit: 1000000;
    used: number;
    status: 'safe' | 'warning' | 'critical';
  };
}
```

### 告警阈值

| 服务 | 安全 | 警告 | 危险 |
|------|------|------|------|
| **KV写入** | <50% | 50-80% | >80% |
| **D1读取** | <50% | 50-80% | >80% |
| **D1写入** | <50% | 50-80% | >80% |
| **DO请求** | <50% | 50-80% | >80% |

### 降级策略

```typescript
// 当KV配额接近上限时，自动切换到DO
async function safeWrite(key: string, value: any, type: CacheDataType) {
  const strategy = CACHE_STRATEGIES[type];
  
  // 检查是否适合使用KV
  if (strategy.estimatedDailyWrites && strategy.estimatedDailyWrites > 500) {
    // 高频数据，直接使用DO
    return writeToDurableObject(env, key, value);
  }
  
  // 低频数据，可以使用KV
  if (!quotaMonitor.isKVQuotaExceeded()) {
    return env.KV.put(key, JSON.stringify(value));
  }
  
  // KV配额已满，降级到DO
  console.warn('[Quota] KV quota exceeded, falling back to DO');
  return writeToDurableObject(env, key, value);
}
```

---

## 实施检查清单

### 开发阶段

- [ ] 审查所有KV写入操作，标记高频写入
- [ ] 将高频写入（>500次/天）迁移到Durable Objects
- [ ] 将报表缓存迁移到Cache API + D1
- [ ] 实现配额监控和告警
- [ ] 实现自动降级策略

### 测试阶段

- [ ] 模拟高并发场景，验证配额不超限
- [ ] 测试降级策略是否正常工作
- [ ] 验证Cache API在边缘节点的命中率
- [ ] 测试Durable Objects的持久化能力

### 上线阶段

- [ ] 配置配额监控Dashboard
- [ ] 设置告警通知（Slack/Email）
- [ ] 准备应急方案（配额超限时的处理）
- [ ] 定期审查配额使用情况

---

## 修正后的性能预期

| 指标 | 原方案 | 修正方案 | 变化 |
|------|--------|----------|------|
| **KV写入次数** | ~50,000/天 | <500/天 | -99% ✅ |
| **DO请求次数** | ~10,000/月 | ~500,000/月 | +4900% ✅ |
| **D1读取次数** | ~80,000/天 | <50,000/天 | -37% ✅ |
| **Cache API使用** | 少量 | 大量 | 新增 ✅ |
| **配额超限风险** | 高 | 低 | 显著降低 ✅ |

---

## 总结

### 核心变更

1. **移除KV作为高频缓存层** - 仅用于极低频配置（<500次/天）
2. **Cache API替代KV** - 无写入限制，适合报表缓存
3. **Durable Objects承担高频写入** - 100万次/月配额充足
4. **D1用于持久化缓存** - 10万次/天配额，配合预计算策略

### 优势

- ✅ 完全避免KV配额超限风险
- ✅ Cache API无写入限制，性能更好
- ✅ Durable Objects月度配额充足
- ✅ 整体架构更简洁，维护成本更低

### 注意事项

- ⚠️ Cache API是区域性的，不同数据中心不共享
- ⚠️ 需要实现版本号机制支持批量失效
- ⚠️ 需要监控DO月度配额使用情况

---

*文档版本: v2.1*  
*更新日期: 2026-03-31*  
*更新原因: 适配Cloudflare免费账户KV写入限制（1000次/天）*
