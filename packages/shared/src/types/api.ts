import type { ItemCard, ConnectionInfo } from './models';

// ─────────────────────────────────────────────────────────────
// Now API
// ─────────────────────────────────────────────────────────────
export interface ChannelBlock {
  items: ItemCard[];
  digest?: string;
  lastSyncAt?: string;
}

export interface NowResponse {
  channels: {
    thoughts: ChannelBlock;
    scrawls: ChannelBlock;
    email: ChannelBlock;
    calendar: ChannelBlock;
    tunes: ChannelBlock;
  };
}

// ─────────────────────────────────────────────────────────────
// Ask API
// ─────────────────────────────────────────────────────────────
export interface AskRequest {
  sessionId?: string;
  query: string;
}

export interface AskResponse {
  sessionId: string;
  answer: string;
  sources: Array<{
    itemId: string;
    type: string;
    ts: string;
    reason?: string;
  }>;
  followups: string[];
}

// ─────────────────────────────────────────────────────────────
// Capture API
// ─────────────────────────────────────────────────────────────
export interface CreateThoughtRequest {
  type: 'thought.voice';
  content: string;
  duration: number;
  confidence?: number;
  device?: string;
}

export interface CreateScrawlRequest {
  type: 'scrawl.text';
  content: string;
}

export type CreateItemRequest = CreateThoughtRequest | CreateScrawlRequest;

export interface CreateItemResponse {
  id: string;
  createdAt: string;
}

export interface UpdateItemRequest {
  pinned?: boolean;
  ignored?: boolean;
  deleted?: boolean;
  tasked?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Connections API
// ─────────────────────────────────────────────────────────────
export interface ConnectionsResponse {
  connections: ConnectionInfo[];
}

export interface OAuthStartResponse {
  authUrl: string;
}

// ─────────────────────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────────────────────
export interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string | null;
    plan: string;
    timeZone: string;
    locale: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Error response
// ─────────────────────────────────────────────────────────────
export interface APIError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
