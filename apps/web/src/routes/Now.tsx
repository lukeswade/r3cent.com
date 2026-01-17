import { useEffect } from 'react';
import { useNowStore } from '@/lib/store';
import { ChannelCard } from '@/components/ChannelCard';
import { apiClient } from '@/lib/api';

const CHANNELS: Array<{ key: 'thoughts' | 'scrawls' | 'email' | 'calendar' | 'tunes'; icon: string; label: string; refreshable?: boolean }> = [
  { key: 'thoughts', icon: '🎙', label: 'Thoughts' },
  { key: 'scrawls', icon: '✍️', label: 'Scrawls' },
  { key: 'email', icon: '📨', label: 'Email', refreshable: true },
  { key: 'calendar', icon: '📅', label: 'Calendar', refreshable: true },
  { key: 'tunes', icon: '🎧', label: 'Tunes', refreshable: true },
];

export function Now() {
  const { data, isLoading, error, fetchNow, refreshChannel } = useNowStore();
  
  useEffect(() => {
    fetchNow();
  }, [fetchNow]);
  
  const handleItemAction = async (itemId: string, action: 'pin' | 'task' | 'ignore') => {
    try {
      await apiClient.updateItem(itemId, {
        pinned: action === 'pin' ? true : undefined,
        tasked: action === 'task' ? true : undefined,
        ignored: action === 'ignore' ? true : undefined,
      });
      fetchNow(); // Refresh to show updated state
    } catch (err) {
      console.error('Item action failed:', err);
    }
  };
  
  if (isLoading && !data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={fetchNow} className="btn-secondary">
          Try again
        </button>
      </div>
    );
  }
  
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <header className="py-4">
        <h1 className="text-2xl font-bold">Now</h1>
        <p className="text-slate-400 text-sm">Your recent activity at a glance</p>
      </header>
      
      {/* Channel cards */}
      {data && CHANNELS.map(({ key, icon, label, refreshable }) => (
        <ChannelCard
          key={key}
          channel={key}
          icon={icon}
          label={label}
          data={data.channels[key]}
          onRefresh={refreshable ? () => refreshChannel(key) : undefined}
          onItemAction={handleItemAction}
        />
      ))}
      
      {/* Empty state */}
      {data && Object.values(data.channels).every((c) => c.items.length === 0) && (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">
            No recent activity yet. Start capturing thoughts or connect your accounts!
          </p>
          <a href="/settings/connections" className="btn-primary">
            Connect accounts
          </a>
        </div>
      )}
    </div>
  );
}
