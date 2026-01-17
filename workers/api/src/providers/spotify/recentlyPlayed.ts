import type { Env } from '../types';
import { getValidAccessToken } from '../security/tokens';
import { ItemType, SourceProvider } from '@r3cent/shared';

// Spotify sync - fetch recently played tracks
export async function syncSpotifyRecentlyPlayed(
  env: Env,
  db: D1Database,
  userId: string
): Promise<{ synced: number; errors: string[] }> {
  const accessToken = await getValidAccessToken(env, db, userId, 'spotify');
  if (!accessToken) {
    return { synced: 0, errors: ['No valid access token'] };
  }
  
  const errors: string[] = [];
  let synced = 0;
  
  try {
    const { tracks, contexts } = await fetchRecentlyPlayed(accessToken);
    
    // Insert tracks
    for (const track of tracks) {
      const item = mapTrackToItem(track, userId);
      await upsertItem(db, item);
      synced++;
    }
    
    // Insert contexts (distinct playlists/albums from recent plays)
    for (const context of contexts) {
      const item = mapContextToItem(context, userId);
      await upsertItem(db, item);
      synced++;
    }
  } catch (err) {
    errors.push(`Spotify sync failed: ${(err as Error).message}`);
  }
  
  // Update last sync time
  await db.prepare(
    "UPDATE connections SET last_sync_at = ? WHERE user_id = ? AND provider = 'spotify'"
  )
    .bind(new Date().toISOString(), userId)
    .run();
  
  return { synced, errors };
}

interface SpotifyTrack {
  track: {
    id: string;
    name: string;
    uri: string;
    duration_ms: number;
    artists: Array<{ name: string }>;
    album: {
      name: string;
      images: Array<{ url: string }>;
    };
  };
  played_at: string;
  context: {
    uri: string;
    type: string;
  } | null;
}

interface SpotifyContext {
  uri: string;
  type: 'playlist' | 'album' | 'artist';
  name: string;
  imageUrl?: string;
  playedAt: string;
}

async function fetchRecentlyPlayed(
  accessToken: string
): Promise<{ tracks: SpotifyTrack[]; contexts: SpotifyContext[] }> {
  const response = await fetch(
    'https://api.spotify.com/v1/me/player/recently-played?limit=50',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    throw new Error(`Spotify fetch failed: ${response.status}`);
  }
  
  const data = await response.json<{ items: SpotifyTrack[] }>();
  const tracks = data.items || [];
  
  // Extract distinct contexts
  const contextMap = new Map<string, SpotifyContext>();
  for (const item of tracks) {
    if (item.context && !contextMap.has(item.context.uri)) {
      contextMap.set(item.context.uri, {
        uri: item.context.uri,
        type: item.context.type as 'playlist' | 'album' | 'artist',
        name: await fetchContextName(accessToken, item.context.uri, item.context.type),
        playedAt: item.played_at,
      });
    }
  }
  
  // Only keep 3 most recent contexts
  const contexts = Array.from(contextMap.values())
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .slice(0, 3);
  
  return { tracks, contexts };
}

async function fetchContextName(
  accessToken: string,
  uri: string,
  type: string
): Promise<string> {
  // Extract ID from URI (e.g., "spotify:playlist:37i9dQZF1DXcBWIGoYBM5M")
  const parts = uri.split(':');
  const id = parts[parts.length - 1];
  
  let endpoint: string;
  switch (type) {
    case 'playlist':
      endpoint = `https://api.spotify.com/v1/playlists/${id}?fields=name`;
      break;
    case 'album':
      endpoint = `https://api.spotify.com/v1/albums/${id}`;
      break;
    case 'artist':
      endpoint = `https://api.spotify.com/v1/artists/${id}`;
      break;
    default:
      return 'Unknown';
  }
  
  try {
    const response = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    
    if (response.ok) {
      const data = await response.json<{ name: string }>();
      return data.name;
    }
  } catch {
    // Fall through to default
  }
  
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}`;
}

function mapTrackToItem(track: SpotifyTrack, userId: string): DbItem {
  const artistNames = track.track.artists.map((a) => a.name).join(', ');
  
  return {
    id: crypto.randomUUID(),
    userId,
    type: ItemType.TUNES_TRACK,
    sourceProvider: SourceProvider.SPOTIFY,
    sourceId: `${track.track.uri}:${track.played_at}`, // Make unique per play
    ts: track.played_at,
    title: track.track.name,
    content: `${artistNames} — ${track.track.album.name}`,
    meta: JSON.stringify({
      artist: artistNames,
      album: track.track.album.name,
      durationMs: track.track.duration_ms,
      uri: track.track.uri,
      playedAt: track.played_at,
      contextUri: track.context?.uri,
      contextType: track.context?.type,
    }),
    digest: null,
    status: JSON.stringify({
      pinned: false,
      ignored: false,
      deleted: false,
      tasked: false,
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function mapContextToItem(context: SpotifyContext, userId: string): DbItem {
  const typeLabel = context.type.charAt(0).toUpperCase() + context.type.slice(1);
  
  return {
    id: crypto.randomUUID(),
    userId,
    type: ItemType.TUNES_CONTEXT,
    sourceProvider: SourceProvider.SPOTIFY,
    sourceId: context.uri,
    ts: context.playedAt,
    title: `${typeLabel}: ${context.name}`,
    content: null,
    meta: JSON.stringify({
      contextUri: context.uri,
      contextType: context.type,
      name: context.name,
      imageUrl: context.imageUrl,
    }),
    digest: null,
    status: JSON.stringify({
      pinned: false,
      ignored: false,
      deleted: false,
      tasked: false,
    }),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

interface DbItem {
  id: string;
  userId: string;
  type: string;
  sourceProvider: string;
  sourceId: string;
  ts: string;
  title: string | null;
  content: string | null;
  meta: string;
  digest: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

async function upsertItem(db: D1Database, item: DbItem): Promise<void> {
  await db.prepare(`
    INSERT INTO items (id, user_id, type, source_provider, source_id, ts, title, content, meta, digest, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, source_provider, source_id) DO UPDATE SET
      title = excluded.title,
      content = excluded.content,
      meta = excluded.meta,
      updated_at = excluded.updated_at
  `)
    .bind(
      item.id,
      item.userId,
      item.type,
      item.sourceProvider,
      item.sourceId,
      item.ts,
      item.title,
      item.content,
      item.meta,
      item.digest,
      item.status,
      item.createdAt,
      item.updatedAt
    )
    .run();
}
