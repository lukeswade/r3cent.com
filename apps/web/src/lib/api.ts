const API_BASE = import.meta.env.VITE_API_URL || 'https://api.r3cent.com/api';

interface FetchOptions extends RequestInit {
  json?: unknown;
}

export async function api<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { json, ...fetchOptions } = options;
  
  const config: RequestInit = {
    ...fetchOptions,
    credentials: 'include',
    headers: {
      ...fetchOptions.headers,
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json ? JSON.stringify(json) : fetchOptions.body,
  };
  
  const res = await fetch(`${API_BASE}${path}`, config);
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${res.status}`);
  }
  
  return res.json();
}

// API methods
export const apiClient = {
  // Now
  getNow: () => api('/now'),
  refreshChannel: (channel: string) => api(`/now/refresh/${channel}`, { method: 'POST' }),
  
  // Items
  createItem: (data: { type: string; content: string; duration?: number }) =>
    api('/items', { method: 'POST', json: data }),
  updateItem: (id: string, data: { pinned?: boolean; ignored?: boolean; deleted?: boolean; tasked?: boolean }) =>
    api(`/items/${id}`, { method: 'PATCH', json: data }),
  deleteItem: (id: string) => api(`/items/${id}`, { method: 'DELETE' }),
  
  // Ask
  ask: (query: string, sessionId?: string) =>
    api('/ask', { method: 'POST', json: { query, sessionId } }),
  
  // Connections
  getConnections: () => api('/connections'),
  startConnection: (provider: 'google' | 'spotify') =>
    api(`/connections/${provider}/start`, { method: 'POST' }),
  disconnectProvider: (provider: 'google' | 'spotify') =>
    api(`/connections/${provider}/disconnect`, { method: 'POST' }),
  deleteProviderData: (provider: 'google' | 'spotify') =>
    api(`/connections/${provider}/delete-data`, { method: 'POST' }),
  
  // Auth
  getMe: () => api('/me'),
  logout: () => api('/auth/logout', { method: 'POST' }),
};
