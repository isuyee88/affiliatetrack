// src/ssr/index.tsx
// SSR服务器端渲染入口

import { renderToReadableStream } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../../frontend/src/App';
import type { Env, InitialData } from '../types';

export interface SSRContext {
  url: string;
  initialData: InitialData;
  queryClient: QueryClient;
}

/**
 * 渲染SSR页面
 */
export async function renderSSR(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  
  // 1. 预取数据
  const initialData = await prefetchData(url, env);
  
  // 2. 创建QueryClient用于SSR
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
  
  // 3. 预填充QueryClient缓存
  prefetchQueries(queryClient, initialData);
  
  // 4. 渲染React组件为流
  const stream = await renderToReadableStream(
    <StaticRouter location={url.pathname}>
      <QueryClientProvider client={queryClient}>
        <App initialData={initialData} />
      </QueryClientProvider>
    </StaticRouter>,
    {
      bootstrapScripts: ['/assets/client.js'],
      onError(error) {
        console.error('SSR Error:', error);
      },
    }
  );

  // 5. 序列化初始数据用于hydration
  const dehydratedState = dehydrate(queryClient);
  
  // 6. 返回流式HTML响应
  return new Response(
    wrapStreamWithHtml(stream, dehydratedState, initialData),
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'X-SSR-Rendered': 'true',
      },
    }
  );
}

/**
 * 根据路由预取数据
 */
async function prefetchData(url: URL, env: Env): Promise<InitialData> {
  const data: InitialData = {
    user: null,
    campaigns: [],
    stats: null,
  };
  
  // 根据路由预取不同数据
  if (url.pathname === '/dashboard' || url.pathname === '/') {
    // 预取Dashboard数据
    const [campaigns, stats] = await Promise.all([
      fetchCampaigns(env),
      fetchDashboardStats(env),
    ]);
    data.campaigns = campaigns;
    data.stats = stats;
  } else if (url.pathname.startsWith('/campaigns/')) {
    // 预取Campaign详情
    const id = url.pathname.split('/')[2];
    const [campaign, stats] = await Promise.all([
      fetchCampaign(env, id),
      fetchCampaignStats(env, id),
    ]);
    data.campaign = campaign;
    data.stats = stats;
  } else if (url.pathname === '/reports') {
    // 预取报表数据
    const reports = await fetchReports(env);
    data.reports = reports;
  }
  
  return data;
}

/**
 * 预填充React Query缓存
 */
function prefetchQueries(queryClient: QueryClient, data: InitialData): void {
  if (data.campaigns) {
    queryClient.setQueryData(['campaigns'], data.campaigns);
  }
  if (data.stats) {
    queryClient.setQueryData(['stats'], data.stats);
  }
  if (data.campaign) {
    queryClient.setQueryData(['campaign', data.campaign.id], data.campaign);
  }
  if (data.reports) {
    queryClient.setQueryData(['reports'], data.reports);
  }
}

/**
 * 包装流为完整HTML
 */
function wrapStreamWithHtml(
  stream: ReadableStream,
  dehydratedState: unknown,
  initialData: InitialData
): ReadableStream {
  const encoder = new TextEncoder();
  
  // HTML头部
  const head = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CloudAffiliate Tracker</title>
  <link rel="stylesheet" href="/assets/styles.css">
  <script>
    window.__INITIAL_DATA__ = ${JSON.stringify(initialData).replace(/</g, '\\u003c')};
    window.__REACT_QUERY_STATE__ = ${JSON.stringify(dehydratedState).replace(/</g, '\\u003c')};
  </script>
</head>
<body>
  <div id="root">`;

  // HTML尾部
  const tail = `</div>
  <script src="/assets/client.js" type="module"></script>
</body>
</html>`;

  // 创建转换流
  const transformStream = new TransformStream({
    start(controller) {
      controller.enqueue(encoder.encode(head));
    },
    flush(controller) {
      controller.enqueue(encoder.encode(tail));
    },
  });

  return stream.pipeThrough(transformStream);
}

// 数据获取辅助函数
async function fetchCampaigns(env: Env) {
  const result = await env.DB.prepare(`
    SELECT * FROM campaigns WHERE status = 'active' LIMIT 20
  `).all();
  return result.results;
}

async function fetchCampaign(env: Env, id: string) {
  const result = await env.DB.prepare(`
    SELECT * FROM campaigns WHERE id = ?
  `).bind(id).first();
  return result;
}

async function fetchDashboardStats(env: Env) {
  const today = new Date().toISOString().split('T')[0];
  const result = await env.DB.prepare(`
    SELECT 
      SUM(clicks) as clicks,
      SUM(conversions) as conversions,
      SUM(revenue) as revenue,
      SUM(cost) as cost
    FROM daily_stats
    WHERE date = ?
  `).bind(today).first();
  return result;
}

async function fetchCampaignStats(env: Env, id: string) {
  const today = new Date().toISOString().split('T')[0];
  const result = await env.DB.prepare(`
    SELECT 
      SUM(clicks) as clicks,
      SUM(conversions) as conversions,
      SUM(revenue) as revenue,
      SUM(cost) as cost
    FROM daily_stats
    WHERE campaign_id = ? AND date = ?
  `).bind(id, today).first();
  return result;
}

async function fetchReports(env: Env) {
  const result = await env.DB.prepare(`
    SELECT * FROM daily_stats 
    ORDER BY date DESC 
    LIMIT 30
  `).all();
  return result.results;
}

// 简单的dehydrate实现
function dehydrate(queryClient: QueryClient): unknown {
  // 实际项目中使用@tanstack/react-query的dehydrate
  return {};
}
