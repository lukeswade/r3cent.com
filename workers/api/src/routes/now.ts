import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import type { ItemCard, ChannelBlock, NowResponse } from '@r3cent/shared';
import { ItemType, Channel } from '@r3cent/shared';

const ITEMS_PER_CHANNEL = 3;

export const nowRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// GET /api/now - Main dashboard aggregator
nowRoutes.get('/', async (c) => {
  const user = c.get('user');
  
  // Fetch items for each channel in parallel
  const [thoughts, scrawls, emailReceived, emailSent, calendarPast, calendarUpcoming, tunesTracks, tunesContexts, digests] = await Promise.all([
    // Thoughts (voice)
    fetchItemsByType(c.env.DB, user.id, ItemType.THOUGHT_VOICE, ITEMS_PER_CHANNEL),
    // Scrawls (text)
    fetchItemsByType(c.env.DB, user.id, ItemType.SCRAWL_TEXT, ITEMS_PER_CHANNEL),
    // Email received
    fetchItemsByType(c.env.DB, user.id, ItemType.EMAIL_RECEIVED, ITEMS_PER_CHANNEL),
    // Email sent
    fetchItemsByType(c.env.DB, user.id, ItemType.EMAIL_SENT, ITEMS_PER_CHANNEL),
    // Calendar past
    fetchItemsByType(c.env.DB, user.id, ItemType.CALENDAR_PAST, ITEMS_PER_CHANNEL),
    // Calendar upcoming
    fetchItemsByType(c.env.DB, user.id, ItemType.CALENDAR_UPCOMING, ITEMS_PER_CHANNEL),
    // Tunes tracks
    fetchItemsByType(c.env.DB, user.id, ItemType.TUNES_TRACK, ITEMS_PER_CHANNEL),
    // Tunes contexts
    fetchItemsByType(c.env.DB, user.id, ItemType.TUNES_CONTEXT, ITEMS_PER_CHANNEL),
    // Channel digests
    fetchChannelDigests(c.env.DB, user.id),
  ]);
  
  // Fetch last sync times for connected providers
  const connections = await c.env.DB.prepare(
    'SELECT provider, last_sync_at FROM connections WHERE user_id = ? AND status = ?'
  )
    .bind(user.id, 'connected')
    .all<{ provider: string; last_sync_at: string | null }>();
  
  const googleSyncAt = connections.results?.find((c) => c.provider === 'google')?.last_sync_at;
  const spotifySyncAt = connections.results?.find((c) => c.provider === 'spotify')?.last_sync_at;
  
  const response: NowResponse = {
    channels: {
      thoughts: {
        items: thoughts,
        digest: digests.get(Channel.THOUGHTS),
      },
      scrawls: {
        items: scrawls,
        digest: digests.get(Channel.SCRAWLS),
      },
      email: {
        items: [...emailReceived, ...emailSent].sort((a, b) => 
          new Date(b.ts).getTime() - new Date(a.ts).getTime()
        ).slice(0, ITEMS_PER_CHANNEL),
        digest: digests.get(Channel.EMAIL),
        lastSyncAt: googleSyncAt ?? undefined,
      },
      calendar: {
        items: [...calendarPast, ...calendarUpcoming].sort((a, b) => 
          new Date(b.ts).getTime() - new Date(a.ts).getTime()
        ).slice(0, ITEMS_PER_CHANNEL),
        digest: digests.get(Channel.CALENDAR),
        lastSyncAt: googleSyncAt ?? undefined,
      },
      tunes: {
        items: [...tunesTracks, ...tunesContexts].sort((a, b) => 
          new Date(b.ts).getTime() - new Date(a.ts).getTime()
        ).slice(0, ITEMS_PER_CHANNEL),
        digest: digests.get(Channel.TUNES),
        lastSyncAt: spotifySyncAt ?? undefined,
      },
    },
  };
  
  return c.json(response);
});

// Helper to fetch items by type
async function fetchItemsByType(
  db: D1Database,
  userId: string,
  type: string,
  limit: number
): Promise<ItemCard[]> {
  const result = await db.prepare(`
    SELECT id, type, ts, title, content, digest, status, meta
    FROM items
    WHERE user_id = ? AND type = ? AND json_extract(status, '$.deleted') = false
    ORDER BY ts DESC
    LIMIT ?
  `)
    .bind(userId, type, limit)
    .all<{
      id: string;
      type: string;
      ts: string;
      title: string | null;
      content: string | null;
      digest: string | null;
      status: string;
      meta: string;
    }>();
  
  return (result.results || []).map((row) => ({
    id: row.id,
    type: row.type as ItemCard['type'],
    ts: row.ts,
    title: row.title,
    content: row.content,
    digest: row.digest,
    status: JSON.parse(row.status),
    meta: JSON.parse(row.meta),
  }));
}

// Helper to fetch channel digests
async function fetchChannelDigests(
  db: D1Database,
  userId: string
): Promise<Map<string, string>> {
  const result = await db.prepare(`
    SELECT channel, digest_text
    FROM channel_digests
    WHERE user_id = ?
    AND created_at = (
      SELECT MAX(created_at) FROM channel_digests cd2 
      WHERE cd2.user_id = channel_digests.user_id 
      AND cd2.channel = channel_digests.channel
    )
  `)
    .bind(userId)
    .all<{ channel: string; digest_text: string }>();
  
  const digests = new Map<string, string>();
  for (const row of result.results || []) {
    digests.set(row.channel, row.digest_text);
  }
  return digests;
}

// POST /api/now/refresh/:channel - Trigger refresh for a channel
nowRoutes.post('/refresh/:channel', async (c) => {
  const user = c.get('user');
  const channel = c.req.param('channel');
  
  const validChannels = ['email', 'calendar', 'tunes'];
  if (!validChannels.includes(channel)) {
    return c.json({ error: 'Invalid channel', code: 'INVALID_CHANNEL' }, 400);
  }
  
  // Map channel to provider
  const provider = channel === 'tunes' ? 'spotify' : 'google';
  
  // Check if connection exists and get tokens
  const connection = await c.env.DB.prepare(`
    SELECT id, status, access_token_encrypted, access_token_iv, access_token_tag,
           refresh_token_encrypted, refresh_token_iv, refresh_token_tag, expires_at
    FROM connections WHERE user_id = ? AND provider = ?
  `)
    .bind(user.id, provider)
    .first<{
      id: string;
      status: string;
      access_token_encrypted: string;
      access_token_iv: string;
      access_token_tag: string;
      refresh_token_encrypted: string | null;
      refresh_token_iv: string | null;
      refresh_token_tag: string | null;
      expires_at: string;
    }>();
  
  if (!connection || connection.status !== 'connected') {
    return c.json({ 
      error: `${provider} not connected`, 
      code: 'PROVIDER_NOT_CONNECTED' 
    }, 400);
  }
  
  try {
    // Decrypt access token
    const { decryptToken } = await import('../security/crypto');
    let accessToken = await decryptToken(
      {
        ciphertext: connection.access_token_encrypted,
        iv: connection.access_token_iv,
        tag: connection.access_token_tag,
      },
      c.env.TOKEN_ENC_KEY
    );
    
    // Check if token is expired and refresh if needed
    if (new Date(connection.expires_at) < new Date()) {
      if (!connection.refresh_token_encrypted) {
        return c.json({ error: 'Token expired and no refresh token', code: 'TOKEN_EXPIRED' }, 401);
      }
      
      const { refreshGoogleToken } = await import('../security/tokens');
      const refreshToken = await decryptToken(
        {
          ciphertext: connection.refresh_token_encrypted,
          iv: connection.refresh_token_iv!,
          tag: connection.refresh_token_tag!,
        },
        c.env.TOKEN_ENC_KEY
      );
      
      const newTokens = await refreshGoogleToken(
        refreshToken,
        c.env.GOOGLE_CLIENT_ID,
        c.env.GOOGLE_CLIENT_SECRET
      );
      
      // Update stored tokens
      const { encryptToken } = await import('../security/crypto');
      const encryptedAccess = await encryptToken(newTokens.access_token, c.env.TOKEN_ENC_KEY);
      const expiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
      
      await c.env.DB.prepare(`
        UPDATE connections SET
          access_token_encrypted = ?,
          access_token_iv = ?,
          access_token_tag = ?,
          expires_at = ?,
          updated_at = ?
        WHERE id = ?
      `)
        .bind(
          encryptedAccess.ciphertext,
          encryptedAccess.iv,
          encryptedAccess.tag,
          expiresAt,
          new Date().toISOString(),
          connection.id
        )
        .run();
      
      accessToken = newTokens.access_token;
    }
    
    // Sync based on channel
    let itemsAdded = 0;
    const now = new Date().toISOString();
    
    if (channel === 'email') {
      const { syncGmail } = await import('../providers/google/gmail');
      const emails = await syncGmail(accessToken);
      
      for (const email of emails) {
        await c.env.DB.prepare(`
          INSERT OR REPLACE INTO items (id, user_id, type, ts, title, content, source_id, status, meta, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            crypto.randomUUID(),
            user.id,
            email.type,
            email.date,
            email.subject,
            email.snippet,
            email.id,
            JSON.stringify({ deleted: false, pinned: false, ignored: false }),
            JSON.stringify({ from: email.from, to: email.to }),
            now
          )
          .run();
        itemsAdded++;
      }
    } else if (channel === 'calendar') {
      const { syncCalendar } = await import('../providers/google/calendar');
      const events = await syncCalendar(accessToken);
      
      for (const event of events) {
        await c.env.DB.prepare(`
          INSERT OR REPLACE INTO items (id, user_id, type, ts, title, content, source_id, status, meta, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
          .bind(
            crypto.randomUUID(),
            user.id,
            event.type,
            event.start,
            event.summary,
            event.description || '',
            event.id,
            JSON.stringify({ deleted: false, pinned: false, ignored: false }),
            JSON.stringify({ location: event.location, end: event.end, attendees: event.attendees }),
            now
          )
          .run();
        itemsAdded++;
      }
    }
    
    // Update last sync time
    await c.env.DB.prepare('UPDATE connections SET last_sync_at = ? WHERE id = ?')
      .bind(now, connection.id)
      .run();
    
    return c.json({ 
      message: 'Sync complete',
      channel,
      itemsAdded,
    });
  } catch (err) {
    console.error('Sync error:', err);
    return c.json({ 
      error: 'Sync failed', 
      code: 'SYNC_ERROR',
      details: err instanceof Error ? err.message : 'Unknown error'
    }, 500);
  }
});
