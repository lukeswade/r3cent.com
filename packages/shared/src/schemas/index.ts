import { z } from 'zod';
import { ItemType, SourceProvider, ConnectionProvider, ConnectionStatus, UserPlan, Channel, ActionKind, ActionStatus, AskRole } from '../types/enums';

// ─────────────────────────────────────────────────────────────
// Enums as Zod
// ─────────────────────────────────────────────────────────────
export const itemTypeSchema = z.enum([
  ItemType.THOUGHT_VOICE,
  ItemType.SCRAWL_TEXT,
  ItemType.EMAIL_RECEIVED,
  ItemType.EMAIL_SENT,
  ItemType.CALENDAR_PAST,
  ItemType.CALENDAR_UPCOMING,
  ItemType.TUNES_TRACK,
  ItemType.TUNES_CONTEXT,
]);

export const sourceProviderSchema = z.enum([
  SourceProvider.LOCAL,
  SourceProvider.GOOGLE,
  SourceProvider.SPOTIFY,
]);

export const connectionProviderSchema = z.enum([
  ConnectionProvider.GOOGLE,
  ConnectionProvider.SPOTIFY,
]);

export const connectionStatusSchema = z.enum([
  ConnectionStatus.CONNECTED,
  ConnectionStatus.ERROR,
  ConnectionStatus.REVOKED,
]);

export const userPlanSchema = z.enum([
  UserPlan.FREE,
  UserPlan.PRO,
  UserPlan.POWER,
]);

export const channelSchema = z.enum([
  Channel.THOUGHTS,
  Channel.SCRAWLS,
  Channel.EMAIL,
  Channel.CALENDAR,
  Channel.TUNES,
]);

export const actionKindSchema = z.enum([
  ActionKind.REMINDER,
  ActionKind.TASK,
]);

export const actionStatusSchema = z.enum([
  ActionStatus.OPEN,
  ActionStatus.DONE,
  ActionStatus.DISMISSED,
]);

export const askRoleSchema = z.enum([
  AskRole.USER,
  AskRole.ASSISTANT,
  AskRole.SYSTEM,
]);

// ─────────────────────────────────────────────────────────────
// Item Status
// ─────────────────────────────────────────────────────────────
export const itemStatusSchema = z.object({
  pinned: z.boolean(),
  ignored: z.boolean(),
  deleted: z.boolean(),
  tasked: z.boolean(),
});

// ─────────────────────────────────────────────────────────────
// Item Card (for UI)
// ─────────────────────────────────────────────────────────────
export const itemCardSchema = z.object({
  id: z.string().uuid(),
  type: itemTypeSchema,
  ts: z.string().datetime(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  digest: z.string().nullable(),
  status: itemStatusSchema,
  meta: z.record(z.unknown()),
});

// ─────────────────────────────────────────────────────────────
// Channel Block
// ─────────────────────────────────────────────────────────────
export const channelBlockSchema = z.object({
  items: z.array(itemCardSchema),
  digest: z.string().optional(),
  lastSyncAt: z.string().datetime().optional(),
});

// ─────────────────────────────────────────────────────────────
// Now Response
// ─────────────────────────────────────────────────────────────
export const nowResponseSchema = z.object({
  channels: z.object({
    thoughts: channelBlockSchema,
    scrawls: channelBlockSchema,
    email: channelBlockSchema,
    calendar: channelBlockSchema,
    tunes: channelBlockSchema,
  }),
});

// ─────────────────────────────────────────────────────────────
// Ask
// ─────────────────────────────────────────────────────────────
export const askRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  query: z.string().min(1).max(2000),
});

export const askSourceSchema = z.object({
  itemId: z.string().uuid(),
  type: z.string(),
  ts: z.string().datetime(),
  reason: z.string().optional(),
});

export const askResponseSchema = z.object({
  sessionId: z.string().uuid(),
  answer: z.string(),
  sources: z.array(askSourceSchema),
  followups: z.array(z.string()),
});

// ─────────────────────────────────────────────────────────────
// Capture / Create Item
// ─────────────────────────────────────────────────────────────
export const createThoughtRequestSchema = z.object({
  type: z.literal('thought.voice'),
  content: z.string().min(1),
  duration: z.number().min(0),
  confidence: z.number().min(0).max(1).optional(),
  device: z.string().optional(),
});

export const createScrawlRequestSchema = z.object({
  type: z.literal('scrawl.text'),
  content: z.string().min(1).max(10000),
});

export const createItemRequestSchema = z.discriminatedUnion('type', [
  createThoughtRequestSchema,
  createScrawlRequestSchema,
]);

export const createItemResponseSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
});

export const updateItemRequestSchema = z.object({
  pinned: z.boolean().optional(),
  ignored: z.boolean().optional(),
  deleted: z.boolean().optional(),
  tasked: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────
// Connections
// ─────────────────────────────────────────────────────────────
export const connectionInfoSchema = z.object({
  id: z.string().uuid(),
  provider: connectionProviderSchema,
  status: connectionStatusSchema,
  scopes: z.array(z.string()),
  lastSyncAt: z.string().datetime().nullable(),
  error: z.string().nullable(),
});

export const connectionsResponseSchema = z.object({
  connections: z.array(connectionInfoSchema),
});

export const oauthStartResponseSchema = z.object({
  authUrl: z.string().url(),
});

// ─────────────────────────────────────────────────────────────
// Auth / Me
// ─────────────────────────────────────────────────────────────
export const meResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().nullable(),
    plan: userPlanSchema,
    timeZone: z.string(),
    locale: z.string(),
  }),
});

// ─────────────────────────────────────────────────────────────
// API Error
// ─────────────────────────────────────────────────────────────
export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────
// AI Enrichment Output
// ─────────────────────────────────────────────────────────────
export const aiEnrichmentSchema = z.object({
  title: z.string().optional(),
  tags: z.array(z.string()),
  entities: z.array(z.object({
    type: z.string(),
    value: z.string(),
  })),
  dates: z.array(z.object({
    value: z.string(),
    confidence: z.number(),
  })),
  isTask: z.boolean(),
  taskSuggestion: z.string().optional(),
  priority: z.enum(['low', 'med', 'high']),
  summary: z.string(),
});
