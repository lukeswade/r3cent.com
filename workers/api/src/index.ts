import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import type { Env, Variables } from './types';
import { authMiddleware } from './middleware/auth';
import { nowRoutes } from './routes/now';
import { askRoutes } from './routes/ask';
import { itemsRoutes } from './routes/items';
import { connectionsRoutes } from './routes/connections';
import { authRoutes } from './routes/auth';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─────────────────────────────────────────────────────────────
// Global middleware
// ─────────────────────────────────────────────────────────────
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', cors({
  origin: (origin, c) => {
    const allowedOrigins = [
      c.env.APP_URL,
      'http://localhost:5173',
      'https://r3cent.com',
      'https://rec3nt.com',
      'https://r3c3nt.com',
    ];
    return allowedOrigins.includes(origin) ? origin : null;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ─────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─────────────────────────────────────────────────────────────
// API routes
// ─────────────────────────────────────────────────────────────
const api = new Hono<{ Bindings: Env; Variables: Variables }>();

// Public routes (no auth required)
api.route('/auth', authRoutes);

// Protected routes (auth required)
api.use('/*', authMiddleware);
api.route('/now', nowRoutes);
api.route('/ask', askRoutes);
api.route('/items', itemsRoutes);
api.route('/connections', connectionsRoutes);

// Me endpoint
api.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      plan: user.plan,
      timeZone: user.timeZone,
      locale: user.locale,
    },
  });
});

app.route('/api', api);

// ─────────────────────────────────────────────────────────────
// 404 handler
// ─────────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: 'Not found', code: 'NOT_FOUND' }, 404);
});

// ─────────────────────────────────────────────────────────────
// Error handler
// ─────────────────────────────────────────────────────────────
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: c.env.ENVIRONMENT === 'development' ? { message: err.message } : undefined,
  }, 500);
});

export default app;
