import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';
import type { Env, TrackingParams, TrackingResult, Click } from '../types';
import { generateClickId, parseUserAgent, getGeoInfo } from '../utils';

export class TrackingService {
  private db: ReturnType<typeof drizzle>;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.db = drizzle(env.DB, { schema });
  }

  /**
   * Track a click and return redirect information
   */
  async trackClick(params: TrackingParams): Promise<TrackingResult> {
    const { campaignSlug, query, headers } = params;

    // 1. Get campaign from cache or database
    const campaign = await this.getCampaign(campaignSlug);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'active') {
      throw new Error('Campaign is not active');
    }

    // 2. Generate unique click ID
    const clickId = generateClickId();

    // 3. Parse visitor information
    const userAgent = headers.get('user-agent') || '';
    const ip = headers.get('cf-connecting-ip') || headers.get('x-forwarded-for') || 'unknown';
    const country = headers.get('cf-ipcountry') || '';
    
    const deviceInfo = parseUserAgent(userAgent);
    const geoInfo = await getGeoInfo(ip);

    // 4. Determine target based on flow or direct offer
    const target = await this.determineTarget(campaign, {
      ip,
      country,
      ...deviceInfo,
    });

    // 5. Record click asynchronously
    await this.recordClick({
      clickId,
      campaignId: campaign.id,
      flowId: campaign.flowId,
      offerId: target.offerId,
      ip,
      country: geoInfo?.country || country,
      region: geoInfo?.region,
      city: geoInfo?.city,
      device: deviceInfo.device,
      os: deviceInfo.os,
      osVersion: deviceInfo.osVersion,
      browser: deviceInfo.browser,
      browserVersion: deviceInfo.browserVersion,
      source: query.utm_source || query.source,
      medium: query.utm_medium || query.medium,
      referrer: headers.get('referer') || '',
      params: query,
    });

    // 6. Build redirect URL with click ID
    const redirectUrl = this.buildRedirectUrl(target.url, clickId, query);

    return {
      clickId,
      redirectUrl,
      method: target.redirectMethod,
    };
  }

  /**
   * Get campaign by slug with caching
   */
  private async getCampaign(slug: string) {
    // Try cache first
    const cacheKey = `campaign:${slug}`;
    const cached = await this.env.CACHE.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    const result = await this.db.query.campaigns.findFirst({
      where: eq(schema.campaigns.slug, slug),
    });

    if (result) {
      // Cache for 5 minutes
      await this.env.CACHE.put(cacheKey, JSON.stringify(result), {
        expirationTtl: 300,
      });
    }

    return result;
  }

  /**
   * Determine target URL based on campaign type
   */
  private async determineTarget(
    campaign: schema.Campaign,
    visitorInfo: Record<string, string>
  ): Promise<{
    offerId: number;
    url: string;
    redirectMethod: '302' | 'js' | 'meta';
  }> {
    // If campaign has flow, evaluate flow rules
    if (campaign.type === 'flow' && campaign.flowId) {
      return await this.evaluateFlow(campaign.flowId, visitorInfo);
    }

    // Direct redirect to offer
    if (campaign.offerId) {
      const offer = await this.db.query.offers.findFirst({
        where: eq(schema.offers.id, campaign.offerId),
      });

      if (offer) {
        return {
          offerId: offer.id,
          url: offer.url,
          redirectMethod: '302',
        };
      }
    }

    // Fallback to campaign URL
    if (campaign.url) {
      return {
        offerId: 0,
        url: campaign.url,
        redirectMethod: '302',
      };
    }

    throw new Error('No valid redirect target found');
  }

  /**
   * Evaluate flow rules to determine target
   */
  private async evaluateFlow(
    flowId: number,
    visitorInfo: Record<string, string>
  ): Promise<{
    offerId: number;
    url: string;
    redirectMethod: '302' | 'js' | 'meta';
  }> {
    const flow = await this.db.query.flows.findFirst({
      where: eq(schema.flows.id, flowId),
    });

    if (!flow) {
      throw new Error('Flow not found');
    }

    const rules = flow.rules as Array<{
      id: string;
      weight: number;
      conditions?: Array<{
        field: string;
        operator: string;
        value: string | string[];
      }>;
      target: {
        type: string;
        id?: number;
        url?: string;
      };
    }>;

    // Filter rules that match conditions
    const matchingRules = rules.filter((rule) => {
      if (!rule.conditions || rule.conditions.length === 0) {
        return true;
      }

      return rule.conditions.every((condition) => {
        const fieldValue = visitorInfo[condition.field];
        return this.evaluateCondition(condition, fieldValue);
      });
    });

    if (matchingRules.length === 0) {
      throw new Error('No matching rules found');
    }

    // Weighted random selection
    const selectedRule = this.weightedRandomSelect(matchingRules);

    // Get target URL
    let url: string;
    let offerId = 0;

    if (selectedRule.target.type === 'offer' && selectedRule.target.id) {
      const offer = await this.db.query.offers.findFirst({
        where: eq(schema.offers.id, selectedRule.target.id),
      });
      if (!offer) {
        throw new Error('Target offer not found');
      }
      url = offer.url;
      offerId = offer.id;
    } else if (selectedRule.target.url) {
      url = selectedRule.target.url;
    } else {
      throw new Error('Invalid target configuration');
    }

    return {
      offerId,
      url,
      redirectMethod: '302',
    };
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: { field: string; operator: string; value: string | string[] },
    fieldValue: string
  ): boolean {
    const { operator, value } = condition;

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return fieldValue?.includes(value as string) || false;
      case 'not_contains':
        return !fieldValue?.includes(value as string);
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(fieldValue);
      default:
        return true;
    }
  }

  /**
   * Weighted random selection
   */
  private weightedRandomSelect<T extends { weight: number }>(items: T[]): T {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= item.weight;
      if (random <= 0) {
        return item;
      }
    }

    return items[items.length - 1];
  }

  /**
   * Record click to database
   */
  private async recordClick(clickData: Partial<Click>): Promise<void> {
    await this.db.insert(schema.clicks).values({
      clickId: clickData.clickId!,
      campaignId: clickData.campaignId!,
      flowId: clickData.flowId,
      offerId: clickData.offerId,
      ip: clickData.ip!,
      country: clickData.country,
      region: clickData.region,
      city: clickData.city,
      device: clickData.device,
      os: clickData.os,
      osVersion: clickData.osVersion,
      browser: clickData.browser,
      browserVersion: clickData.browserVersion,
      source: clickData.source,
      medium: clickData.medium,
      referrer: clickData.referrer,
      params: JSON.stringify(clickData.params || {}),
    });
  }

  /**
   * Build redirect URL with click ID
   */
  private buildRedirectUrl(
    baseUrl: string,
    clickId: string,
    query: Record<string, string>
  ): string {
    const url = new URL(baseUrl);
    
    // Add click ID
    url.searchParams.set('subid', clickId);
    
    // Pass through other params
    for (const [key, value] of Object.entries(query)) {
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }

    return url.toString();
  }

  /**
   * Record conversion
   */
  async recordConversion(data: {
    clickId: string;
    revenue: number;
    cost?: number;
    currency?: string;
    status?: 'pending' | 'approved' | 'rejected';
    transactionId?: string;
  }): Promise<void> {
    // Verify click exists
    const click = await this.db.query.clicks.findFirst({
      where: eq(schema.clicks.clickId, data.clickId),
    });

    if (!click) {
      throw new Error('Click not found');
    }

    // Check for duplicate conversion
    const existing = await this.db.query.conversions.findFirst({
      where: eq(schema.conversions.clickId, data.clickId),
    });

    if (existing) {
      throw new Error('Conversion already recorded');
    }

    // Record conversion
    await this.db.insert(schema.conversions).values({
      clickId: data.clickId,
      revenue: data.revenue,
      cost: data.cost || 0,
      currency: data.currency || 'USD',
      status: data.status || 'pending',
      transactionId: data.transactionId,
    });

    // Invalidate cache
    await this.invalidateReportCache(click.campaignId);
  }

  /**
   * Invalidate report cache
   */
  private async invalidateReportCache(campaignId: number): Promise<void> {
    const patterns = [
      `report:campaign:${campaignId}:*`,
      `report:summary:*`,
    ];

    for (const pattern of patterns) {
      // List and delete matching keys
      const { keys } = await this.env.CACHE.list({ prefix: pattern.replace('*', '') });
      for (const key of keys) {
        await this.env.CACHE.delete(key.name);
      }
    }
  }
}
