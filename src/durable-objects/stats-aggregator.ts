/**
 * Stats Aggregator Durable Object
 * 实时统计聚合
 */

interface HourlyData {
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cost: number;
}

interface StatsData {
  currentHour: number;
  currentHourData: HourlyData;
  byCountry: Map<string, HourlyData>;
  byDevice: Map<string, HourlyData>;
  byOffer: Map<string, HourlyData>;
  pendingFlush: Array<{
    campaignId: string;
    offerId: string | null;
    country: string;
    deviceType: string;
    os: string;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    cost: number;
  }>;
}

export class StatsAggregator implements DurableObject {
  private state: DurableObjectState;
  private stats: StatsData;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.stats = {
      currentHour: new Date().getHours(),
      currentHourData: {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0,
        cost: 0,
      },
      byCountry: new Map(),
      byDevice: new Map(),
      byOffer: new Map(),
      pendingFlush: [],
    };

    // 恢复状态
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<StatsData>('stats');
      if (stored) {
        this.stats = {
          ...stored,
          byCountry: new Map(Object.entries(stored.byCountry || {})),
          byDevice: new Map(Object.entries(stored.byDevice || {})),
          byOffer: new Map(Object.entries(stored.byOffer || {})),
        };
      }
    });

    // 设置定时器定期刷新到 D1
    this.state.blockConcurrencyWhile(async () => {
      // 每小时刷新一次
      const currentHour = new Date().getHours();
      if (this.stats.currentHour !== currentHour) {
        await this.flush();
        this.stats.currentHour = currentHour;
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 记录点击统计
    if (path === '/stats/click' && request.method === 'POST') {
      return this.recordClick(request);
    }

    // 记录转化统计
    if (path === '/stats/conversion' && request.method === 'POST') {
      return this.recordConversion(request);
    }

    // 获取实时统计
    if (path === '/stats/realtime' && request.method === 'GET') {
      return this.getRealtimeStats();
    }

    // 手动刷新
    if (path === '/stats/flush' && request.method === 'POST') {
      return this.flush();
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * 记录点击
   */
  private async recordClick(request: Request): Promise<Response> {
    const data = await request.json() as {
      campaignId: string;
      offerId: string | null;
      country: string;
      deviceType: string;
      os: string;
    };

    // 更新当前小时数据
    this.stats.currentHourData.clicks++;

    // 按维度更新
    if (data.country) {
      const countryStats = this.stats.byCountry.get(data.country) || this.createEmptyHourlyData();
      countryStats.clicks++;
      this.stats.byCountry.set(data.country, countryStats);
    }

    if (data.deviceType) {
      const deviceStats = this.stats.byDevice.get(data.deviceType) || this.createEmptyHourlyData();
      deviceStats.clicks++;
      this.stats.byDevice.set(data.deviceType, deviceStats);
    }

    if (data.offerId) {
      const offerStats = this.stats.byOffer.get(data.offerId) || this.createEmptyHourlyData();
      offerStats.clicks++;
      this.stats.byOffer.set(data.offerId, offerStats);
    }

    await this.persist();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 记录转化
   */
  private async recordConversion(request: Request): Promise<Response> {
    const data = await request.json() as {
      campaignId: string;
      offerId: string | null;
      revenue: number;
      cost: number;
      status: string;
    };

    // 更新当前小时数据
    this.stats.currentHourData.conversions++;
    this.stats.currentHourData.revenue += data.revenue;
    this.stats.currentHourData.cost += data.cost;

    // 按维度更新
    if (data.offerId) {
      const offerStats = this.stats.byOffer.get(data.offerId) || this.createEmptyHourlyData();
      offerStats.conversions++;
      offerStats.revenue += data.revenue;
      offerStats.cost += data.cost;
      this.stats.byOffer.set(data.offerId, offerStats);
    }

    await this.persist();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 获取实时统计
   */
  private async getRealtimeStats(): Promise<Response> {
    const now = new Date();
    const hour = now.getHours();

    // 如果跨小时，重置当前小时数据
    if (hour !== this.stats.currentHour) {
      this.stats.currentHour = hour;
      this.stats.currentHourData = this.createEmptyHourlyData();
      await this.persist();
    }

    return new Response(
      JSON.stringify({
        hour: this.stats.currentHour,
        totals: this.stats.currentHourData,
        byCountry: Object.fromEntries(this.stats.byCountry),
        byDevice: Object.fromEntries(this.stats.byDevice),
        byOffer: Object.fromEntries(this.stats.byOffer),
        timestamp: now.toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * 刷新到 D1 (由调用方负责写入)
   */
  private async flush(): Promise<Response> {
    const pendingFlush = [...this.stats.pendingFlush];

    // 重置状态
    this.stats.currentHourData = this.createEmptyHourlyData();
    this.stats.byCountry.clear();
    this.stats.byDevice.clear();
    this.stats.byOffer.clear();
    this.stats.pendingFlush = [];

    await this.persist();

    return new Response(
      JSON.stringify({
        success: true,
        flushedRecords: pendingFlush.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * 创建空的每小时数据
   */
  private createEmptyHourlyData(): HourlyData {
    return {
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      cost: 0,
    };
  }

  /**
   * 持久化存储
   */
  private async persist(): Promise<void> {
    await this.state.storage.put('stats', {
      ...this.stats,
      byCountry: Object.fromEntries(this.stats.byCountry),
      byDevice: Object.fromEntries(this.stats.byDevice),
      byOffer: Object.fromEntries(this.stats.byOffer),
    });
  }
}
