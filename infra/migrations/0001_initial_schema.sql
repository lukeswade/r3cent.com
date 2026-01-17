-- R3cent D1 Schema
-- Migration: 0001_initial_schema.sql

-- ═══════════════════════════════════════════════════════════════
-- Users
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'power')),
  time_zone TEXT NOT NULL DEFAULT 'UTC',
  locale TEXT NOT NULL DEFAULT 'en-US'
);

CREATE INDEX idx_users_email ON users(email);

-- ═══════════════════════════════════════════════════════════════
-- Connections (OAuth tokens, encrypted)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'spotify')),
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'revoked')),
  scopes TEXT NOT NULL DEFAULT '[]', -- JSON array
  -- Encrypted token storage
  access_token_encrypted TEXT,
  access_token_iv TEXT,
  access_token_tag TEXT,
  refresh_token_encrypted TEXT,
  refresh_token_iv TEXT,
  refresh_token_tag TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_sync_at TEXT,
  error_code TEXT,
  error_message TEXT,
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_connections_user_id ON connections(user_id);
CREATE INDEX idx_connections_provider ON connections(provider);

-- ═══════════════════════════════════════════════════════════════
-- Items (unified stream data)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'thought.voice',
    'scrawl.text',
    'email.received',
    'email.sent',
    'calendar.past',
    'calendar.upcoming',
    'tunes.track',
    'tunes.context'
  )),
  source_provider TEXT NOT NULL CHECK (source_provider IN ('local', 'google', 'spotify')),
  source_id TEXT, -- External ID (gmail message id, calendar event id, spotify uri)
  ts TEXT NOT NULL, -- Item occurrence timestamp
  title TEXT,
  content TEXT,
  meta TEXT NOT NULL DEFAULT '{}', -- JSON object
  digest TEXT, -- Short AI-generated summary
  status TEXT NOT NULL DEFAULT '{"pinned":false,"ignored":false,"deleted":false,"tasked":false}', -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  -- Unique constraint for external items (prevents duplicates)
  UNIQUE(user_id, source_provider, source_id)
);

CREATE INDEX idx_items_user_id ON items(user_id);
CREATE INDEX idx_items_type ON items(type);
CREATE INDEX idx_items_ts ON items(ts DESC);
CREATE INDEX idx_items_user_type_ts ON items(user_id, type, ts DESC);
CREATE INDEX idx_items_source ON items(user_id, source_provider, source_id);

-- ═══════════════════════════════════════════════════════════════
-- Item Embeddings (for vector search, optional)
-- Note: For production, consider Cloudflare Vectorize instead
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS item_embeddings (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  embedding BLOB, -- Store as binary or use external vector store
  model TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(item_id)
);

CREATE INDEX idx_item_embeddings_item_id ON item_embeddings(item_id);
CREATE INDEX idx_item_embeddings_user_id ON item_embeddings(user_id);

-- ═══════════════════════════════════════════════════════════════
-- Channel Digests (AI-generated summaries per channel)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS channel_digests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('thoughts', 'scrawls', 'email', 'calendar', 'tunes')),
  scope TEXT NOT NULL DEFAULT '{"count":3}', -- JSON: count, window
  digest_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_channel_digests_user_channel ON channel_digests(user_id, channel);
CREATE INDEX idx_channel_digests_created ON channel_digests(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- Ask Sessions (conversation threads)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ask_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ask_sessions_user_id ON ask_sessions(user_id);
CREATE INDEX idx_ask_sessions_created ON ask_sessions(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- Ask Messages (individual messages in sessions)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ask_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ask_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  text TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]', -- JSON array of {item_id, type, ts}
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_ask_messages_session_id ON ask_messages(session_id);
CREATE INDEX idx_ask_messages_created ON ask_messages(created_at);

-- ═══════════════════════════════════════════════════════════════
-- Actions (tasks/reminders)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reminder', 'task')),
  payload TEXT NOT NULL DEFAULT '{}', -- JSON: text, due_at, etc.
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'dismissed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_actions_user_id ON actions(user_id);
CREATE INDEX idx_actions_status ON actions(user_id, status);
CREATE INDEX idx_actions_source_item ON actions(source_item_id);

-- ═══════════════════════════════════════════════════════════════
-- Sync Jobs (tracking sync state for background processing)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'spotify')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at TEXT,
  completed_at TEXT,
  items_synced INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sync_jobs_user_provider ON sync_jobs(user_id, provider);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);
