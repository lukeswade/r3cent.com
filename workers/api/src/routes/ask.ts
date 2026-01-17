import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { askRequestSchema, ItemType } from '@r3cent/shared';
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
  
  // Retrieve relevant items (rule-based + keyword matching)
  const relevantItems = await retrieveRelevantItems(c.env.DB, user.id, query);
  
  // Generate answer using Gemini
  const { answer, sources, followups } = await generateAnswer(
    c.env.GEMINI_API_KEY,
    query,
    relevantItems,
    user.displayName || 'there'
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

// POST /api/ask/chat - General chat with Gemini (no context retrieval)
askRoutes.post('/chat', async (c) => {
  const body = await c.req.json() as { message: string };
  
  if (!body.message?.trim()) {
    return c.json({ error: 'Message is required' }, 400);
  }

  const chatPrompt = `You are r3cent, a helpful assistant. Keep responses concise and actionable. Ask a clarifying question if needed.`;
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${c.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${chatPrompt}\n\nUser: ${body.message}` }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.5,
            topP: 0.9,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      return c.json({ error: 'AI request failed' }, 500);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      "I'm having trouble generating a response right now.";
    
    return c.json({ answer });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json({ error: 'Failed to generate response' }, 500);
  }
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
  type: ItemType;
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
  const normalizedQuery = normalizeQuery(query);
  const keywords = extractKeywords(normalizedQuery);
  
  // Parse intent from query
  const wantsRecent = /recent|latest|last|new|summarize|summary/i.test(normalizedQuery);
  const wantsThoughts = /thought|voice|said|spoke|capture/i.test(normalizedQuery);
  const wantsScrawls = /scrawl|note|wrote|typed|write/i.test(normalizedQuery);
  const wantsEmail = /email|mail|message|inbox/i.test(normalizedQuery);
  const wantsCalendar = /calendar|event|meeting|schedule|appointment/i.test(normalizedQuery);
  const wantsTunes = /music|song|listen|tune|track|playing|spotify/i.test(normalizedQuery);
  const wantsAll = /everything|all|activity|overview|what.*been/i.test(normalizedQuery);
  
  // Build type filter
  const types: ItemType[] = [];
  if (wantsThoughts) types.push(ItemType.THOUGHT_VOICE);
  if (wantsScrawls) types.push(ItemType.SCRAWL_TEXT);
  if (wantsEmail) types.push(ItemType.EMAIL_RECEIVED, ItemType.EMAIL_SENT);
  if (wantsCalendar) types.push(ItemType.CALENDAR_PAST, ItemType.CALENDAR_UPCOMING);
  if (wantsTunes) types.push(ItemType.TUNES_TRACK, ItemType.TUNES_CONTEXT);
  
  // If no specific type or wants all, search everything
  if (types.length === 0 || wantsAll) {
    types.length = 0; // Clear if wantsAll
    types.push(
      ItemType.THOUGHT_VOICE, ItemType.SCRAWL_TEXT,
      ItemType.EMAIL_RECEIVED, ItemType.EMAIL_SENT,
      ItemType.CALENDAR_PAST, ItemType.CALENDAR_UPCOMING,
      ItemType.TUNES_TRACK, ItemType.TUNES_CONTEXT
    );
  }
  
  const typeplaceholders = types.map(() => '?').join(',');
  const sql = `
    SELECT id, type, ts, title, content, meta
    FROM items
    WHERE user_id = ?
    AND type IN (${typeplaceholders})
    AND json_extract(status, '$.deleted') = 0
    ORDER BY ts DESC
    LIMIT ?
  `;
  const fetchLimit = wantsRecent || wantsAll ? 60 : 40;
  const params: (string | number)[] = [userId, ...types, fetchLimit];
  
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
  
  const items = (result.results || []).map((row) => ({
    id: row.id,
    type: row.type as ItemType,
    ts: row.ts,
    title: row.title,
    content: row.content,
    meta: JSON.parse(row.meta),
  }));

  const scoredItems = items.map((item) => ({
    item,
    score: scoreItem(item, {
      keywords,
      wantsThoughts,
      wantsScrawls,
      wantsEmail,
      wantsCalendar,
      wantsTunes,
      wantsRecent,
    }),
  }));

  scoredItems.sort((a, b) => b.score - a.score);

  const limit = keywords.length > 0 ? 12 : 10;
  return scoredItems.slice(0, limit).map((entry) => entry.item);
}

// Helper: Generate answer using Gemini 2.0 Flash
async function generateAnswer(
  apiKey: string,
  query: string,
  items: RetrievedItem[],
  userName: string
): Promise<{ answer: string; sources: AskSource[]; followups: string[] }> {
  // Build sources from items
  const keywords = extractKeywords(normalizeQuery(query));
  const sources: AskSource[] = items.slice(0, 5).map((item) => ({
    itemId: item.id,
    type: item.type,
    ts: item.ts,
    reason: buildSourceReason(item, keywords, query),
  }));

  // If no items found, return a helpful message
  if (items.length === 0) {
    return {
      answer: "I couldn't find relevant items yet. Try being more specific, or connect email, calendar, or Spotify to give me more context.",
      sources: [],
      followups: [
        "What have I captured recently?",
        "Show me my latest emails",
        "What's on my calendar this week?",
      ],
    };
  }

  // Build context from items
  const contextItems = items.slice(0, 6).map((item, i) => {
    const typeLabel = item.type.replace('.', ' ').replace('_', ' ');
    const date = new Date(item.ts).toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    const content = item.content?.slice(0, 500) || item.title || 'No content';
    const meta = item.meta;
    
    let details = '';
    if (item.type.includes('email')) {
      details = meta.from ? `From: ${meta.from}` : '';
    } else if (item.type.includes('calendar')) {
      details = meta.location ? `Location: ${meta.location}` : '';
    } else if (item.type.includes('tunes')) {
      details = meta.artist ? `Artist: ${meta.artist}` : '';
    }
    
    return `[${i + 1}] ${typeLabel} (${date})${details ? ` - ${details}` : ''}\n${content}`;
  }).join('\n\n');

  const systemPrompt = `You are r3cent, a proactive personal assistant for a user's recent digital activity (thoughts, notes, emails, calendar events, and music).

Guidelines:
- Be crisp and helpful. Prioritize clarity over verbosity.
- Only use information present in the context. Never invent details.
- Cite sources using [1], [2], etc. for any specific claims.
- If the question implies a task or follow-up, surface action items.
- If key info is missing, say what's missing and ask a brief clarifying question.
- Output format:
  Answer: 2-5 sentences.
  Key items: 2-4 bullets with citations.
  Action items: bullets or "None."
  Open questions: 1-2 bullets if needed.`;

  const userPrompt = `User: ${userName}
Query: ${query}

Recent Activity Context:
${contextItems}

Please answer the user's question based on the above context.`;

  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  try {
    // Use Gemini 3.0 Flash - fast and capable
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort('timeout'), 12000);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 360,
            temperature: 0.4,
            topP: 0.9,
          },
        }),
        signal: controller.signal,
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || 
      "I'm having trouble generating a response right now. Please try again.";
    
    // Generate follow-up suggestions based on context
    const followups = generateFollowups(query, items);

    return { answer, sources, followups };
  } catch (error) {
    console.error('AI generation error:', error);
    
    // Fallback to a simple response
    const itemSummaries = items.slice(0, 5).map((item, i) => {
      const typeLabel = item.type.split('.')[0];
      const preview = item.content?.slice(0, 100) || item.title || 'No content';
      return `[${i + 1}] ${typeLabel}: ${preview}`;
    }).join('\n');
    
    return {
      answer: `Here's what I found related to your query:\n\n${itemSummaries}\n\nWould you like more details about any of these?`,
      sources,
      followups: [
        "Tell me more about the first one",
        "Summarize all of these",
        "What should I follow up on?",
      ],
    };
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

// Helper: Generate contextual follow-up suggestions
function generateFollowups(query: string, items: RetrievedItem[]): string[] {
  const followups: string[] = [];
  
  // Type-based suggestions
  const types = new Set(items.map(i => i.type.split('.')[0]));
  
  if (types.has('email')) {
    followups.push("Which emails need a response?");
  }
  if (types.has('calendar')) {
    followups.push("What's my schedule for tomorrow?");
  }
  if (types.has('thought') || types.has('scrawl')) {
    followups.push("Summarize my recent thoughts");
  }
  if (types.has('tunes')) {
    followups.push("What music have I been listening to lately?");
  }
  
  // General fallbacks
  if (followups.length === 0) {
    followups.push(
      "What should I focus on today?",
      "Any tasks I should follow up on?",
      "What happened this week?"
    );
  }
  
  return followups.slice(0, 3);
}

function normalizeQuery(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'what',
    'is',
    'are',
    'the',
    'my',
    'i',
    'have',
    'has',
    'been',
    'a',
    'an',
    'to',
    'for',
    'of',
    'in',
    'on',
    'with',
    'about',
    'tell',
    'me',
    'show',
    'find',
    'get',
    'summarize',
    'summary',
    'recent',
    'latest',
    'last',
    'new',
    'this',
    'that',
  ]);

  return query
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .slice(0, 6);
}

function scoreItem(
  item: RetrievedItem,
  context: {
    keywords: string[];
    wantsThoughts: boolean;
    wantsScrawls: boolean;
    wantsEmail: boolean;
    wantsCalendar: boolean;
    wantsTunes: boolean;
    wantsRecent: boolean;
  }
): number {
  const now = Date.now();
  const ts = new Date(item.ts).getTime();
  const ageDays = Math.max(0, (now - ts) / (1000 * 60 * 60 * 24));
  const recencyScore = Math.max(0, 1 - ageDays / 30);

  const text = `${item.title ?? ''} ${item.content ?? ''}`.toLowerCase();
  const keywordHits = context.keywords.reduce((total, keyword) => (
    text.includes(keyword) ? total + 1 : total
  ), 0);

  const type = item.type.toLowerCase();
  const typeBonus =
    (context.wantsThoughts && type.includes('thought')) ||
    (context.wantsScrawls && type.includes('scrawl')) ||
    (context.wantsEmail && type.includes('email')) ||
    (context.wantsCalendar && type.includes('calendar')) ||
    (context.wantsTunes && type.includes('tunes'))
      ? 1.2
      : 0;

  const recentBonus = context.wantsRecent ? 0.4 : 0;

  return keywordHits * 2 + typeBonus + recencyScore + recentBonus;
}

function buildSourceReason(item: RetrievedItem, keywords: string[], query: string): string {
  const lowered = `${item.title ?? ''} ${item.content ?? ''}`.toLowerCase();
  const matchedKeyword = keywords.find((keyword) => lowered.includes(keyword));
  if (matchedKeyword) {
    return `Matches keyword "${matchedKeyword}"`;
  }

  if (/email|mail|message|inbox/i.test(query) && item.type.includes('email')) {
    return 'Matches email intent';
  }
  if (/calendar|event|meeting|schedule|appointment/i.test(query) && item.type.includes('calendar')) {
    return 'Matches calendar intent';
  }
  if (/thought|voice|said|spoke|capture/i.test(query) && item.type.includes('thought')) {
    return 'Matches thoughts intent';
  }
  if (/scrawl|note|wrote|typed|write/i.test(query) && item.type.includes('scrawl')) {
    return 'Matches notes intent';
  }
  if (/music|song|listen|tune|track|playing|spotify/i.test(query) && item.type.includes('tunes')) {
    return 'Matches music intent';
  }

  return 'Recent activity';
}
