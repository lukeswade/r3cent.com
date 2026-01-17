import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types';
import { askRequestSchema } from '@r3cent/shared';
import type { AskResponse, AskSource } from '@r3cent/shared';

export const askRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/ask - Main ask endpoint
askRoutes.post('/', async (c) => {
  const user = c.get('user');
  
  // Parse and validate request
  const body = await c.req.json();
  const parsed = askRequestSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    }, 400);
  }
  
  const { query, sessionId: existingSessionId } = parsed.data;
  
  // Get or create session
  let sessionId = existingSessionId;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    await c.env.DB.prepare(
      'INSERT INTO ask_sessions (id, user_id, created_at) VALUES (?, ?, ?)'
    )
      .bind(sessionId, user.id, new Date().toISOString())
      .run();
  }
  
  // Store user message
  const userMessageId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO ask_messages (id, session_id, role, text, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(userMessageId, sessionId, 'user', query, '[]', new Date().toISOString())
    .run();
  
  // Retrieve relevant items (MVP: rule-based + keyword matching)
  const relevantItems = await retrieveRelevantItems(c.env.DB, user.id, query);
  
  // Generate answer using AI
  // TODO: Integrate with actual AI provider (Gemini/OpenAI)
  const { answer, sources, followups } = await generateAnswer(
    query,
    relevantItems,
    c.env.AI_API_KEY
  );
  
  // Store assistant message
  const assistantMessageId = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO ask_messages (id, session_id, role, text, sources, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  )
    .bind(
      assistantMessageId,
      sessionId,
      'assistant',
      answer,
      JSON.stringify(sources),
      new Date().toISOString()
    )
    .run();
  
  const response: AskResponse = {
    sessionId,
    answer,
    sources,
    followups,
  };
  
  return c.json(response);
});

// GET /api/ask/sessions - List ask sessions
askRoutes.get('/sessions', async (c) => {
  const user = c.get('user');
  
  const result = await c.env.DB.prepare(
    'SELECT id, title, created_at FROM ask_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  )
    .bind(user.id)
    .all<{ id: string; title: string | null; created_at: string }>();
  
  return c.json({
    sessions: result.results || [],
  });
});

// GET /api/ask/sessions/:id - Get session messages
askRoutes.get('/sessions/:id', async (c) => {
  const user = c.get('user');
  const sessionId = c.req.param('id');
  
  // Verify session belongs to user
  const session = await c.env.DB.prepare(
    'SELECT id, title, created_at FROM ask_sessions WHERE id = ? AND user_id = ?'
  )
    .bind(sessionId, user.id)
    .first<{ id: string; title: string | null; created_at: string }>();
  
  if (!session) {
    return c.json({ error: 'Session not found', code: 'NOT_FOUND' }, 404);
  }
  
  const messages = await c.env.DB.prepare(
    'SELECT id, role, text, sources, created_at FROM ask_messages WHERE session_id = ? ORDER BY created_at ASC'
  )
    .bind(sessionId)
    .all<{ id: string; role: string; text: string; sources: string; created_at: string }>();
  
  return c.json({
    session,
    messages: (messages.results || []).map((m) => ({
      ...m,
      sources: JSON.parse(m.sources),
    })),
  });
});

// Helper: Retrieve relevant items based on query
interface RetrievedItem {
  id: string;
  type: string;
  ts: string;
  title: string | null;
  content: string | null;
  meta: Record<string, unknown>;
}

async function retrieveRelevantItems(
  db: D1Database,
  userId: string,
  query: string
): Promise<RetrievedItem[]> {
  const queryLower = query.toLowerCase();
  
  // Parse intent from query
  const wantsRecent = /recent|latest|last|new/i.test(query);
  const wantsThoughts = /thought|voice|said|spoke/i.test(query);
  const wantsScrawls = /scrawl|note|wrote|typed/i.test(query);
  const wantsEmail = /email|mail|message/i.test(query);
  const wantsCalendar = /calendar|event|meeting|schedule/i.test(query);
  const wantsTunes = /music|song|listen|tune|track|playing/i.test(query);
  const wantsTasks = /task|todo|to-do|remind/i.test(query);
  
  // Build type filter
  const types: string[] = [];
  if (wantsThoughts) types.push('thought.voice');
  if (wantsScrawls) types.push('scrawl.text');
  if (wantsEmail) types.push('email.received', 'email.sent');
  if (wantsCalendar) types.push('calendar.past', 'calendar.upcoming');
  if (wantsTunes) types.push('tunes.track', 'tunes.context');
  
  // If no specific type, search all
  if (types.length === 0) {
    types.push(
      'thought.voice', 'scrawl.text',
      'email.received', 'email.sent',
      'calendar.past', 'calendar.upcoming',
      'tunes.track', 'tunes.context'
    );
  }
  
  // Extract keywords for content search
  const stopWords = new Set(['what', 'is', 'are', 'the', 'my', 'i', 'have', 'has', 'been', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'with']);
  const keywords = queryLower
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 5);
  
  // Build SQL query
  const typeplaceholders = types.map(() => '?').join(',');
  let sql = `
    SELECT id, type, ts, title, content, meta
    FROM items
    WHERE user_id = ?
    AND type IN (${typeplaceholders})
    AND json_extract(status, '$.deleted') = false
  `;
  const params: (string | number)[] = [userId, ...types];
  
  // Add keyword search if we have keywords
  if (keywords.length > 0) {
    const keywordConditions = keywords.map(() => 
      "(LOWER(title) LIKE ? OR LOWER(content) LIKE ?)"
    ).join(' OR ');
    sql += ` AND (${keywordConditions})`;
    for (const kw of keywords) {
      params.push(`%${kw}%`, `%${kw}%`);
    }
  }
  
  // Order by recency and limit
  sql += ' ORDER BY ts DESC LIMIT 10';
  
  const result = await db.prepare(sql)
    .bind(...params)
    .all<{
      id: string;
      type: string;
      ts: string;
      title: string | null;
      content: string | null;
      meta: string;
    }>();
  
  return (result.results || []).map((row) => ({
    id: row.id,
    type: row.type,
    ts: row.ts,
    title: row.title,
    content: row.content,
    meta: JSON.parse(row.meta),
  }));
}

// Helper: Generate answer using AI
async function generateAnswer(
  query: string,
  items: RetrievedItem[],
  apiKey: string
): Promise<{ answer: string; sources: AskSource[]; followups: string[] }> {
  // TODO: Implement actual AI call
  // For now, return a placeholder response based on retrieved items
  
  if (items.length === 0) {
    return {
      answer: "I couldn't find any relevant items in your recent activity. Try being more specific or check if you have data in the channels you're asking about.",
      sources: [],
      followups: [
        "What have I captured recently?",
        "Show me my latest emails",
        "What's on my calendar?",
      ],
    };
  }
  
  // Build a simple response based on items
  const itemSummaries = items.slice(0, 5).map((item) => {
    const typeLabel = item.type.split('.')[0];
    const preview = item.content?.slice(0, 100) || item.title || 'No content';
    return `- ${typeLabel}: ${preview}`;
  }).join('\n');
  
  const sources: AskSource[] = items.slice(0, 5).map((item) => ({
    itemId: item.id,
    type: item.type,
    ts: item.ts,
    reason: 'Matched query keywords',
  }));
  
  return {
    answer: `Based on your recent activity, I found ${items.length} relevant items:\n\n${itemSummaries}\n\nWould you like more details about any of these?`,
    sources,
    followups: [
      "Tell me more about the first one",
      "Are there any tasks I should follow up on?",
      "Summarize my recent thoughts",
    ],
  };
}
