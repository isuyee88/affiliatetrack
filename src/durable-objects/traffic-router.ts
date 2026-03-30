/**
 * Traffic Router Durable Object
 * 流量分发决策引擎
 */

import type { DistributionConfig, DistributionRule, RuleCondition, RuleAction } from '../types';

interface RouteRequest {
  campaignId: string;
  ip: string;
  userAgent: string;
  country: string;
  deviceType: string;
  os: string;
  browser: string;
}

interface RouteDecision {
  offerId: string | null;
  landerId: string | null;
  redirectUrl: string;
  matchedRule: string | null;
}

interface RouterData {
  campaignId: string;
  config: DistributionConfig | null;
  distribution: {
    offerStats: Map<string, number>;
    landerStats: Map<string, number>;
  };
}

export class TrafficRouter implements DurableObject {
  private state: DurableObjectState;
  private data: RouterData;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.data = {
      campaignId: '',
      config: null,
      distribution: {
        offerStats: new Map(),
        landerStats: new Map(),
      },
    };

    // 恢复状态
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<RouterData>('data');
      if (stored) {
        this.data = {
          ...stored,
          distribution: {
            offerStats: new Map(Object.entries(stored.distribution?.offerStats || {})),
            landerStats: new Map(Object.entries(stored.distribution?.landerStats || {})),
          },
        };
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 路由决策
    if (path === '/route' && request.method === 'POST') {
      return this.route(request);
    }

    // 更新配置
    if (path === '/config' && request.method === 'POST') {
      return this.updateConfig(request);
    }

    // 获取分发统计
    if (path === '/stats' && request.method === 'GET') {
      return this.getDistributionStats();
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * 执行路由决策
   */
  private async route(request: Request): Promise<Response> {
    const data = await request.json() as RouteRequest;

    // 如果没有配置，从数据库加载
    if (!this.data.config) {
      // 需要从外部传入配置或从数据库加载
      // 这里使用默认的加权分发
      return this.defaultWeightedRoute(data);
    }

    const config = this.data.config;

    // 1. 检查规则
    for (const rule of config.rules || []) {
      if (this.matchRule(rule, data)) {
        const decision = this.executeAction(rule.action, data);
        if (decision) {
          // 更新统计
          this.updateDistributionStats(decision);
          await this.persist();

          return new Response(JSON.stringify(decision), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // 2. 根据分发类型处理
    switch (config.type) {
      case 'weighted':
        return this.weightedRoute(data, config);
      case 'ab_test':
        return this.abTestRoute(data, config);
      case 'geo':
        return this.geoRoute(data, config);
      case 'device':
        return this.deviceRoute(data, config);
      default:
        return this.defaultWeightedRoute(data);
    }
  }

  /**
   * 匹配规则
   */
  private matchRule(rule: DistributionRule, data: RouteRequest): boolean {
    for (const condition of rule.conditions) {
      const value = this.getFieldValue(condition.field, data);
      
      if (!this.evaluateCondition(condition, value)) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取字段值
   */
  private getFieldValue(field: string, data: RouteRequest): string {
    switch (field) {
      case 'country':
        return data.country;
      case 'device_type':
        return data.deviceType;
      case 'os':
        return data.os;
      case 'browser':
        return data.browser;
      default:
        return '';
    }
  }

  /**
   * 评估条件
   */
  private evaluateCondition(condition: RuleCondition, value: string): boolean {
    const conditionValue = Array.isArray(condition.value) 
      ? condition.value 
      : [condition.value];

    switch (condition.operator) {
      case 'equals':
        return value === conditionValue[0];
      case 'not_equals':
        return value !== conditionValue[0];
      case 'in':
        return conditionValue.includes(value);
      case 'not_in':
        return !conditionValue.includes(value);
      default:
        return false;
    }
  }

  /**
   * 执行动作
   */
  private executeAction(action: RuleAction, data: RouteRequest): RouteDecision | null {
    // 这里需要从数据库或配置中获取 Offer/Lander 的 URL
    // 简化处理，返回 ID
    return {
      offerId: action.type === 'offer' ? action.target_id : null,
      landerId: action.type === 'lander' ? action.target_id : null,
      redirectUrl: action.type === 'redirect' ? action.target_id : '',
      matchedRule: action.target_id,
    };
  }

  /**
   * 加权路由
   */
  private async weightedRoute(data: RouteRequest, config: DistributionConfig): Promise<Response> {
    const offers = config.offers?.filter(o => o.active) || [];
    
    if (offers.length === 0) {
      return this.defaultWeightedRoute(data);
    }

    // 计算总权重
    const totalWeight = offers.reduce((sum, o) => sum + o.weight, 0);
    
    // 加权随机选择
    const random = Math.random() * totalWeight;
    let cumulative = 0;
    
    for (const offer of offers) {
      cumulative += offer.weight;
      if (random <= cumulative) {
        const decision: RouteDecision = {
          offerId: offer.offer_id,
          landerId: null,
          redirectUrl: '', // 需要从数据库获取
          matchedRule: null,
        };
        
        this.updateDistributionStats(decision);
        await this.persist();
        
        return new Response(JSON.stringify(decision), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    return this.defaultWeightedRoute(data);
  }

  /**
   * A/B 测试路由
   */
  private async abTestRoute(data: RouteRequest, config: DistributionConfig): Promise<Response> {
    // A/B 测试通常基于用户 ID 或随机分配
    const offers = config.offers?.filter(o => o.active) || [];
    
    if (offers.length === 0) {
      return this.defaultWeightedRoute(data);
    }

    // 简单的随机分配
    const index = Math.floor(Math.random() * offers.length);
    const selectedOffer = offers[index];

    const decision: RouteDecision = {
      offerId: selectedOffer.offer_id,
      landerId: null,
      redirectUrl: '',
      matchedRule: null,
    };

    this.updateDistributionStats(decision);
    await this.persist();

    return new Response(JSON.stringify(decision), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 地理路由
   */
  private async geoRoute(data: RouteRequest, config: DistributionConfig): Promise<Response> {
    const rules = config.rules || [];
    
    // 查找匹配国家规则的
    for (const rule of rules) {
      const hasGeoCondition = rule.conditions.some(c => c.field === 'country');
      if (hasGeoCondition && this.matchRule(rule, data)) {
        const decision = this.executeAction(rule.action, data);
        if (decision) {
          this.updateDistributionStats(decision);
          await this.persist();
          return new Response(JSON.stringify(decision), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return this.defaultWeightedRoute(data);
  }

  /**
   * 设备路由
   */
  private async deviceRoute(data: RouteRequest, config: DistributionConfig): Promise<Response> {
    const rules = config.rules || [];
    
    for (const rule of rules) {
      const hasDeviceCondition = rule.conditions.some(
        c => c.field === 'device_type' || c.field === 'os' || c.field === 'browser'
      );
      if (hasDeviceCondition && this.matchRule(rule, data)) {
        const decision = this.executeAction(rule.action, data);
        if (decision) {
          this.updateDistributionStats(decision);
          await this.persist();
          return new Response(JSON.stringify(decision), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }

    return this.defaultWeightedRoute(data);
  }

  /**
   * 默认加权路由
   */
  private async defaultWeightedRoute(data: RouteRequest): Promise<Response> {
    // 返回一个默认决策
    const decision: RouteDecision = {
      offerId: null,
      landerId: null,
      redirectUrl: '',
      matchedRule: null,
    };

    return new Response(JSON.stringify(decision), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 更新配置
   */
  private async updateConfig(request: Request): Promise<Response> {
    const config = await request.json() as DistributionConfig;
    
    this.data.config = config;
    await this.persist();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 获取分发统计
   */
  private async getDistributionStats(): Promise<Response> {
    return new Response(
      JSON.stringify({
        offerStats: Object.fromEntries(this.data.distribution.offerStats),
        landerStats: Object.fromEntries(this.data.distribution.landerStats),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * 更新分发统计
   */
  private updateDistributionStats(decision: RouteDecision): void {
    if (decision.offerId) {
      const current = this.data.distribution.offerStats.get(decision.offerId) || 0;
      this.data.distribution.offerStats.set(decision.offerId, current + 1);
    }

    if (decision.landerId) {
      const current = this.data.distribution.landerStats.get(decision.landerId) || 0;
      this.data.distribution.landerStats.set(decision.landerId, current + 1);
    }
  }

  /**
   * 持久化存储
   */
  private async persist(): Promise<void> {
    await this.state.storage.put('data', {
      ...this.data,
      distribution: {
        offerStats: Object.fromEntries(this.data.distribution.offerStats),
        landerStats: Object.fromEntries(this.data.distribution.landerStats),
      },
    });
  }
}
