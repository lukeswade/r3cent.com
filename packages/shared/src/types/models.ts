import type { ItemType, SourceProvider, UserPlan, ConnectionProvider, ConnectionStatus, Channel, ActionKind, ActionStatus, AskRole } from './enums';

// ─────────────────────────────────────────────────────────────
// User
// ─────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  plan: UserPlan;
  timeZone: string;
  locale: string;
}

// ─────────────────────────────────────────────────────────────
// Connection (OAuth)
// ─────────────────────────────────────────────────────────────
export interface Connection {
  id: string;
  userId: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastSyncAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

// Public connection info (no tokens)
export interface ConnectionInfo {
  id: string;
  provider: ConnectionProvider;
  status: ConnectionStatus;
  scopes: string[];
  lastSyncAt: string | null;
  error: string | null;
}

// ─────────────────────────────────────────────────────────────
// Item (unified model)
// ─────────────────────────────────────────────────────────────
export interface ItemStatus {
  pinned: boolean;
  ignored: boolean;
  deleted: boolean;
  tasked: boolean;
}

// Type-specific metadata
export interface EmailMeta {
  from: string;
  to: string[];
  threadId: string;
  labels: string[];
  cc?: string[];
  bcc?: string[];
}

export interface CalendarMeta {
  eventId: string;
  location?: string;
  meetLink?: string;
  attendeesCount: number;
  isAllDay: boolean;
  recurring: boolean;
}

export interface TunesTrackMeta {
  artist: string;
  album: string;
  durationMs: number;
  uri: string;
  playedAt: string;
  contextUri?: string;
  contextType?: string;
}

export interface TunesContextMeta {
  contextUri: string;
  contextType: 'playlist' | 'album' | 'artist';
  name: string;
  imageUrl?: string;
}

export interface ThoughtMeta {
  duration: number;
  confidence?: number;
  device?: string;
  audioRef?: string; // R2 key if stored
}

export interface ScrawlMeta {
  charCount: number;
}

export type ItemMeta = 
  | EmailMeta 
  | CalendarMeta 
  | TunesTrackMeta 
  | TunesContextMeta 
  | ThoughtMeta 
  | ScrawlMeta 
  | Record<string, unknown>;

export interface Item {
  id: string;
  userId: string;
  type: ItemType;
  sourceProvider: SourceProvider;
  sourceId: string | null;
  ts: string;
  title: string | null;
  content: string | null;
  meta: ItemMeta;
  digest: string | null;
  status: ItemStatus;
  createdAt: string;
  updatedAt: string;
}

// Compact item for UI
export interface ItemCard {
  id: string;
  type: ItemType;
  ts: string;
  title: string | null;
  content: string | null;
  digest: string | null;
  status: ItemStatus;
  meta: ItemMeta;
}

// ─────────────────────────────────────────────────────────────
// Channel Digest
// ─────────────────────────────────────────────────────────────
export interface ChannelDigest {
  id: string;
  userId: string;
  channel: Channel;
  scope: {
    count: number;
    window?: string;
  };
  digestText: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Ask (chat)
// ─────────────────────────────────────────────────────────────
export interface AskSession {
  id: string;
  userId: string;
  createdAt: string;
  title: string | null;
}

export interface AskSource {
  itemId: string;
  type: ItemType;
  ts: string;
  reason?: string;
}

export interface AskMessage {
  id: string;
  sessionId: string;
  role: AskRole;
  text: string;
  sources: AskSource[];
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────
// Actions (tasks/reminders)
// ─────────────────────────────────────────────────────────────
export interface ActionPayload {
  text: string;
  dueAt?: string;
}

export interface Action {
  id: string;
  userId: string;
  sourceItemId: string | null;
  kind: ActionKind;
  payload: ActionPayload;
  status: ActionStatus;
  createdAt: string;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────
// AI Enrichment output
// ─────────────────────────────────────────────────────────────
export interface AIEnrichment {
  title?: string;
  tags: string[];
  entities: Array<{ type: string; value: string }>;
  dates: Array<{ value: string; confidence: number }>;
  isTask: boolean;
  taskSuggestion?: string;
  priority: 'low' | 'med' | 'high';
  summary: string;
}
