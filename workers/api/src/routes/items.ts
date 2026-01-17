import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { createItemRequestSchema, updateItemRequestSchema } from '@r3cent/shared';
import { ItemType, SourceProvider } from '@r3cent/shared';

export const itemsRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// POST /api/items - Create a new item (thought or scrawl)
itemsRoutes.post('/', async (c) => {
  const user = c.get('user');
  
  const body = await c.req.json();
  const parsed = createItemRequestSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    }, 400);
  }
  
  const data = parsed.data;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  
  let meta: Record<string, unknown> = {};
  let title: string | null = null;
  
  if (data.type === 'thought.voice') {
    meta = {
      duration: data.duration,
      confidence: data.confidence,
      device: data.device,
    };
    // Derive title from first ~40 chars of content
    title = data.content.slice(0, 40) + (data.content.length > 40 ? '...' : '');
  } else if (data.type === 'scrawl.text') {
    meta = {
      charCount: data.content.length,
    };
    title = data.content.slice(0, 40) + (data.content.length > 40 ? '...' : '');
  }
  
  const status = JSON.stringify({
    pinned: false,
    ignored: false,
    deleted: false,
    tasked: false,
  });
  
  await c.env.DB.prepare(`
    INSERT INTO items (id, user_id, type, source_provider, source_id, ts, title, content, meta, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      id,
      user.id,
      data.type,
      SourceProvider.LOCAL,
      null,
      now,
      title,
      data.content,
      JSON.stringify(meta),
      status,
      now,
      now
    )
    .run();
  
  // TODO: Enqueue enrichment task if queue is available
  // c.env.ENRICH_QUEUE?.send({ itemId: id, userId: user.id });
  
  return c.json({ id, createdAt: now }, 201);
});

// GET /api/items/:id - Get a single item
itemsRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('id');
  
  const item = await c.env.DB.prepare(`
    SELECT id, type, source_provider, source_id, ts, title, content, meta, digest, status, created_at, updated_at
    FROM items
    WHERE id = ? AND user_id = ?
  `)
    .bind(itemId, user.id)
    .first<{
      id: string;
      type: string;
      source_provider: string;
      source_id: string | null;
      ts: string;
      title: string | null;
      content: string | null;
      meta: string;
      digest: string | null;
      status: string;
      created_at: string;
      updated_at: string;
    }>();
  
  if (!item) {
    return c.json({ error: 'Item not found', code: 'NOT_FOUND' }, 404);
  }
  
  return c.json({
    ...item,
    meta: JSON.parse(item.meta),
    status: JSON.parse(item.status),
  });
});

// PATCH /api/items/:id - Update item status (pin/ignore/delete/task)
itemsRoutes.patch('/:id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('id');
  
  const body = await c.req.json();
  const parsed = updateItemRequestSchema.safeParse(body);
  
  if (!parsed.success) {
    return c.json({
      error: 'Invalid request',
      code: 'VALIDATION_ERROR',
      details: parsed.error.flatten(),
    }, 400);
  }
  
  // Fetch current item
  const item = await c.env.DB.prepare(
    'SELECT id, status FROM items WHERE id = ? AND user_id = ?'
  )
    .bind(itemId, user.id)
    .first<{ id: string; status: string }>();
  
  if (!item) {
    return c.json({ error: 'Item not found', code: 'NOT_FOUND' }, 404);
  }
  
  // Merge status updates
  const currentStatus = JSON.parse(item.status);
  const updates = parsed.data;
  
  const newStatus = {
    pinned: updates.pinned ?? currentStatus.pinned,
    ignored: updates.ignored ?? currentStatus.ignored,
    deleted: updates.deleted ?? currentStatus.deleted,
    tasked: updates.tasked ?? currentStatus.tasked,
  };
  
  // If marking as tasked, create an action
  if (updates.tasked && !currentStatus.tasked) {
    const actionId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    // Get item details for action payload
    const fullItem = await c.env.DB.prepare(
      'SELECT title, content FROM items WHERE id = ?'
    )
      .bind(itemId)
      .first<{ title: string | null; content: string | null }>();
    
    await c.env.DB.prepare(`
      INSERT INTO actions (id, user_id, source_item_id, kind, payload, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        actionId,
        user.id,
        itemId,
        'task',
        JSON.stringify({ text: fullItem?.title || fullItem?.content?.slice(0, 100) || 'Task' }),
        'open',
        now,
        now
      )
      .run();
  }
  
  // Update item
  await c.env.DB.prepare(
    'UPDATE items SET status = ?, updated_at = ? WHERE id = ?'
  )
    .bind(JSON.stringify(newStatus), new Date().toISOString(), itemId)
    .run();
  
  return c.json({ id: itemId, status: newStatus });
});

// DELETE /api/items/:id - Hard delete an item
itemsRoutes.delete('/:id', async (c) => {
  const user = c.get('user');
  const itemId = c.req.param('id');
  
  // Verify ownership and delete
  const result = await c.env.DB.prepare(
    'DELETE FROM items WHERE id = ? AND user_id = ?'
  )
    .bind(itemId, user.id)
    .run();
  
  if (!result.meta.changes) {
    return c.json({ error: 'Item not found', code: 'NOT_FOUND' }, 404);
  }
  
  return c.json({ deleted: true });
});

// GET /api/items - List items with filters
itemsRoutes.get('/', async (c) => {
  const user = c.get('user');
  
  // Parse query params
  const type = c.req.query('type');
  const channel = c.req.query('channel');
  const limit = Math.min(parseInt(c.req.query('limit') || '15'), 50);
  const offset = parseInt(c.req.query('offset') || '0');
  const pinned = c.req.query('pinned');
  
  // Build type filter based on channel
  let types: string[] = [];
  if (type) {
    types = [type];
  } else if (channel) {
    switch (channel) {
      case 'thoughts':
        types = [ItemType.THOUGHT_VOICE];
        break;
      case 'scrawls':
        types = [ItemType.SCRAWL_TEXT];
        break;
      case 'email':
        types = [ItemType.EMAIL_RECEIVED, ItemType.EMAIL_SENT];
        break;
      case 'calendar':
        types = [ItemType.CALENDAR_PAST, ItemType.CALENDAR_UPCOMING];
        break;
      case 'tunes':
        types = [ItemType.TUNES_TRACK, ItemType.TUNES_CONTEXT];
        break;
    }
  }
  
  // Build query
  let sql = `
    SELECT id, type, ts, title, content, digest, status, meta
    FROM items
    WHERE user_id = ? AND json_extract(status, '$.deleted') = false
  `;
  const params: (string | number)[] = [user.id];
  
  if (types.length > 0) {
    sql += ` AND type IN (${types.map(() => '?').join(',')})`;
    params.push(...types);
  }
  
  if (pinned === 'true') {
    sql += ` AND json_extract(status, '$.pinned') = true`;
  }
  
  sql += ' ORDER BY ts DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const result = await c.env.DB.prepare(sql)
    .bind(...params)
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
  
  return c.json({
    items: (result.results || []).map((row) => ({
      id: row.id,
      type: row.type,
      ts: row.ts,
      title: row.title,
      content: row.content,
      digest: row.digest,
      status: JSON.parse(row.status),
      meta: JSON.parse(row.meta),
    })),
    hasMore: (result.results?.length || 0) === limit,
  });
});
