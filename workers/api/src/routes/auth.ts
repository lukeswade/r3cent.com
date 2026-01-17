import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createSession, destroySession } from '../middleware/auth';

export const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// ─────────────────────────────────────────────────────────────
// Email/Password Auth
// ─────────────────────────────────────────────────────────────

// Hash password using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// POST /api/auth/register - Register with email/password
authRoutes.post('/register', async (c) => {
  const { email, password, displayName } = await c.req.json<{
    email: string;
    password: string;
    displayName?: string;
  }>();
  
  if (!email || !password) {
    return c.json({ error: 'Email and password required', code: 'MISSING_FIELDS' }, 400);
  }
  
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' }, 400);
  }
  
  // Check if user exists
  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first();
  
  if (existing) {
    return c.json({ error: 'Email already registered', code: 'EMAIL_EXISTS' }, 409);
  }
  
  // Create user
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();
  
  await c.env.DB.prepare(`
    INSERT INTO users (id, email, display_name, password_hash, created_at, last_login_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(userId, email.toLowerCase(), displayName || email.split('@')[0], passwordHash, now, now)
    .run();
  
  // Create session
  const { sessionId, expiresAt } = await createSession(c.env.KV, userId);
  
  // Set cookie
  c.header('Set-Cookie', `r3cent_session=${sessionId}; Path=/; Domain=.r3cent.com; HttpOnly; Secure; SameSite=Lax; Expires=${expiresAt.toUTCString()}`);
  
  return c.json({
    user: { id: userId, email: email.toLowerCase(), displayName: displayName || email.split('@')[0] },
  });
});

// POST /api/auth/login - Login with email/password
authRoutes.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  
  if (!email || !password) {
    return c.json({ error: 'Email and password required', code: 'MISSING_FIELDS' }, 400);
  }
  
  // Find user
  const user = await c.env.DB.prepare('SELECT id, email, display_name, password_hash FROM users WHERE email = ?')
    .bind(email.toLowerCase())
    .first<{ id: string; email: string; display_name: string; password_hash: string | null }>();
  
  if (!user) {
    return c.json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }, 401);
  }
  
  if (!user.password_hash) {
    return c.json({ error: 'Please use Google login for this account', code: 'NO_PASSWORD' }, 401);
  }
  
  // Verify password
  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.password_hash) {
    return c.json({ error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' }, 401);
  }
  
  // Update last login
  await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), user.id)
    .run();
  
  // Create session
  const { sessionId, expiresAt } = await createSession(c.env.KV, user.id);
  
  // Set cookie
  c.header('Set-Cookie', `r3cent_session=${sessionId}; Path=/; Domain=.r3cent.com; HttpOnly; Secure; SameSite=Lax; Expires=${expiresAt.toUTCString()}`);
  
  return c.json({
    user: { id: user.id, email: user.email, displayName: user.display_name },
  });
});

// POST /api/auth/set-password - Set password for existing OAuth user
authRoutes.post('/set-password', async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
  }
  
  const { password } = await c.req.json<{ password: string }>();
  
  if (!password || password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters', code: 'WEAK_PASSWORD' }, 400);
  }
  
  const passwordHash = await hashPassword(password);
  
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, user.id)
    .run();
  
  return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// Token Exchange
// ─────────────────────────────────────────────────────────────

// POST /api/auth/exchange - Exchange token for session
authRoutes.post('/exchange', async (c) => {
  const { token } = await c.req.json<{ token: string }>();
  
  if (!token) {
    return c.json({ error: 'Missing token' }, 400);
  }
  
  // Get session ID from exchange token
  const sessionId = await c.env.KV.get(`token_exchange:${token}`);
  if (!sessionId) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
  
  // Delete the exchange token (one-time use)
  await c.env.KV.delete(`token_exchange:${token}`);
  
  // Return the session ID for the frontend to store
  return c.json({ sessionId });
});

// POST /api/auth/logout
authRoutes.post('/logout', async (c) => {
  const authHeader = c.req.header('Authorization');
  const cookieHeader = c.req.header('Cookie');
  
  let sessionId: string | null = null;
  
  if (authHeader?.startsWith('Bearer ')) {
    sessionId = authHeader.slice(7);
  } else if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((cookie) => {
        const [key, ...v] = cookie.trim().split('=');
        return [key, v.join('=')];
      })
    );
    sessionId = cookies['r3cent_session'] || null;
  }
  
  if (sessionId) {
    await destroySession(c.env.KV, sessionId);
  }
  
  // Clear cookie on root domain
  c.header('Set-Cookie', 'r3cent_session=; Path=/; Domain=.r3cent.com; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  
  return c.json({ success: true });
});

// GET /api/auth/google - Start Google OAuth flow
authRoutes.get('/google', async (c) => {
  const state = crypto.randomUUID();
  
  // Store state in KV for verification
  await c.env.KV.put(`oauth_state:${state}`, 'google', { expirationTtl: 600 });
  
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
  ];
  
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.API_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// GET /api/auth/google/callback - Google OAuth callback
authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  
  if (error) {
    return c.redirect(`${c.env.APP_URL}/auth/error?error=${encodeURIComponent(error)}`);
  }
  
  if (!code || !state) {
    return c.redirect(`${c.env.APP_URL}/auth/error?error=missing_params`);
  }
  
  // Verify state
  const storedState = await c.env.KV.get(`oauth_state:${state}`);
  if (!storedState) {
    return c.redirect(`${c.env.APP_URL}/auth/error?error=invalid_state`);
  }
  await c.env.KV.delete(`oauth_state:${state}`);
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${c.env.API_URL}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return c.redirect(`${c.env.APP_URL}/auth/error?error=token_exchange_failed`);
    }
    
    const tokens = await tokenResponse.json<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
      id_token?: string;
    }>();
    
    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    if (!userInfoResponse.ok) {
      return c.redirect(`${c.env.APP_URL}/auth/error?error=userinfo_failed`);
    }
    
    const userInfo = await userInfoResponse.json<{
      id: string;
      email: string;
      name?: string;
      picture?: string;
    }>();
    
    // Find or create user
    let user = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    )
      .bind(userInfo.email)
      .first<{ id: string }>();
    
    const now = new Date().toISOString();
    
    if (!user) {
      // Create new user
      const userId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO users (id, email, display_name, created_at, last_login_at, plan, time_zone, locale)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(userId, userInfo.email, userInfo.name || null, now, now, 'free', 'UTC', 'en-US')
        .run();
      user = { id: userId };
    } else {
      // Update last login
      await c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
        .bind(now, user.id)
        .run();
    }
    
    // Store/update connection with encrypted tokens
    const { encryptToken } = await import('../security/crypto');
    
    const encryptedAccess = await encryptToken(tokens.access_token, c.env.TOKEN_ENC_KEY);
    const encryptedRefresh = tokens.refresh_token
      ? await encryptToken(tokens.refresh_token, c.env.TOKEN_ENC_KEY)
      : null;
    
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const scopes = JSON.stringify(tokens.scope.split(' '));
    
    // Upsert connection
    await c.env.DB.prepare(`
      INSERT INTO connections (id, user_id, provider, status, scopes, access_token_encrypted, access_token_iv, access_token_tag, refresh_token_encrypted, refresh_token_iv, refresh_token_tag, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        status = excluded.status,
        scopes = excluded.scopes,
        access_token_encrypted = excluded.access_token_encrypted,
        access_token_iv = excluded.access_token_iv,
        access_token_tag = excluded.access_token_tag,
        refresh_token_encrypted = COALESCE(excluded.refresh_token_encrypted, connections.refresh_token_encrypted),
        refresh_token_iv = COALESCE(excluded.refresh_token_iv, connections.refresh_token_iv),
        refresh_token_tag = COALESCE(excluded.refresh_token_tag, connections.refresh_token_tag),
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `)
      .bind(
        crypto.randomUUID(),
        user.id,
        'google',
        'connected',
        scopes,
        encryptedAccess.ciphertext,
        encryptedAccess.iv,
        encryptedAccess.tag,
        encryptedRefresh?.ciphertext || null,
        encryptedRefresh?.iv || null,
        encryptedRefresh?.tag || null,
        expiresAt,
        now,
        now
      )
      .run();
    
    // Create session
    const { sessionId, expiresAt: sessionExpires } = await createSession(c.env.KV, user.id);
    
    // Set session cookie on root domain (works for both r3cent.com and api.r3cent.com)
    c.header(
      'Set-Cookie',
      `r3cent_session=${sessionId}; Path=/; Domain=.r3cent.com; HttpOnly; Secure; SameSite=Lax; Expires=${sessionExpires.toUTCString()}`
    );
    
    return c.redirect(`${c.env.APP_URL}/`);
  } catch (err) {
    console.error('Google OAuth error:', err);
    return c.redirect(`${c.env.APP_URL}/auth/error?error=internal_error`);
  }
});

// GET /api/auth/spotify - Start Spotify OAuth flow
authRoutes.get('/spotify', async (c) => {
  const state = crypto.randomUUID();
  
  await c.env.KV.put(`oauth_state:${state}`, 'spotify', { expirationTtl: 600 });
  
  const scopes = ['user-read-recently-played', 'user-read-playback-state', 'user-top-read'];
  
  const params = new URLSearchParams({
    client_id: c.env.SPOTIFY_CLIENT_ID,
    redirect_uri: `${c.env.API_URL}/api/auth/spotify/callback`,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
  });
  
  return c.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// GET /api/auth/spotify/callback - Spotify OAuth callback
authRoutes.get('/spotify/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  
  if (error) {
    return c.redirect(`${c.env.APP_URL}/auth/error?error=${encodeURIComponent(error)}`);
  }
  
  if (!code || !state) {
    return c.redirect(`${c.env.APP_URL}/auth/error?error=missing_params`);
  }
  
  const storedState = await c.env.KV.get(`oauth_state:${state}`);
  if (!storedState) {
    return c.redirect(`${c.env.APP_URL}/auth/error?error=invalid_state`);
  }
  await c.env.KV.delete(`oauth_state:${state}`);
  
  // For Spotify, user must already be logged in (connection flow)
  // Get session from cookie
  const cookieHeader = c.req.header('Cookie');
  let sessionId: string | null = null;
  
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((cookie) => {
        const [key, ...v] = cookie.trim().split('=');
        return [key, v.join('=')];
      })
    );
    sessionId = cookies['r3cent_session'] || null;
  }
  
  if (!sessionId) {
    return c.redirect(`${c.env.APP_URL}/auth/error?error=not_logged_in`);
  }
  
  // Get user from session
  const session = await c.env.KV.get<{ userId: string }>(`session:${sessionId}`, 'json');
  if (!session) {
    return c.redirect(`${c.env.APP_URL}/auth/error?error=session_expired`);
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${c.env.SPOTIFY_CLIENT_ID}:${c.env.SPOTIFY_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        code,
        redirect_uri: `${c.env.API_URL}/api/auth/spotify/callback`,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      return c.redirect(`${c.env.APP_URL}/auth/error?error=token_exchange_failed`);
    }
    
    const tokens = await tokenResponse.json<{
      access_token: string;
      refresh_token: string;
      expires_in: number;
      scope: string;
    }>();
    
    const { encryptToken } = await import('../security/crypto');
    const encryptedAccess = await encryptToken(tokens.access_token, c.env.TOKEN_ENC_KEY);
    const encryptedRefresh = await encryptToken(tokens.refresh_token, c.env.TOKEN_ENC_KEY);
    
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const scopes = JSON.stringify(tokens.scope.split(' '));
    
    await c.env.DB.prepare(`
      INSERT INTO connections (id, user_id, provider, status, scopes, access_token_encrypted, access_token_iv, access_token_tag, refresh_token_encrypted, refresh_token_iv, refresh_token_tag, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, provider) DO UPDATE SET
        status = excluded.status,
        scopes = excluded.scopes,
        access_token_encrypted = excluded.access_token_encrypted,
        access_token_iv = excluded.access_token_iv,
        access_token_tag = excluded.access_token_tag,
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        refresh_token_iv = excluded.refresh_token_iv,
        refresh_token_tag = excluded.refresh_token_tag,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `)
      .bind(
        crypto.randomUUID(),
        session.userId,
        'spotify',
        'connected',
        scopes,
        encryptedAccess.ciphertext,
        encryptedAccess.iv,
        encryptedAccess.tag,
        encryptedRefresh.ciphertext,
        encryptedRefresh.iv,
        encryptedRefresh.tag,
        expiresAt,
        now,
        now
      )
      .run();
    
    return c.redirect(`${c.env.APP_URL}/settings/connections?connected=spotify`);
  } catch (err) {
    console.error('Spotify OAuth error:', err);
    return c.redirect(`${c.env.APP_URL}/auth/error?error=internal_error`);
  }
});
