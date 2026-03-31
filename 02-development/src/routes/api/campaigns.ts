import { Hono } from 'hono';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { z } from 'zod';
import * as schema from '../db/schema';
import type { Env } from '../types';
import { generateSlug } from '../utils';

const campaignsRouter = new Hono<{ Bindings: Env }>();

// Validation schemas
const createCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['redirect', 'flow']),
  domainId: z.number().optional(),
  flowId: z.number().optional(),
  offerId: z.number().optional(),
  url: z.string().url().optional(),
  trafficSourceId: z.number().optional(),
  settings: z.record(z.any()).optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
  settings: z.record(z.any()).optional(),
});

/**
 * GET /api/campaigns
 * List campaigns with pagination
 */
campaignsRouter.get('/', async (c) => {
  const db = drizzle(c.env.DB);
  
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const status = c.req.query('status');
  const search = c.req.query('search');
  
  const offset = (page - 1) * limit;
  
  // Build where clause
  const whereConditions = [];
  
  if (status) {
    whereConditions.push(eq(schema.campaigns.status, status));
  }
  
  if (search) {
    whereConditions.push(
      like(schema.campaigns.name, `%${search}%`)
    );
  }
  
  const where = whereConditions.length > 0 
    ? and(...whereConditions) 
    : undefined;
  
  // Get campaigns
  const campaigns = await db.query.campaigns.findMany({
    where,
    limit,
    offset,
    orderBy: desc(schema.campaigns.createdAt),
  });
  
  // Get total count
  const countResult = await db.select({
    count: sql<number>`count(*)`,
  }).from(schema.campaigns).where(where || sql`1=1`);
  
  const total = countResult[0]?.count || 0;
  
  return c.json({
    success: true,
    data: campaigns,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /api/campaigns/:id
 * Get campaign by ID
 */
campaignsRouter.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  const campaign = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, id),
  });
  
  if (!campaign) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Campaign not found',
      },
    }, 404);
  }
  
  return c.json({
    success: true,
    data: campaign,
  });
});

/**
 * POST /api/campaigns
 * Create new campaign
 */
campaignsRouter.post('/', async (c) => {
  const db = drizzle(c.env.DB);
  
  try {
    const body = await c.req.json();
    const data = createCampaignSchema.parse(body);
    
    // Generate slug
    const slug = generateSlug(data.name);
    
    // Create campaign
    const result = await db.insert(schema.campaigns).values({
      name: data.name,
      slug,
      type: data.type,
      userId: 1, // TODO: Get from auth context
      domainId: data.domainId,
      flowId: data.flowId,
      offerId: data.offerId,
      url: data.url,
      trafficSourceId: data.trafficSourceId,
      settings: JSON.stringify(data.settings || {}),
      status: 'active',
    }).returning();
    
    const campaign = result[0];
    
    return c.json({
      success: true,
      data: campaign,
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
      }, 400);
    }
    
    throw error;
  }
});

/**
 * PUT /api/campaigns/:id
 * Update campaign
 */
campaignsRouter.put('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  try {
    const body = await c.req.json();
    const data = updateCampaignSchema.parse(body);
    
    // Check if campaign exists
    const existing = await db.query.campaigns.findFirst({
      where: eq(schema.campaigns.id, id),
    });
    
    if (!existing) {
      return c.json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Campaign not found',
        },
      }, 404);
    }
    
    // Update campaign
    const result = await db.update(schema.campaigns)
      .set({
        ...data,
        settings: data.settings ? JSON.stringify(data.settings) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.campaigns.id, id))
      .returning();
    
    // Invalidate cache
    await c.env.CACHE.delete(`campaign:${existing.slug}`);
    
    return c.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
      }, 400);
    }
    
    throw error;
  }
});

/**
 * DELETE /api/campaigns/:id
 * Delete campaign
 */
campaignsRouter.delete('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const id = parseInt(c.req.param('id'));
  
  // Check if campaign exists
  const existing = await db.query.campaigns.findFirst({
    where: eq(schema.campaigns.id, id),
  });
  
  if (!existing) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Campaign not found',
      },
    }, 404);
  }
  
  // Soft delete by archiving
  await db.update(schema.campaigns)
    .set({ status: 'archived', updatedAt: new Date() })
    .where(eq(schema.campaigns.id, id));
  
  // Invalidate cache
  await c.env.CACHE.delete(`campaign:${existing.slug}`);
  
  return c.json({
    success: true,
    data: null,
  }, 204);
});

export { campaignsRouter };
