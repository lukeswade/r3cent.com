import { createMiddleware } from 'hono/factory';
import type { Env, Variables, Session, SessionUser } from '../types';

const SESSION_PREFIX = 'session:';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    // Get session ID from cookie or Authorization header
    const authHeader = c.req.header('Authorization');
    const cookieHeader = c.req.header('Cookie');
    
    let sessionId: string | null = null;
    
    if (authHeader?.startsWith('Bearer ')) {
      sessionId = authHeader.slice(7);
    } else if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [key, ...v] = c.trim().split('=');
          return [key, v.join('=')];
        })
      );
      sessionId = cookies['r3cent_session'] || null;
    }
    
    if (!sessionId) {
      return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
    }
    
    // Fetch session from KV
    const sessionData = await c.env.KV.get<Session>(`${SESSION_PREFIX}${sessionId}`, 'json');
    
    if (!sessionData) {
      return c.json({ error: 'Session expired', code: 'SESSION_EXPIRED' }, 401);
    }
    
    // Check expiration
    if (new Date(sessionData.expiresAt) < new Date()) {
      await c.env.KV.delete(`${SESSION_PREFIX}${sessionId}`);
      return c.json({ error: 'Session expired', code: 'SESSION_EXPIRED' }, 401);
    }
    
    // Fetch user from D1
    const user = await c.env.DB.prepare(
      'SELECT id, email, display_name, plan, time_zone, locale FROM users WHERE id = ?'
    )
      .bind(sessionData.userId)
      .first<{
        id: string;
        email: string;
        display_name: string | null;
        plan: string;
        time_zone: string;
        locale: string;
      }>();
    
    if (!user) {
      await c.env.KV.delete(`${SESSION_PREFIX}${sessionId}`);
      return c.json({ error: 'User not found', code: 'USER_NOT_FOUND' }, 401);
    }
    
    // Set user in context
    c.set('user', {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      plan: user.plan,
      timeZone: user.time_zone,
      locale: user.locale,
    });
    c.set('sessionId', sessionId);
    
    await next();
  }
);

// Helper to create a session
export async function createSession(
  kv: KVNamespace,
  userId: string
): Promise<{ sessionId: string; expiresAt: Date }> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL * 1000);
  
  const session: Session = {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  
  await kv.put(`${SESSION_PREFIX}${sessionId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL,
  });
  
  return { sessionId, expiresAt };
}

// Helper to destroy a session
export async function destroySession(kv: KVNamespace, sessionId: string): Promise<void> {
  await kv.delete(`${SESSION_PREFIX}${sessionId}`);
}
