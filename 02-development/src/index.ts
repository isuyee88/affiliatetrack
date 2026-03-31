import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { HTTPException } from 'hono/http-exception';

// Import routes
import { campaignsRouter } from './routes/api/campaigns';
import { flowsRouter } from './routes/api/flows';
import { offersRouter } from './routes/api/offers';
import { reportsRouter } from './routes/api/reports';
import { trackingRouter } from './routes/tracking';
import { postbackRouter } from './routes/postback';
import { authRouter } from './routes/auth';

// Import middleware
import { errorHandler } from './middleware/error-handler';
import { rateLimit } from './middleware/rate-limit';
import { auth } from './middleware/auth';

// Import types
import type { Env } from './types';

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: (origin) => origin,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
}));

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: c.env.ENVIRONMENT,
  });
});

// Tracking routes (public, rate limited)
app.use('/click/*', rateLimit('TRACKING'));
app.route('/click', trackingRouter);

// Postback routes (public, rate limited)
app.use('/postback/*', rateLimit('POSTBACK'));
app.route('/postback', postbackRouter);

// Auth routes (public)
app.route('/api/auth', authRouter);

// API routes (protected)
app.use('/api/*', auth);
app.use('/api/*', rateLimit('API'));

app.route('/api/campaigns', campaignsRouter);
app.route('/api/flows', flowsRouter);
app.route('/api/offers', offersRouter);
app.route('/api/reports', reportsRouter);

// Error handling
app.onError(errorHandler);

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
    },
  }, 404);
});

export default app;
