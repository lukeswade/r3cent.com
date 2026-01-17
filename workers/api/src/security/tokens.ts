import type { Env } from '../types';
import { decryptToken, encryptToken } from './crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

// Get decrypted tokens for a connection
export async function getTokens(
  db: D1Database,
  userId: string,
  provider: 'google' | 'spotify',
  encKey: string
): Promise<TokenPair | null> {
  const conn = await db.prepare(`
    SELECT access_token_encrypted, access_token_iv, access_token_tag,
           refresh_token_encrypted, refresh_token_iv, refresh_token_tag,
           expires_at
    FROM connections
    WHERE user_id = ? AND provider = ? AND status = 'connected'
  `)
    .bind(userId, provider)
    .first<{
      access_token_encrypted: string | null;
      access_token_iv: string | null;
      access_token_tag: string | null;
      refresh_token_encrypted: string | null;
      refresh_token_iv: string | null;
      refresh_token_tag: string | null;
      expires_at: string | null;
    }>();
  
  if (!conn || !conn.access_token_encrypted) {
    return null;
  }
  
  const accessToken = await decryptToken(
    {
      ciphertext: conn.access_token_encrypted,
      iv: conn.access_token_iv!,
      tag: conn.access_token_tag!,
    },
    encKey
  );
  
  let refreshToken: string | null = null;
  if (conn.refresh_token_encrypted) {
    refreshToken = await decryptToken(
      {
        ciphertext: conn.refresh_token_encrypted,
        iv: conn.refresh_token_iv!,
        tag: conn.refresh_token_tag!,
      },
      encKey
    );
  }
  
  return {
    accessToken,
    refreshToken,
    expiresAt: conn.expires_at ? new Date(conn.expires_at) : new Date(0),
  };
}

// Refresh Google access token
export async function refreshGoogleToken(
  db: D1Database,
  userId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  encKey: string
): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Google token refresh failed:', error);
    
    // Mark connection as error
    await db.prepare(
      "UPDATE connections SET status = 'error', error_message = ? WHERE user_id = ? AND provider = 'google'"
    )
      .bind('Token refresh failed', userId)
      .run();
    
    throw new Error('Token refresh failed');
  }
  
  const tokens = await response.json<{
    access_token: string;
    expires_in: number;
  }>();
  
  // Encrypt and store new access token
  const encrypted = await encryptToken(tokens.access_token, encKey);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  
  await db.prepare(`
    UPDATE connections SET
      access_token_encrypted = ?,
      access_token_iv = ?,
      access_token_tag = ?,
      expires_at = ?,
      updated_at = ?,
      status = 'connected',
      error_message = NULL
    WHERE user_id = ? AND provider = 'google'
  `)
    .bind(
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      expiresAt,
      new Date().toISOString(),
      userId
    )
    .run();
  
  return tokens.access_token;
}

// Refresh Spotify access token
export async function refreshSpotifyToken(
  db: D1Database,
  userId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  encKey: string
): Promise<string> {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Spotify token refresh failed:', error);
    
    await db.prepare(
      "UPDATE connections SET status = 'error', error_message = ? WHERE user_id = ? AND provider = 'spotify'"
    )
      .bind('Token refresh failed', userId)
      .run();
    
    throw new Error('Token refresh failed');
  }
  
  const tokens = await response.json<{
    access_token: string;
    expires_in: number;
    refresh_token?: string; // Spotify may return a new refresh token
  }>();
  
  const encryptedAccess = await encryptToken(tokens.access_token, encKey);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  
  // If a new refresh token is provided, update it too
  if (tokens.refresh_token) {
    const encryptedRefresh = await encryptToken(tokens.refresh_token, encKey);
    await db.prepare(`
      UPDATE connections SET
        access_token_encrypted = ?,
        access_token_iv = ?,
        access_token_tag = ?,
        refresh_token_encrypted = ?,
        refresh_token_iv = ?,
        refresh_token_tag = ?,
        expires_at = ?,
        updated_at = ?,
        status = 'connected',
        error_message = NULL
      WHERE user_id = ? AND provider = 'spotify'
    `)
      .bind(
        encryptedAccess.ciphertext,
        encryptedAccess.iv,
        encryptedAccess.tag,
        encryptedRefresh.ciphertext,
        encryptedRefresh.iv,
        encryptedRefresh.tag,
        expiresAt,
        new Date().toISOString(),
        userId
      )
      .run();
  } else {
    await db.prepare(`
      UPDATE connections SET
        access_token_encrypted = ?,
        access_token_iv = ?,
        access_token_tag = ?,
        expires_at = ?,
        updated_at = ?,
        status = 'connected',
        error_message = NULL
      WHERE user_id = ? AND provider = 'spotify'
    `)
      .bind(
        encryptedAccess.ciphertext,
        encryptedAccess.iv,
        encryptedAccess.tag,
        expiresAt,
        new Date().toISOString(),
        userId
      )
      .run();
  }
  
  return tokens.access_token;
}

// Get valid access token, refreshing if needed
export async function getValidAccessToken(
  env: Env,
  db: D1Database,
  userId: string,
  provider: 'google' | 'spotify'
): Promise<string | null> {
  const tokens = await getTokens(db, userId, provider, env.TOKEN_ENC_KEY);
  if (!tokens) return null;
  
  // Check if token is expired (with 5 min buffer)
  const bufferMs = 5 * 60 * 1000;
  if (tokens.expiresAt.getTime() > Date.now() + bufferMs) {
    return tokens.accessToken;
  }
  
  // Need to refresh
  if (!tokens.refreshToken) {
    console.error(`No refresh token for ${provider}`);
    return null;
  }
  
  try {
    if (provider === 'google') {
      return await refreshGoogleToken(
        db,
        userId,
        tokens.refreshToken,
        env.GOOGLE_CLIENT_ID,
        env.GOOGLE_CLIENT_SECRET,
        env.TOKEN_ENC_KEY
      );
    } else {
      return await refreshSpotifyToken(
        db,
        userId,
        tokens.refreshToken,
        env.SPOTIFY_CLIENT_ID,
        env.SPOTIFY_CLIENT_SECRET,
        env.TOKEN_ENC_KEY
      );
    }
  } catch (err) {
    console.error(`Failed to refresh ${provider} token:`, err);
    return null;
  }
}
