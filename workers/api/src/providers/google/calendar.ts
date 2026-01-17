import { ItemType } from '@r3cent/shared';

interface CalendarItem {
  id: string;
  type: string;
  start: string;
  end: string;
  summary: string;
  description: string | null;
  location: string | null;
  attendees: number;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string }>;
}

// Calendar sync - fetch events with provided access token
export async function syncCalendar(accessToken: string): Promise<CalendarItem[]> {
  const events: CalendarItem[] = [];
  const now = new Date();
  const past30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const future30d = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  
  try {
    const params = new URLSearchParams({
      timeMin: past30d.toISOString(),
      timeMax: future30d.toISOString(),
      maxResults: '20',
      singleEvents: 'true',
      orderBy: 'startTime',
    });
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    
    if (!response.ok) {
      console.error('Calendar fetch failed:', await response.text());
      return events;
    }
    
    const data = await response.json() as { items?: GoogleCalendarEvent[] };
    
    if (!data.items) {
      return events;
    }
    
    for (const event of data.items) {
      const startStr = event.start.dateTime || event.start.date;
      if (!startStr) continue;
      
      const endStr = event.end.dateTime || event.end.date;
      const eventStart = new Date(startStr);
      const type = eventStart < now ? ItemType.CALENDAR_PAST : ItemType.CALENDAR_UPCOMING;
      
      events.push({
        id: event.id,
        type,
        start: startStr,
        end: endStr || startStr,
        summary: event.summary || '(no title)',
        description: event.description?.slice(0, 500) || null,
        location: event.location || null,
        attendees: event.attendees?.length || 0,
      });
    }
  } catch (err) {
    console.error('Calendar sync error:', err);
  }
  
  return events;
}
