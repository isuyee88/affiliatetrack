import { sqliteTable, integer, text, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Users table
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'manager', 'user', 'viewer'] }).notNull().default('user'),
  status: text('status', { enum: ['active', 'inactive', 'suspended'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});


// Domains table
export const domains = sqliteTable('domains', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  domain: text('domain').notNull().unique(),
  userId: integer('user_id').notNull().references(() => users.id),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  sslEnabled: integer('ssl_enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Traffic Sources table
export const trafficSources = sqliteTable('traffic_sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  postbackUrl: text('postback_url'),
  params: text('params', { mode: 'json' }),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Affiliate Networks table
export const affiliateNetworks = sqliteTable('affiliate_networks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  postbackTemplate: text('postback_template'),
  params: text('params', { mode: 'json' }),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Offers table
export const offers = sqliteTable('offers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  payout: real('payout').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  networkId: integer('network_id').references(() => affiliateNetworks.id),
  userId: integer('user_id').notNull().references(() => users.id),
  status: text('status', { enum: ['active', 'paused', 'archived'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Landing Pages table
export const landingPages = sqliteTable('landing_pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  url: text('url').notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Flows table
export const flows = sqliteTable('flows', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type', { enum: ['simple', 'advanced'] }).notNull().default('simple'),
  rules: text('rules', { mode: 'json' }).notNull(),
  status: text('status', { enum: ['active', 'inactive'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Campaigns table
export const campaigns = sqliteTable('campaigns', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  type: text('type', { enum: ['redirect', 'flow'] }).notNull(),
  userId: integer('user_id').notNull().references(() => users.id),
  domainId: integer('domain_id').references(() => domains.id),
  flowId: integer('flow_id').references(() => flows.id),
  offerId: integer('offer_id').references(() => offers.id),
  url: text('url'),
  trafficSourceId: integer('traffic_source_id').references(() => trafficSources.id),
  settings: text('settings', { mode: 'json' }),
  status: text('status', { enum: ['active', 'paused', 'archived'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Clicks table
export const clicks = sqliteTable('clicks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clickId: text('click_id').notNull().unique(),
  campaignId: integer('campaign_id').notNull().references(() => campaigns.id),
  flowId: integer('flow_id').references(() => flows.id),
  offerId: integer('offer_id').references(() => offers.id),
  
  // Visitor info
  ip: text('ip').notNull(),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  
  // Device info
  device: text('device'),
  os: text('os'),
  osVersion: text('os_version'),
  browser: text('browser'),
  browserVersion: text('browser_version'),
  
  // Traffic info
  source: text('source'),
  medium: text('medium'),
  referrer: text('referrer'),
  
  // URL params
  params: text('params', { mode: 'json' }),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});



// Conversions table
export const conversions = sqliteTable('conversions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clickId: text('click_id').notNull().references(() => clicks.clickId),
  revenue: real('revenue').notNull().default(0),
  cost: real('cost').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  transactionId: text('transaction_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`)
});

// Indexes
export const clicksCampaignIdx = index('clicks_campaign_idx').on(clicks.campaignId);
export const clicksClickIdIdx = index('clicks_click_id_idx').on(clicks.clickId);
export const clicksCountryIdx = index('clicks_country_idx').on(clicks.country);
export const clicksCreatedIdx = index('clicks_created_idx').on(clicks.createdAt);
export const conversionsClickIdx = index('conversions_click_idx').on(conversions.clickId);
export const conversionsCreatedIdx = index('conversions_created_idx').on(conversions.createdAt);
export const campaignsSlugIdx = index('campaigns_slug_idx').on(campaigns.slug);
export const campaignsStatusIdx = index('campaigns_status_idx').on(campaigns.status);
