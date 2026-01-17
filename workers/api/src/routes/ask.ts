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
              parts: [{ text: body.message }]
            }
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
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
  const queryLower = query.toLowerCase();
  
  // Parse intent from query
  const wantsRecent = /recent|latest|last|new|summarize|summary/i.test(query);
  const wantsThoughts = /thought|voice|said|spoke|capture/i.test(query);
  const wantsScrawls = /scrawl|note|wrote|typed|write/i.test(query);
  const wantsEmail = /email|mail|message|inbox/i.test(query);
  const wantsCalendar = /calendar|event|meeting|schedule|appointment/i.test(query);
  const wantsTunes = /music|song|listen|tune|track|playing|spotify/i.test(query);
  const wantsAll = /everything|all|activity|overview|what.*been/i.test(query);
  
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
  
  // Build SQL query - NOTE: json_extract returns 0/1 for boolean, not true/false
  const typeplaceholders = types.map(() => '?').join(',');
  let sql = `
    SELECT id, type, ts, title, content, meta
    FROM items
    WHERE user_id = ?
    AND type IN (${typeplaceholders})
    AND json_extract(status, '$.deleted') = 0
  `;
  const params: (string | number)[] = [userId, ...types];
  
  // Only do keyword search for specific content queries (not intent-based)
  // Skip keywords for general queries like "summarize my emails"
  const isIntentQuery = wantsRecent || wantsThoughts || wantsScrawls || wantsEmail || wantsCalendar || wantsTunes || wantsAll;
  
  if (!isIntentQuery) {
    // Extract keywords for content search
    const stopWords = new Set(['what', 'is', 'are', 'the', 'my', 'i', 'have', 'has', 'been', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'with', 'about', 'tell', 'me', 'show', 'find', 'get', 'summarize', 'summary', 'recent', 'latest']);
    const keywords = queryLower
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
      .slice(0, 5);
    
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
    type: row.type as ItemType,
    ts: row.ts,
    title: row.title,
    content: row.content,
    meta: JSON.parse(row.meta),
  }));
}

// Helper: Generate answer using Gemini 2.0 Flash
async function generateAnswer(
  apiKey: string,
  query: string,
  items: RetrievedItem[],
  userName: string
): Promise<{ answer: string; sources: AskSource[]; followups: string[] }> {
  // Build sources from items
  const sources: AskSource[] = items.slice(0, 5).map((item) => ({
    itemId: item.id,
    type: item.type,
    ts: item.ts,
    reason: 'Matched query context',
  }));

  // If no items found, return a helpful message
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

  const systemPrompt = `You are r3cent, a helpful personal assistant that helps users understand their recent digital activity. You have access to the user's thoughts, notes, emails, calendar events, and music listening history.

Guidelines:
- Be conversational and friendly, but concise
- Reference specific items from the context when relevant
- Use [1], [2] etc. to cite sources
- If asked about tasks or follow-ups, identify actionable items
- Suggest relevant follow-up questions
- Never make up information not in the context
- Keep responses under 200 words unless more detail is requested`;

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
            maxOutputTokens: 320,
            temperature: 0.7,
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
  const queryLower = query.toLowerCase();
  
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
