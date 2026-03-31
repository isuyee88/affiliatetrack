import { Hono } from 'hono';
import { TrackingService } from '../services/tracking.service';
import type { Env } from '../types';

const trackingRouter = new Hono<{ Bindings: Env }>();

/**
 * Click tracking endpoint
 * GET /click/:campaignSlug
 */
trackingRouter.get('/:campaignSlug', async (c) => {
  const campaignSlug = c.req.param('campaignSlug');
  const query = c.req.query();
  const headers = c.req.header();

  try {
    const trackingService = new TrackingService(c.env);
    const result = await trackingService.trackClick({
      campaignSlug,
      query,
      headers,
    });

    // Return redirect response
    switch (result.method) {
      case '302':
        return c.redirect(result.redirectUrl, 302);

      case 'js':
        return c.html(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Redirecting...</title>
          </head>
          <body>
            <script>
              window.location.href = "${result.redirectUrl}";
            </script>
            <p>Redirecting to <a href="${result.redirectUrl}">offer</a>...</p>
          </body>
          </html>
        `);

      case 'meta':
        return c.html(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Redirecting...</title>
            <meta http-equiv="refresh" content="0;url=${result.redirectUrl}">
          </head>
          <body>
            <p>Redirecting to <a href="${result.redirectUrl}">offer</a>...</p>
          </body>
          </html>
        `);

      default:
        return c.redirect(result.redirectUrl, 302);
    }
  } catch (error) {
    console.error('Tracking error:', error);
    
    // Return error response
    return c.json({
      success: false,
      error: {
        code: 'TRACKING_ERROR',
        message: error instanceof Error ? error.message : 'Tracking failed',
      },
    }, 500);
  }
});

/**
 * Pixel tracking endpoint (for impressions)
 * GET /pixel/:campaignSlug
 */
trackingRouter.get('/pixel/:campaignSlug', async (c) => {
  // Return 1x1 transparent pixel
  const pixel = Buffer.from(
    'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
    'base64'
  );

  return new Response(pixel, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
});

export { trackingRouter };
