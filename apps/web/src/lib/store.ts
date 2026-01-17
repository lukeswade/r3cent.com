import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { NowResponse, MeResponse, ConnectionInfo } from '@r3cent/shared';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

// ─────────────────────────────────────────────────────────────
// Auth Store
// ─────────────────────────────────────────────────────────────
interface AuthState {
  user: MeResponse['user'] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      
      checkAuth: async () => {
        try {
          const res = await fetch(`${API_BASE}/me`, { credentials: 'include' });
          if (res.ok) {
            const data: MeResponse = await res.json();
            set({ user: data.user, isAuthenticated: true, isLoading: false });
          } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
          }
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
      
      logout: async () => {
        try {
          await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch {}
        set({ user: null, isAuthenticated: false });
        window.location.href = '/auth/login';
      },
    }),
    {
      name: 'r3cent-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Initialize auth check on load
useAuthStore.getState().checkAuth();

// ─────────────────────────────────────────────────────────────
// Now Store
// ─────────────────────────────────────────────────────────────
interface NowState {
  data: NowResponse | null;
  isLoading: boolean;
  error: string | null;
  fetchNow: () => Promise<void>;
  refreshChannel: (channel: string) => Promise<void>;
}

export const useNowStore = create<NowState>()((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  
  fetchNow: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/now`, { credentials: 'include' });
      if (res.ok) {
        const data: NowResponse = await res.json();
        set({ data, isLoading: false });
      } else {
        set({ error: 'Failed to fetch', isLoading: false });
      }
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },
  
  refreshChannel: async (channel: string) => {
    try {
      await fetch(`${API_BASE}/now/refresh/${channel}`, {
        method: 'POST',
        credentials: 'include',
      });
      // Refetch after triggering refresh
      await get().fetchNow();
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  },
}));

// ─────────────────────────────────────────────────────────────
// Connections Store
// ─────────────────────────────────────────────────────────────
interface ConnectionsState {
  connections: ConnectionInfo[];
  isLoading: boolean;
  fetchConnections: () => Promise<void>;
  connect: (provider: 'google' | 'spotify') => Promise<void>;
  disconnect: (provider: 'google' | 'spotify') => Promise<void>;
}

export const useConnectionsStore = create<ConnectionsState>()((set, get) => ({
  connections: [],
  isLoading: false,
  
  fetchConnections: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/connections`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        set({ connections: data.connections, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
  
  connect: async (provider) => {
    try {
      const res = await fetch(`${API_BASE}/connections/${provider}/start`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = data.authUrl;
      }
    } catch (err) {
      console.error('Connect failed:', err);
    }
  },
  
  disconnect: async (provider) => {
    try {
      await fetch(`${API_BASE}/connections/${provider}/disconnect`, {
        method: 'POST',
        credentials: 'include',
      });
      await get().fetchConnections();
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  },
}));

// ─────────────────────────────────────────────────────────────
// Capture Store
// ─────────────────────────────────────────────────────────────
interface CaptureState {
  isRecording: boolean;
  transcript: string;
  scrawlText: string;
  setRecording: (recording: boolean) => void;
  setTranscript: (text: string) => void;
  setScrawlText: (text: string) => void;
  saveThought: (content: string, duration: number) => Promise<void>;
  saveScrawl: (content: string) => Promise<void>;
}

export const useCaptureStore = create<CaptureState>()((set) => ({
  isRecording: false,
  transcript: '',
  scrawlText: '',
  
  setRecording: (recording) => set({ isRecording: recording }),
  setTranscript: (text) => set({ transcript: text }),
  setScrawlText: (text) => set({ scrawlText: text }),
  
  saveThought: async (content, duration) => {
    try {
      await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'thought.voice',
          content,
          duration,
        }),
      });
      set({ transcript: '' });
    } catch (err) {
      console.error('Save thought failed:', err);
    }
  },
  
  saveScrawl: async (content) => {
    try {
      await fetch(`${API_BASE}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'scrawl.text',
          content,
        }),
      });
      set({ scrawlText: '' });
    } catch (err) {
      console.error('Save scrawl failed:', err);
    }
  },
}));
