export interface Env {
  // D1 Database
  DB: D1Database;
  // KV Namespace
  KV: KVNamespace;
  // R2 Bucket (optional)
  R2?: R2Bucket;
  // Workers AI
  AI: Ai;
  // Queues (optional)
  SYNC_QUEUE?: Queue<SyncMessage>;
  ENRICH_QUEUE?: Queue<EnrichMessage>;
  
  // Environment variables
  ENVIRONMENT: string;
  APP_URL: string;
  API_URL: string;
  
  // Secrets
  TOKEN_ENC_KEY: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  GEMINI_API_KEY: string;
}

export interface Variables {
  user: SessionUser;
  sessionId: string;
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  plan: string;
  timeZone: string;
  locale: string;
}

export interface Session {
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface SyncMessage {
  userId: string;
  provider: 'google' | 'spotify';
  scope?: 'gmail' | 'calendar' | 'recently_played';
}

export interface EnrichMessage {
  itemId: string;
  userId: string;
}
