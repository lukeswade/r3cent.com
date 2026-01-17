// Item types enum matching the spec
export const ItemType = {
  THOUGHT_VOICE: 'thought.voice',
  SCRAWL_TEXT: 'scrawl.text',
  EMAIL_RECEIVED: 'email.received',
  EMAIL_SENT: 'email.sent',
  CALENDAR_PAST: 'calendar.past',
  CALENDAR_UPCOMING: 'calendar.upcoming',
  TUNES_TRACK: 'tunes.track',
  TUNES_CONTEXT: 'tunes.context',
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

// Source providers
export const SourceProvider = {
  LOCAL: 'local',
  GOOGLE: 'google',
  SPOTIFY: 'spotify',
} as const;

export type SourceProvider = (typeof SourceProvider)[keyof typeof SourceProvider];

// Connection providers
export const ConnectionProvider = {
  GOOGLE: 'google',
  SPOTIFY: 'spotify',
} as const;

export type ConnectionProvider = (typeof ConnectionProvider)[keyof typeof ConnectionProvider];

// Connection status
export const ConnectionStatus = {
  CONNECTED: 'connected',
  ERROR: 'error',
  REVOKED: 'revoked',
} as const;

export type ConnectionStatus = (typeof ConnectionStatus)[keyof typeof ConnectionStatus];

// User plans
export const UserPlan = {
  FREE: 'free',
  PRO: 'pro',
  POWER: 'power',
} as const;

export type UserPlan = (typeof UserPlan)[keyof typeof UserPlan];

// Channels for the Now screen
export const Channel = {
  THOUGHTS: 'thoughts',
  SCRAWLS: 'scrawls',
  EMAIL: 'email',
  CALENDAR: 'calendar',
  TUNES: 'tunes',
} as const;

export type Channel = (typeof Channel)[keyof typeof Channel];

// Action kinds
export const ActionKind = {
  REMINDER: 'reminder',
  TASK: 'task',
} as const;

export type ActionKind = (typeof ActionKind)[keyof typeof ActionKind];

// Action status
export const ActionStatus = {
  OPEN: 'open',
  DONE: 'done',
  DISMISSED: 'dismissed',
} as const;

export type ActionStatus = (typeof ActionStatus)[keyof typeof ActionStatus];

// Ask message roles
export const AskRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;

export type AskRole = (typeof AskRole)[keyof typeof AskRole];
