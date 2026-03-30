/**
 * Session Manager Durable Object
 * 管理点击会话状态
 */

import type { SessionState } from '../types';

export class SessionManager implements DurableObject {
  private state: DurableObjectState;
  private sessions: Map<string, SessionState> = new Map();

  constructor(state: DurableObjectState) {
    this.state = state;
    // 从存储中恢复状态
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<Map<string, SessionState>>('sessions');
      if (stored) {
        this.sessions = stored;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 创建会话
    if (path === '/session' && request.method === 'POST') {
      return this.createSession(request);
    }

    // 获取会话
    if (path.startsWith('/session/') && request.method === 'GET') {
      const clickId = path.split('/')[2];
      return this.getSession(clickId);
    }

    // 添加转化
    if (path === '/session/conversion' && request.method === 'POST') {
      return this.addConversion(request);
    }

    // 过期会话
    if (path.startsWith('/session/') && request.method === 'DELETE') {
      const clickId = path.split('/')[2];
      return this.expireSession(clickId);
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * 创建新会话
   */
  private async createSession(request: Request): Promise<Response> {
    const data = await request.json() as {
      clickId: string;
      campaignId: string;
      offerId: string | null;
      attributes: any;
    };

    const now = Date.now();
    const session: SessionState = {
      clickId: data.clickId,
      campaignId: data.campaignId,
      offerId: data.offerId,
      createdAt: now,
      expiresAt: now + 86400000, // 24小时后过期
      attributes: data.attributes,
      conversions: [],
    };

    this.sessions.set(data.clickId, session);
    await this.persist();

    return new Response(JSON.stringify({ success: true, clickId: data.clickId }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 获取会话
   */
  private async getSession(clickId: string): Promise<Response> {
    const session = this.sessions.get(clickId);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 检查是否过期
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(clickId);
      await this.persist();
      return new Response(JSON.stringify({ error: 'Session expired' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(session), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 添加转化
   */
  private async addConversion(request: Request): Promise<Response> {
    const data = await request.json() as {
      conversionId: string;
      status: string;
      revenue: number;
    };

    // 从请求头或 URL 获取 clickId
    const url = new URL(request.url);
    const clickId = url.searchParams.get('clickId') || request.headers.get('X-Click-Id');

    if (!clickId) {
      return new Response(JSON.stringify({ error: 'clickId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = this.sessions.get(clickId);

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 添加转化记录
    session.conversions.push({
      conversionId: data.conversionId,
      status: data.status,
      revenue: data.revenue,
      timestamp: Date.now(),
    });

    this.sessions.set(clickId, session);
    await this.persist();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 过期会话
   */
  private async expireSession(clickId: string): Promise<Response> {
    this.sessions.delete(clickId);
    await this.persist();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 持久化存储
   */
  private async persist(): Promise<void> {
    await this.state.storage.put('sessions', this.sessions);
  }
}
