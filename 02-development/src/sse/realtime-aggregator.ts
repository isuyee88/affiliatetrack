// src/sse/realtime-aggregator.ts
// SSE实时推送 - Durable Object实现

import type { Env } from '../types';

export interface CampaignStats {
  campaignId: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cost: number;
  lastUpdated: number;
}

export interface SSEMessage {
  type: 'init' | 'update' | 'heartbeat';
  stats?: CampaignStats[];
  timestamp?: number;
}

/**
 * 实时聚合Durable Object
 * 管理SSE连接和实时数据推送
 */
export class RealtimeAggregator implements DurableObject {
  private state: DurableObjectState;
  private connections: Map<string, WritableStreamDefaultWriter> = new Map();
  private stats: Map<number, CampaignStats> = new Map();
  private updateInterval: number | null = null;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // 从持久化存储恢复
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<number, CampaignStats>>('stats');
      if (stored) {
        this.stats = stored;
      }
    });

    // 启动数据广播定时器（每秒）
    this.updateInterval = setInterval(() => this.broadcastUpdates(), 1000);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/subscribe') {
      return this.handleSubscribe(request);
    } else if (url.pathname === '/publish') {
      return this.handlePublish(request);
    } else if (url.pathname === '/stats') {
      return this.handleGetStats();
    }
    
    return new Response('Not found', { status: 404 });
  }

  /**
   * 处理SSE订阅请求
   */
  private async handleSubscribe(request: Request): Promise<Response> {
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    
    // 生成连接ID
    const connectionId = crypto.randomUUID();
    this.connections.set(connectionId, writer);

    // 发送初始数据
    const initMessage: SSEMessage = {
      type: 'init',
      stats: Array.from(this.stats.values()),
      timestamp: Date.now(),
    };
    
    await writer.write(
      encoder.encode(`data: ${JSON.stringify(initMessage)}\n\n`)
    );

    // 心跳保持连接（每30秒）
    const heartbeat = setInterval(async () => {
      try {
        await writer.write(encoder.encode(': heartbeat\n\n'));
      } catch {
        clearInterval(heartbeat);
        this.connections.delete(connectionId);
      }
    }, 30000);

    // 返回SSE响应
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  /**
   * 处理数据发布
   */
  private async handlePublish(request: Request): Promise<Response> {
    const data = await request.json<{
      campaignId: number;
      clicks?: number;
      conversions?: number;
      revenue?: number;
      cost?: number;
    }>();

    // 更新内存统计
    const existing = this.stats.get(data.campaignId);
    
    if (existing) {
      this.stats.set(data.campaignId, {
        ...existing,
        clicks: existing.clicks + (data.clicks || 0),
        conversions: existing.conversions + (data.conversions || 0),
        revenue: existing.revenue + (data.revenue || 0),
        cost: existing.cost + (data.cost || 0),
        lastUpdated: Date.now(),
      });
    } else {
      this.stats.set(data.campaignId, {
        campaignId: data.campaignId,
        clicks: data.clicks || 0,
        conversions: data.conversions || 0,
        revenue: data.revenue || 0,
        cost: data.cost || 0,
        lastUpdated: Date.now(),
      });
    }

    // 持久化到存储
    await this.state.storage.put('stats', this.stats);

    return new Response('OK');
  }

  /**
   * 获取当前统计
   */
  private async handleGetStats(): Promise<Response> {
    return new Response(
      JSON.stringify(Array.from(this.stats.values())),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * 广播更新到所有连接
   */
  private async broadcastUpdates(): Promise<void> {
    if (this.connections.size === 0) return;

    const encoder = new TextEncoder();
    const message: SSEMessage = {
      type: 'update',
      stats: Array.from(this.stats.values()),
      timestamp: Date.now(),
    };
    
    const data = encoder.encode(`data: ${JSON.stringify(message)}\n\n`);

    // 并发发送到所有连接
    await Promise.allSettled(
      Array.from(this.connections.entries()).map(async ([id, writer]) => {
        try {
          await writer.write(data);
        } catch (error) {
          console.error(`[SSE] Failed to send to ${id}:`, error);
          this.connections.delete(id);
        }
      })
    );
  }
}

/**
 * 发布点击事件到实时聚合器
 */
export async function publishClickEvent(
  env: Env,
  campaignId: number,
  event: { clicks?: number; conversions?: number; revenue?: number; cost?: number }
): Promise<void> {
  const id = env.REALTIME_AGGREGATOR.idFromName('global');
  const stub = env.REALTIME_AGGREGATOR.get(id);
  
  await stub.fetch('https://aggregator.internal/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, ...event }),
  });
}
