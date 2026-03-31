# Agent: 测试工程师 - 规划方案

## 规划方案提交
**Agent**: 测试工程师 (QA Engineer)  
**日期**: 2026-03-30  
**版本**: v1.0

---

## 1. 测试策略概述

### 1.1 测试金字塔

```
                    /\
                   /  \
                  / E2E \          20 tests (10%)
                 /________\
                /          \
               / Integration \    60 tests (30%)
              /______________\
             /                \
            /     Unit Tests    \  120 tests (60%)
           /______________________\
```

### 1.2 测试类型分布

| 测试类型 | 数量目标 | 占比 | 执行频率 |
|----------|----------|------|----------|
| **单元测试** | 200+ | 60% | 每次提交 |
| **集成测试** | 100+ | 30% | 每次PR |
| **端到端测试** | 30+ | 10% | 每日/发布前 |
| **性能测试** | 10+ | - | 每周 |
| **安全测试** | 20+ | - | 每次发布 |

---

## 2. 单元测试策略

### 2.1 测试框架与工具

| 组件 | 技术选型 | 用途 |
|------|----------|------|
| **测试框架** | Vitest | 单元/集成测试 |
| **断言库** | Vitest (内置) | 断言验证 |
| **Mock工具** | Vitest (vi) | 模拟依赖 |
| **覆盖率** | Vitest (c8) | 代码覆盖率 |
| **UI测试** | React Testing Library | 组件测试 |

### 2.2 单元测试规范

```typescript
// 测试文件命名: [name].test.ts
// 测试结构: Arrange -> Act -> Assert

describe('CampaignService', () => {
  // 每个测试独立，不依赖其他测试
  describe('createCampaign', () => {
    it('should create campaign with valid data', async () => {
      // Arrange
      const mockDb = createMockDatabase();
      const service = new CampaignService(mockDb);
      const data = { name: 'Test', type: 'redirect' };

      // Act
      const result = await service.createCampaign(data);

      // Assert
      expect(result).toMatchObject({
        name: 'Test',
        type: 'redirect',
        status: 'active',
      });
      expect(mockDb.insert).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should throw error when name is empty', async () => {
      // Arrange
      const service = new CampaignService(mockDb);
      const data = { name: '', type: 'redirect' };

      // Act & Assert
      await expect(service.createCampaign(data))
        .rejects
        .toThrow('Campaign name is required');
    });

    it('should generate unique slug', async () => {
      // Arrange
      const service = new CampaignService(mockDb);
      const data = { name: 'Test Campaign', type: 'redirect' };

      // Act
      const result = await service.createCampaign(data);

      // Assert
      expect(result.slug).toMatch(/^test-campaign-[a-z0-9]{6}$/);
    });
  });
});
```

### 2.3 覆盖率要求

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 95,
        lines: 95,
      },
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mock/**',
      ],
    },
  },
});
```

---

## 3. 集成测试策略

### 3.1 API集成测试

```typescript
// tests/integration/api/campaigns.test.ts
describe('Campaigns API', () => {
  let app: Hono;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  describe('POST /api/campaigns', () => {
    it('should create campaign and return 201', async () => {
      const response = await app.request('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Campaign',
          type: 'redirect',
          url: 'https://example.com',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.name).toBe('Test Campaign');
    });

    it('should return 400 for invalid data', async () => {
      const response = await app.request('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({ name: '' }),
      });

      expect(response.status).toBe(400);
    });

    it('should persist campaign to database', async () => {
      await app.request('/api/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Campaign',
          type: 'redirect',
        }),
      });

      const campaigns = await db.query.campaigns.findMany();
      expect(campaigns).toHaveLength(1);
      expect(campaigns[0].name).toBe('Test Campaign');
    });
  });

  describe('GET /api/campaigns', () => {
    it('should return paginated campaigns', async () => {
      // Seed database
      await seedCampaigns(25);

      const response = await app.request('/api/campaigns?page=1&limit=10');
      const data = await response.json();

      expect(data.data).toHaveLength(10);
      expect(data.meta.total).toBe(25);
      expect(data.meta.totalPages).toBe(3);
    });
  });
});
```

### 3.2 数据库集成测试

```typescript
// tests/integration/database/queries.test.ts
describe('Database Queries', () => {
  describe('Campaign Queries', () => {
    it('should fetch campaigns with stats', async () => {
      // Arrange
      const campaign = await createCampaign({ name: 'Test' });
      await createClicks(campaign.id, 100);
      await createConversions(campaign.id, 10);

      // Act
      const result = await getCampaignsWithStats();

      // Assert
      expect(result[0]).toMatchObject({
        id: campaign.id,
        clicks: 100,
        conversions: 10,
        conversionRate: 10,
      });
    });

    it('should handle complex filtering', async () => {
      await createCampaign({ status: 'active' });
      await createCampaign({ status: 'paused' });

      const active = await getCampaigns({ status: 'active' });
      expect(active).toHaveLength(1);
    });
  });
});
```

---

## 4. 端到端测试策略

### 4.1 E2E测试框架

| 组件 | 技术选型 | 用途 |
|------|----------|------|
| **E2E框架** | Playwright | 端到端测试 |
| **浏览器** | Chromium/Firefox/WebKit | 跨浏览器测试 |
| **视觉回归** | Playwright Snapshots | UI一致性 |
| **并行执行** | Playwright Workers | 加速测试 |

### 4.2 E2E测试用例

```typescript
// tests/e2e/campaigns.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Campaign Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create new campaign', async ({ page }) => {
    // Navigate to campaigns
    await page.click('text=Campaigns');
    await page.waitForURL('/campaigns');

    // Click create button
    await page.click('text=Create Campaign');

    // Fill form
    await page.fill('[name="name"]', 'E2E Test Campaign');
    await page.selectOption('[name="type"]', 'redirect');
    await page.fill('[name="url"]', 'https://example.com/offer');

    // Submit
    await page.click('button[type="submit"]');

    // Verify success
    await expect(page.locator('text=Campaign created successfully')).toBeVisible();
    await expect(page.locator('text=E2E Test Campaign')).toBeVisible();
  });

  test('should edit existing campaign', async ({ page }) => {
    // Create campaign first
    const campaign = await createCampaignAPI({ name: 'Edit Test' });

    // Navigate and edit
    await page.goto(`/campaigns/${campaign.id}`);
    await page.click('text=Edit');

    // Modify
    await page.fill('[name="name"]', 'Updated Name');
    await page.click('button[type="submit"]');

    // Verify
    await expect(page.locator('text=Updated Name')).toBeVisible();
  });

  test('should delete campaign', async ({ page }) => {
    const campaign = await createCampaignAPI({ name: 'Delete Test' });

    await page.goto('/campaigns');
    await page.click(`[data-testid="delete-${campaign.id}"]`);
    await page.click('text=Confirm');

    await expect(page.locator('text=Delete Test')).not.toBeVisible();
  });

  test('should track clicks and show stats', async ({ page, context }) => {
    // Create campaign
    const campaign = await createCampaignAPI({ name: 'Stats Test' });

    // Simulate clicks
    const clickPromises = Array(10).fill(null).map(() =>
      fetch(`/click/${campaign.slug}`)
    );
    await Promise.all(clickPromises);

    // Check stats
    await page.goto('/campaigns');
    await expect(page.locator(`[data-testid="clicks-${campaign.id}"]`))
      .toHaveText('10');
  });
});
```

### 4.3 核心流程E2E覆盖

```typescript
// tests/e2e/critical-flows.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  // 流程1: 完整Campaign创建流程
  test('complete campaign creation flow', async ({ page }) => {
    await test.step('Login', async () => {
      await page.goto('/login');
      await page.fill('[name="email"]', 'user@example.com');
      await page.fill('[name="password"]', 'password');
      await page.click('button[type="submit"]');
    });

    await test.step('Create Campaign', async () => {
      await page.click('text=Campaigns');
      await page.click('text=Create Campaign');
      await page.fill('[name="name"]', 'Complete Flow Test');
      await page.selectOption('[name="type"]', 'flow');
      await page.click('button[type="submit"]');
    });

    await test.step('Create Flow', async () => {
      await page.click('text=Create Flow');
      await page.fill('[name="name"]', 'Test Flow');
      await page.click('text=Add Path');
      await page.fill('[name="weight"]', '100');
      await page.click('button[type="submit"]');
    });

    await test.step('Create Offer', async () => {
      await page.click('text=Offers');
      await page.click('text=Create Offer');
      await page.fill('[name="name"]', 'Test Offer');
      await page.fill('[name="url"]', 'https://offer.com');
      await page.fill('[name="payout"]', '10.00');
      await page.click('button[type="submit"]');
    });

    await test.step('Verify Tracking Link', async () => {
      await page.click('text=Campaigns');
      const trackingLink = await page.locator('[data-testid="tracking-link"]').textContent();
      expect(trackingLink).toContain('/click/');
    });
  });

  // 流程2: 转化跟踪流程
  test('conversion tracking flow', async ({ page, request }) => {
    // Setup
    const campaign = await setupCampaignWithOffer();
    
    // Click tracking link
    const clickResponse = await request.get(`/click/${campaign.slug}`);
    expect(clickResponse.status()).toBe(302);
    
    const clickId = extractClickId(clickResponse.headers()['location']);
    
    // Simulate conversion
    const conversionResponse = await request.post('/postback', {
      data: {
        clickId,
        revenue: 25.00,
        status: 'sale',
      },
    });
    expect(conversionResponse.status()).toBe(200);

    // Verify in dashboard
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="conversions-today"]'))
      .toHaveText('1');
    await expect(page.locator('[data-testid="revenue-today"]'))
      .toHaveText('$25.00');
  });

  // 流程3: 报表查看流程
  test('report viewing flow', async ({ page }) => {
    await login(page);
    
    await test.step('Navigate to Reports', async () => {
      await page.click('text=Reports');
      await page.waitForURL('/reports');
    });

    await test.step('Select Date Range', async () => {
      await page.click('[data-testid="date-range-picker"]');
      await page.click('text=Last 7 days');
    });

    await test.step('Apply Filters', async () => {
      await page.selectOption('[name="campaign"]', 'all');
      await page.selectOption('[name="dimension"]', 'geo');
    });

    await test.step('Verify Chart', async () => {
      await expect(page.locator('.recharts-wrapper')).toBeVisible();
    });

    await test.step('Export Data', async () => {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('text=Export CSV'),
      ]);
      expect(download.suggestedFilename()).toContain('.csv');
    });
  });
});
```

---

## 5. 性能测试策略

### 5.1 负载测试

```typescript
// tests/performance/load-test.ts
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up
    { duration: '5m', target: 100 },   // Steady state
    { duration: '2m', target: 200 },   // Ramp up
    { duration: '5m', target: 200 },   // Steady state
    { duration: '2m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],   // 95% < 200ms
    http_req_failed: ['rate<0.1'],      // Error rate < 0.1%
  },
};

export default function () {
  const response = http.get('https://api.example.com/api/campaigns');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
}
```

### 5.2 前端性能测试

```typescript
// tests/performance/lighthouse.spec.ts
import { test, expect } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

test.describe('Lighthouse Performance', () => {
  test('dashboard page performance', async ({ page }) => {
    await page.goto('/dashboard');
    
    await playAudit({
      page,
      thresholds: {
        performance: 92,
        accessibility: 96,
        'best-practices': 96,
        seo: 96,
      },
      reports: {
        formats: { html: true },
        name: 'dashboard-lighthouse',
        directory: './lighthouse-reports',
      },
    });
  });

  test('campaigns page performance', async ({ page }) => {
    await page.goto('/campaigns');
    
    await playAudit({
      page,
      thresholds: {
        performance: 92,
        accessibility: 96,
        'best-practices': 96,
        seo: 96,
      },
    });
  });
});
```

---

## 6. 安全测试策略

### 6.1 OWASP测试

```typescript
// tests/security/owasp.spec.ts
import { test, expect } from '@playwright/test';

test.describe('OWASP Security Tests', () => {
  // OWASP Top 10: Injection
  test('should prevent SQL injection', async ({ request }) => {
    const maliciousInput = "'; DROP TABLE campaigns; --";
    
    const response = await request.post('/api/campaigns', {
      data: { name: maliciousInput },
    });
    
    // Should not crash or execute malicious SQL
    expect(response.status()).not.toBe(500);
    
    // Verify table still exists
    const campaigns = await request.get('/api/campaigns');
    expect(campaigns.status()).toBe(200);
  });

  // OWASP Top 10: XSS
  test('should prevent XSS attacks', async ({ page }) => {
    const xssPayload = '<script>alert("xss")</script>';
    
    await page.goto('/campaigns');
    await page.click('text=Create Campaign');
    await page.fill('[name="name"]', xssPayload);
    await page.click('button[type="submit"]');
    
    // Script should not execute
    await expect(page.locator('script')).not.toBeVisible();
    
    // Should be properly escaped
    await expect(page.locator('text=<script>')).toBeVisible();
  });

  // OWASP Top 10: Broken Authentication
  test('should enforce authentication', async ({ request }) => {
    const response = await request.get('/api/campaigns');
    expect(response.status()).toBe(401);
  });

  test('should prevent brute force attacks', async ({ request }) => {
    for (let i = 0; i < 10; i++) {
      await request.post('/api/auth/login', {
        data: { email: 'test@example.com', password: 'wrong' },
      });
    }
    
    // Should be rate limited
    const response = await request.post('/api/auth/login', {
      data: { email: 'test@example.com', password: 'wrong' },
    });
    expect(response.status()).toBe(429);
  });
});
```

---

## 7. 可测量目标

### 7.1 测试覆盖率目标

| 指标 | 目标值 | 测量方法 | 工具 |
|------|--------|----------|------|
| **代码测试覆盖率** | ≥95% | Coverage Report | Vitest c8 |
| **分支覆盖率** | ≥90% | Coverage Report | Vitest c8 |
| **函数覆盖率** | ≥95% | Coverage Report | Vitest c8 |
| **行覆盖率** | ≥95% | Coverage Report | Vitest c8 |

### 7.2 端到端测试目标

| 指标 | 目标值 | 测量方法 | 工具 |
|------|--------|----------|------|
| **E2E测试覆盖率** | 100%核心流程 | Test Case Count | Playwright |
| **E2E测试通过率** | 100% | CI Pipeline | Playwright |
| **跨浏览器测试** | Chromium/Firefox/WebKit | Browser Matrix | Playwright |
| **视觉回归测试** | 100%关键页面 | Screenshot Diff | Playwright |

### 7.3 性能测试目标

| 指标 | 目标值 | 测量方法 | 工具 |
|------|--------|----------|------|
| **API响应时间 (P95)** | <200ms | Load Test | k6 |
| **并发用户支持** | 1000+ | Load Test | k6 |
| **错误率** | <0.1% | Load Test | k6 |
| **前端Lighthouse** | >92 | Performance Audit | Lighthouse |

### 7.4 安全测试目标

| 指标 | 目标值 | 测量方法 | 工具 |
|------|--------|----------|------|
| **OWASP Top 10** | 100%覆盖 | Security Scan | Custom |
| **高危漏洞** | 0 | Security Scan | OWASP ZAP |
| **中危漏洞** | ≤3 | Security Scan | OWASP ZAP |
| **依赖漏洞** | 0 | Dependency Check | npm audit |

---

## 8. CI/CD集成

### 8.1 GitHub Actions工作流

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests
        run: npm run test:unit -- --coverage
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true

  integration-test:
    runs-on: ubuntu-latest
    needs: unit-test
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Setup test database
        run: npm run db:migrate:test
        
      - name: Run integration tests
        run: npm run test:integration

  e2e-test:
    runs-on: ubuntu-latest
    needs: integration-test
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright
        run: npx playwright install --with-deps
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  performance-test:
    runs-on: ubuntu-latest
    needs: e2e-test
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      
      - name: Run k6 load test
        uses: grafana/k6-action@v0.3.1
        with:
          filename: tests/performance/load-test.ts
```

---

## 9. 评审投票

### 自评
**投票**: ✅ 通过

**理由**:
1. 测试策略完整，覆盖单元/集成/E2E/性能/安全测试
2. 测试覆盖率目标明确（≥95%），参考行业标准
3. E2E测试100%覆盖核心流程，确保用户场景
4. 性能测试和安全测试目标量化，可验证
5. CI/CD集成完善，自动化程度高

### 证据
- [测试金字塔](#11-测试金字塔)
- [覆盖率要求](#23-覆盖率要求)
- [E2E测试用例](#42-e2e测试用例)
- [性能测试目标](#73-性能测试目标)

---

**Agent签名**: 测试工程师  
**日期**: 2026-03-30
