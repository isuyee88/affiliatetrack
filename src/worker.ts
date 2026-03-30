/**
 * AffiliateTrack - Cloudflare Worker 入口文件
 * 对标 Keitaro 的 Affiliate 流量跟踪系统
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';

// 导入路由
import { trackRoutes } from './api/track';
import { adminRoutes } from './api/admin';
import { reportRoutes } from './api/report';
import { authRoutes } from './api/auth';
import { trafficSourcesRoutes } from './api/traffic-sources';
import { affiliateNetworksRoutes } from './api/affiliate-networks';
import { flowsRoutes } from './api/flows';
import { logsRoutes } from './api/logs';
import { domainsRoutes } from './api/domains';
import { groupsRoutes } from './api/groups';
import { settingsRoutes } from './api/settings';

// 导入中间件
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { errorHandler } from './middleware/error-handler';

// 导入 Durable Objects
export { SessionManager } from './durable-objects/session-manager';
export { StatsAggregator } from './durable-objects/stats-aggregator';
export { TrafficRouter } from './durable-objects/traffic-router';

// 导入环境类型
import type { Env } from './types';

// 创建主应用
const app = new Hono<{ Bindings: Env }>();

// 全局中间件
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
app.use('*', prettyJSON());

// 速率限制
app.use('/api/*', rateLimitMiddleware);

// 健康检查
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: c.env.API_VERSION,
  });
});

// API 版本信息
app.get('/api', (c) => {
  return c.json({
    name: 'AffiliateTrack API',
    version: c.env.API_VERSION,
    endpoints: {
      track: '/api/track',
      admin: '/api/admin',
      report: '/api/report',
      auth: '/api/auth',
      traffic_sources: '/api/traffic-sources',
      affiliate_networks: '/api/affiliate-networks',
      flows: '/api/flows',
      logs: '/api/logs',
      domains: '/api/domains',
      groups: '/api/groups',
      settings: '/api/settings',
    },
  });
});

// 挂载路由
app.route('/api/track', trackRoutes);                           // 追踪 API (公开)
app.route('/api/admin', adminRoutes);                            // 管理 API (需认证)
app.route('/api/report', reportRoutes);                          // 报表 API (需认证)
app.route('/api/auth', authRoutes);                              // 认证 API
app.route('/api/traffic-sources', trafficSourcesRoutes);         // 流量源 API
app.route('/api/affiliate-networks', affiliateNetworksRoutes);   // 联盟网络 API
app.route('/api/flows', flowsRoutes);                            // Flows API
app.route('/api/logs', logsRoutes);                              // Logs API
app.route('/api/domains', domainsRoutes);                        // Domains API
app.route('/api/groups', groupsRoutes);                          // Groups API
app.route('/api/settings', settingsRoutes);                      // Settings API

// 静态资源服务 (管理后台)
app.get('/*', async (c, next) => {
  // 检查是否是静态资源请求
  const path = c.req.path;
  if (path.startsWith('/api')) {
    return next();
  }
  
  // 对于前端路由，返回 index.html
  // 注意：实际部署时需要配置 Cloudflare Pages 或使用 Workers Sites
  return next();
});

// 错误处理
app.onError(errorHandler);

// 404 处理
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

// 导出 Worker 处理函数
export default app;
