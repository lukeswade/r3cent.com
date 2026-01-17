import type { Env } from '../types';
import { getValidAccessToken } from '../security/tokens';
import { ItemType, SourceProvider } from '@r3cent/shared';

// Calendar sync - fetch past and upcoming events
export async function syncCalendar(
  env: Env,
  db: D1Database,
  userId: string
): Promise<{ synced: number; errors: string[] }> {
  const accessToken = await getValidAccessToken(env, db, userId, 'google');
  if (!accessToken) {
    return { synced: 0, errors: ['No valid access token'] };
  }
  
  const errors: string[] = [];
  let synced = 0;
  
  const now = new Date();
  const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const future30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  try {
    // Fetch events from primary calendar
    const events = await fetchCalendarEvents(
      accessToken,
      'primary',
      past30d.toISOString(),
      future30d.toISOString()
    );
    
    for (const event of events) {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const type = eventStart < now ? ItemType.CALENDAR_PAST : ItemType.CALENDAR_UPCOMING;
      
      const item = mapCalendarEventToItem(event, userId, type);
      await upsertItem(db, item);
      synced++;
    }
  } catch (err) {
    errors.push(`Calendar sync failed: ${(err as Error).message}`);
  }
  
  // Update last sync time
  await db.prepare(
    "UPDATE connections SET last_sync_at = ? WHERE user_id = ? AND provider = 'google'"
  )
    .bind(new Date().toISOString(), userId)
    .run();
  
  return { synced, errors };
}

interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string; responseStatus?: string }>;
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ uri: string; entryPointType: string }>;
  };
  recurringEventId?: string;
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    maxResults: '100',
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  
  if (!response.ok) {
    throw new Error(`Calendar fetch failed: ${response.status}`);
  }
  
  const data = await response.json<{ items?: CalendarEvent[] }>();
  return data.items || [];
}

function mapCalendarEventToItem(
  event: CalendarEvent,
  userId: string,
  type: typeof ItemType.CALENDAR_PAST | typeof ItemType.CALENDAR_UPCOMING
): DbItem {
  const startStr = event.start.dateTime || event.start.date;
  const isAllDay = !event.start.dateTime;
  
  // Get meet link
  let meetLink: string | undefined;
  if (event.hangoutLink) {
    meetLink = event.hangoutLink;
  } else if (event.conferenceData?.entryPoints) {
    const videoEntry = event.conferenceData.entryPoints.find(
      (e) => e.entryPointType === 'video'
    );
    meetLink = videoEntry?.uri;
  }
  
  return {
    id: crypto.randomUUID(),
    userId,
    type,
    sourceProvider: SourceProvider.GOOGLE,
    sourceId: event.id,
    ts: new Date(startStr!).toISOString(),
    title: event.summary || '(no title)',
    content: event.description?.slice(0, 500) || null,
    meta: JSON.stringify({
      eventId: event.id,
      location: event.location,
      meetLink,
      attendeesCount: event.attendees?.length || 0,
      isAllDay,
      recurring: !!event.recurringEventId,
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
      type = excluded.type,
      ts = excluded.ts,
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
