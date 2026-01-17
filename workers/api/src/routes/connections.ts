import { Hono } from 'hono';
import type { Env, Variables } from '../types';

export const connectionsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/connections - List user's connections
connectionsRoutes.get('/', async (c) => {
  const user = c.get('user');
  
  const result = await c.env.DB.prepare(`
    SELECT id, provider, status, scopes, last_sync_at, error_code, error_message
    FROM connections
    WHERE user_id = ?
  `)
    .bind(user.id)
    .all<{
      id: string;
      provider: string;
      status: string;
      scopes: string;
      last_sync_at: string | null;
      error_code: string | null;
      error_message: string | null;
    }>();
  
  return c.json({
    connections: (result.results || []).map((conn) => ({
      id: conn.id,
      provider: conn.provider,
      status: conn.status,
      scopes: JSON.parse(conn.scopes),
      lastSyncAt: conn.last_sync_at,
      error: conn.error_message,
    })),
  });
});

// POST /api/connections/google/start - Initiate Google OAuth for connections
connectionsRoutes.post('/google/start', async (c) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
  ];
  
  const state = crypto.randomUUID();
  await c.env.KV.put(`oauth_state:${state}`, 'google_connect', { expirationTtl: 600 });
  
  // Store session info for reconnecting after OAuth
  const sessionId = c.get('sessionId');
  await c.env.KV.put(`oauth_session:${state}`, sessionId, { expirationTtl: 600 });
  
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${c.env.API_URL}/api/connections/google/callback`,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent',
  });
  
  return c.json({
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
  });
});

// GET /api/connections/google/callback - Google OAuth callback for adding connection
connectionsRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  
  if (error) {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=${encodeURIComponent(error)}`);
  }
  
  if (!code || !state) {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=missing_params`);
  }
  
  // Verify state
  const storedType = await c.env.KV.get(`oauth_state:${state}`);
  if (storedType !== 'google_connect') {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=invalid_state`);
  }
  await c.env.KV.delete(`oauth_state:${state}`);
  
  // Get user from stored session
  const sessionId = await c.env.KV.get(`oauth_session:${state}`);
  await c.env.KV.delete(`oauth_session:${state}`);
  
  if (!sessionId) {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=session_lost`);
  }
  
  const session = await c.env.KV.get<{ userId: string }>(`session:${sessionId}`, 'json');
  if (!session) {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=session_expired`);
  }
  
  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${c.env.API_URL}/api/connections/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      return c.redirect(`${c.env.APP_URL}/settings/connections?error=token_exchange_failed`);
    }
    
    const tokens = await tokenResponse.json<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    }>();
    
    const { encryptToken } = await import('../security/crypto');
    const encryptedAccess = await encryptToken(tokens.access_token, c.env.TOKEN_ENC_KEY);
    const encryptedRefresh = tokens.refresh_token
      ? await encryptToken(tokens.refresh_token, c.env.TOKEN_ENC_KEY)
      : null;
    
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
        refresh_token_encrypted = COALESCE(excluded.refresh_token_encrypted, connections.refresh_token_encrypted),
        refresh_token_iv = COALESCE(excluded.refresh_token_iv, connections.refresh_token_iv),
        refresh_token_tag = COALESCE(excluded.refresh_token_tag, connections.refresh_token_tag),
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `)
      .bind(
        crypto.randomUUID(),
        session.userId,
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
    
    return c.redirect(`${c.env.APP_URL}/settings/connections?connected=google`);
  } catch (err) {
    console.error('Google connection error:', err);
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=internal_error`);
  }
});

// POST /api/connections/google/disconnect - Disconnect Google
connectionsRoutes.post('/google/disconnect', async (c) => {
  const user = c.get('user');
  
  // Delete connection
  await c.env.DB.prepare(
    'DELETE FROM connections WHERE user_id = ? AND provider = ?'
  )
    .bind(user.id, 'google')
    .run();
  
  // Optionally delete all Google-sourced items
  // await c.env.DB.prepare(
  //   'DELETE FROM items WHERE user_id = ? AND source_provider = ?'
  // ).bind(user.id, 'google').run();
  
  return c.json({ success: true });
});

// POST /api/connections/spotify/start - Initiate Spotify OAuth
connectionsRoutes.post('/spotify/start', async (c) => {
  const scopes = ['user-read-recently-played', 'user-read-playback-state', 'user-top-read'];
  
  const state = crypto.randomUUID();
  await c.env.KV.put(`oauth_state:${state}`, 'spotify_connect', { expirationTtl: 600 });
  
  const sessionId = c.get('sessionId');
  await c.env.KV.put(`oauth_session:${state}`, sessionId, { expirationTtl: 600 });
  
  const params = new URLSearchParams({
    client_id: c.env.SPOTIFY_CLIENT_ID,
    redirect_uri: `${c.env.API_URL}/api/connections/spotify/callback`,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
  });
  
  return c.json({
    authUrl: `https://accounts.spotify.com/authorize?${params}`,
  });
});

// GET /api/connections/spotify/callback - Spotify OAuth callback
connectionsRoutes.get('/spotify/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const error = c.req.query('error');
  
  if (error) {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=${encodeURIComponent(error)}`);
  }
  
  if (!code || !state) {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=missing_params`);
  }
  
  const storedType = await c.env.KV.get(`oauth_state:${state}`);
  if (storedType !== 'spotify_connect') {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=invalid_state`);
  }
  await c.env.KV.delete(`oauth_state:${state}`);
  
  const sessionId = await c.env.KV.get(`oauth_session:${state}`);
  await c.env.KV.delete(`oauth_session:${state}`);
  
  if (!sessionId) {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=session_lost`);
  }
  
  const session = await c.env.KV.get<{ userId: string }>(`session:${sessionId}`, 'json');
  if (!session) {
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=session_expired`);
  }
  
  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${btoa(`${c.env.SPOTIFY_CLIENT_ID}:${c.env.SPOTIFY_CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        code,
        redirect_uri: `${c.env.API_URL}/api/connections/spotify/callback`,
        grant_type: 'authorization_code',
      }),
    });
    
    if (!tokenResponse.ok) {
      return c.redirect(`${c.env.APP_URL}/settings/connections?error=token_exchange_failed`);
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
    console.error('Spotify connection error:', err);
    return c.redirect(`${c.env.APP_URL}/settings/connections?error=internal_error`);
  }
});

// POST /api/connections/spotify/disconnect - Disconnect Spotify
connectionsRoutes.post('/spotify/disconnect', async (c) => {
  const user = c.get('user');
  
  await c.env.DB.prepare(
    'DELETE FROM connections WHERE user_id = ? AND provider = ?'
  )
    .bind(user.id, 'spotify')
    .run();
  
  return c.json({ success: true });
});

// POST /api/connections/:provider/delete-data - Delete all data from a provider
connectionsRoutes.post('/:provider/delete-data', async (c) => {
  const user = c.get('user');
  const provider = c.req.param('provider');
  
  if (!['google', 'spotify'].includes(provider)) {
    return c.json({ error: 'Invalid provider', code: 'INVALID_PROVIDER' }, 400);
  }
  
  // Delete all items from this provider
  await c.env.DB.prepare(
    'DELETE FROM items WHERE user_id = ? AND source_provider = ?'
  )
    .bind(user.id, provider)
    .run();
  
  // Delete the connection
  await c.env.DB.prepare(
    'DELETE FROM connections WHERE user_id = ? AND provider = ?'
  )
    .bind(user.id, provider)
    .run();
  
  return c.json({ success: true });
});
