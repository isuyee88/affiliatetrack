/**
 * 追踪 API 路由
 */

import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type { Env, TrackClickRequest, TrackClickResponse, PostbackRequest, PostbackResponse } from '../types';
import {
  generateClickId,
  generateConversionId,
  generateImpressionId,
  parseUserAgent,
  getGeoInfo,
  getClientIP,
  getDatePartition,
  replaceMacros,
} from '../utils';
import { Errors } from '../middleware/error-handler';

const track = new Hono<{ Bindings: Env }>();

// ============================================
// 点击追踪
// ============================================

const clickSchema = z.object({
  campaign_id: z.string().min(1),
  traffic_source: z.string().optional(),
  sub1: z.string().optional(),
  sub2: z.string().optional(),
  sub3: z.string().optional(),
  sub4: z.string().optional(),
  sub5: z.string().optional(),
  sub6: z.string().optional(),
  sub7: z.string().optional(),
  sub8: z.string().optional(),
  sub9: z.string().optional(),
  sub10: z.string().optional(),
});

// GET 方式点击 (重定向模式)
track.get('/click/:campaignId', async (c) => {
  const campaignId = c.req.param('campaignId');
  const queryParams = Object.fromEntries(Object.entries(c.req.queries()).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  
  // 合并参数
  const clickData: TrackClickRequest = {
    campaign_id: campaignId,
    ...queryParams,
  };
  
  return processClick(c, clickData);
});

// POST 方式点击
track.post('/click', async (c) => {
  try {
    const body = await c.req.json();
    const clickData = clickSchema.parse(body);
    return processClick(c, clickData);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }
});

/**
 * 处理点击逻辑
 */
async function processClick(
  c: Context<{ Bindings: Env }>,
  data: TrackClickRequest
): Promise<Response> {
  const { campaign_id } = data;

  // 1. 获取 Campaign 信息
  const campaign = await c.env.DB.prepare(
    'SELECT * FROM campaigns WHERE id = ? AND status = ?'
  )
    .bind(campaign_id, 'active')
    .first();

  if (!campaign) {
    throw Errors.NotFound('Campaign');
  }

  // 2. 检查预算限制
  if (campaign.daily_budget && (campaign.budget_spent as number) >= (campaign.daily_budget as number)) {
    throw Errors.Forbidden('Daily budget exceeded');
  }

  // 3. 获取请求信息
  const ip = getClientIP(c.req.raw);
  const userAgent = c.req.header('User-Agent') || '';
  const deviceInfo = parseUserAgent(userAgent);
  const geoInfo = getGeoInfo(c.req.raw);

  // 4. 获取 Traffic Router DO 进行分发决策
  const routerId = c.env.TRAFFIC_ROUTER.idFromName(campaign_id);
  const router = c.env.TRAFFIC_ROUTER.get(routerId);

  const routeDecision = await router.fetch(
    new Request('http://internal/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign_id,
        ip,
        userAgent,
        country: geoInfo.country,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
        browser: deviceInfo.browser,
      }),
    })
  );

  const route = await routeDecision.json() as { offerId: string; landerId: string; redirectUrl: string };
  const { offerId, landerId, redirectUrl } = route;

  // 5. 生成点击 ID
  const clickId = generateClickId();
  const now = new Date();
  const datePartition = getDatePartition();

  // 6. 存储点击记录
  await c.env.DB.prepare(
    `INSERT INTO clicks (
      id, click_id, campaign_id, offer_id, lander_id,
      traffic_source, ip, user_agent,
      country, region, city, isp,
      device_type, os, os_version, browser, browser_version,
      referrer, landing_url,
      sub1, sub2, sub3, sub4, sub5, sub6, sub7, sub8, sub9, sub10,
      clicked_at, date_partition
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      clickId, clickId, campaign_id, offerId, landerId,
      data.traffic_source || null, ip, userAgent,
      geoInfo.country, geoInfo.region, geoInfo.city, geoInfo.isp,
      deviceInfo.deviceType, deviceInfo.os, deviceInfo.osVersion,
      deviceInfo.browser, deviceInfo.browserVersion,
      c.req.header('Referer') || null, null,
      data.sub1 || null, data.sub2 || null, data.sub3 || null,
      data.sub4 || null, data.sub5 || null, data.sub6 || null,
      data.sub7 || null, data.sub8 || null, data.sub9 || null,
      data.sub10 || null,
      now.toISOString(), datePartition
    )
    .run();

  // 7. 创建会话 (Session Manager DO)
  const sessionId = c.env.SESSION_MANAGER.idFromName(clickId);
  const sessionManager = c.env.SESSION_MANAGER.get(sessionId);

  await sessionManager.fetch(
    new Request('http://internal/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clickId,
        campaignId: campaign_id,
        offerId,
        attributes: {
          ip,
          userAgent,
          country: geoInfo.country,
          deviceType: deviceInfo.deviceType,
          os: deviceInfo.os,
          browser: deviceInfo.browser,
        },
      }),
    })
  );

  // 8. 更新统计 (Stats Aggregator DO)
  const statsId = c.env.STATS_AGGREGATOR.idFromName(`${campaign_id}:${datePartition}`);
  const statsAggregator = c.env.STATS_AGGREGATOR.get(statsId);

  await statsAggregator.fetch(
    new Request('http://internal/stats/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign_id,
        offerId,
        country: geoInfo.country,
        deviceType: deviceInfo.deviceType,
        os: deviceInfo.os,
      }),
    })
  );

  // 9. 构建重定向 URL
  const finalUrl = replaceMacros(redirectUrl, {
    clickid: clickId,
    campaign_id,
    offer_id: offerId || '',
    sub1: data.sub1 || '',
    sub2: data.sub2 || '',
    sub3: data.sub3 || '',
    country: geoInfo.country,
    device_type: deviceInfo.deviceType,
    os: deviceInfo.os,
  });

  // 10. 返回响应
  const response: TrackClickResponse = {
    click_id: clickId,
    redirect_url: finalUrl,
    offer_id: offerId,
  };

  // 如果是 GET 请求，执行重定向
  if (c.req.method === 'GET') {
    return c.redirect(finalUrl, 302);
  }

  return c.json(response);
}

// ============================================
// Postback 处理
// ============================================

const postbackSchema = z.object({
  clickid: z.string().min(1),
  payout: z.coerce.number().positive(),
  status: z.enum(['approved', 'pending', 'rejected']).default('approved'),
  txid: z.string().optional(),
  sub1: z.string().optional(),
  sub2: z.string().optional(),
  sub3: z.string().optional(),
  sub4: z.string().optional(),
  sub5: z.string().optional(),
});

track.get('/postback', async (c) => {
  const params = Object.fromEntries(Object.entries(c.req.queries()).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const data = postbackSchema.parse(params);
  return processPostback(c, data);
});

track.post('/postback', async (c) => {
  try {
    const body = await c.req.json();
    const params = Object.fromEntries(new URL(c.req.url).searchParams);
    const data = postbackSchema.parse({ ...params, ...body });
    return processPostback(c, data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ success: false, error: 'Validation error', details: error.errors }, 400);
    }
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }
});

/**
 * 处理 Postback 逻辑
 */
async function processPostback(
  c: Context<{ Bindings: Env }>,
  data: z.infer<typeof postbackSchema>
): Promise<Response> {
  const { clickid, payout, status, txid } = data;

  // 1. 查找点击记录
  const click = await c.env.DB.prepare(
    'SELECT * FROM clicks WHERE click_id = ?'
  )
    .bind(clickid)
    .first();

  if (!click) {
    throw Errors.NotFound('Click');
  }

  // 2. 检查是否已转化 (防重复)
  const existingConversion = await c.env.DB.prepare(
    'SELECT * FROM conversions WHERE click_id = ?'
  )
    .bind(clickid)
    .first();

  if (existingConversion) {
    // 更新为重复
    const response: PostbackResponse = {
      success: false,
      message: 'Click already converted',
    };
    return c.json(response, 200);
  }

  // 3. 获取 Offer 信息
  let cost = 0;
  if (click.offer_id) {
    const offer = await c.env.DB.prepare(
      'SELECT * FROM offers WHERE id = ?'
    )
      .bind(click.offer_id)
      .first();
    
    if (offer) {
      cost = offer.payout_value as number;
    }
  }

  // 4. 创建转化记录
  const conversionId = generateConversionId();
  const now = new Date();
  const datePartition = getDatePartition();
  const profit = payout - cost;

  await c.env.DB.prepare(
    `INSERT INTO conversions (
      id, conversion_id, click_id, campaign_id, offer_id,
      revenue, cost, profit, status,
      conversion_type, external_conversion_id,
      sub1, sub2, sub3, sub4, sub5,
      converted_at, date_partition
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      conversionId, conversionId, clickid, click.campaign_id, click.offer_id,
      payout, cost, profit, status,
      'lead', txid || null,
      data.sub1 || null, data.sub2 || null, data.sub3 || null,
      data.sub4 || null, data.sub5 || null,
      now.toISOString(), datePartition
    )
    .run();

  // 5. 更新会话
  const sessionId = c.env.SESSION_MANAGER.idFromName(clickid);
  const sessionManager = c.env.SESSION_MANAGER.get(sessionId);

  await sessionManager.fetch(
    new Request('http://internal/session/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversionId,
        status,
        revenue: payout,
      }),
    })
  );

  // 6. 更新统计
  const statsId = c.env.STATS_AGGREGATOR.idFromName(`${click.campaign_id}:${datePartition}`);
  const statsAggregator = c.env.STATS_AGGREGATOR.get(statsId);

  await statsAggregator.fetch(
    new Request('http://internal/stats/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaignId: click.campaign_id,
        offerId: click.offer_id,
        revenue: payout,
        cost,
        status,
      }),
    })
  );

  // 7. 返回响应
  const response: PostbackResponse = {
    success: true,
    conversion_id: conversionId,
    message: 'Conversion recorded successfully',
  };

  return c.json(response);
}

// ============================================
// 展示追踪
// ============================================

track.get('/impression/:campaignId', async (c) => {
  const campaignId = c.req.param('campaignId');
  
  const ip = getClientIP(c.req.raw);
  const userAgent = c.req.header('User-Agent') || '';
  const deviceInfo = parseUserAgent(userAgent);
  const geoInfo = getGeoInfo(c.req.raw);

  const impressionId = generateImpressionId();
  const now = new Date();
  const datePartition = getDatePartition();

  // 存储展示记录
  await c.env.DB.prepare(
    `INSERT INTO impressions (
      id, impression_id, campaign_id, ip, user_agent,
      country, device_type, impressed_at, date_partition
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      impressionId, impressionId, campaignId, ip, userAgent,
      geoInfo.country, deviceInfo.deviceType,
      now.toISOString(), datePartition
    )
    .run();

  // 返回 1x1 透明 GIF
  const transparentGif = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));

  return new Response(transparentGif, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
});

// ============================================
// 点击查询
// ============================================

track.get('/click/:clickId/info', async (c) => {
  const clickId = c.req.param('clickId');

  const click = await c.env.DB.prepare(
    'SELECT * FROM clicks WHERE click_id = ?'
  )
    .bind(clickId)
    .first();

  if (!click) {
    throw Errors.NotFound('Click');
  }

  // 获取关联的转化
  const conversions = await c.env.DB.prepare(
    'SELECT * FROM conversions WHERE click_id = ?'
  )
    .bind(clickId)
    .all();

  return c.json({
    click,
    conversions: conversions.results,
  });
});

export { track as trackRoutes };
