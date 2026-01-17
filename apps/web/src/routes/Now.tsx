import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNowStore } from '@/lib/store';
import { ChannelCard } from '@/components/ChannelCard';
import { apiClient } from '@/lib/api';
import { MicIcon, PenIcon, MailIcon, CalendarIcon, MusicIcon, SparklesIcon } from '@/components/icons';

const CHANNELS: Array<{ key: 'thoughts' | 'scrawls' | 'email' | 'calendar' | 'tunes'; icon: React.ReactNode; label: string; refreshable?: boolean }> = [
  { key: 'thoughts', icon: <MicIcon className="w-5 h-5" />, label: 'Thoughts' },
  { key: 'scrawls', icon: <PenIcon className="w-5 h-5" />, label: 'Scrawls' },
  { key: 'email', icon: <MailIcon className="w-5 h-5" />, label: 'Email', refreshable: true },
  { key: 'calendar', icon: <CalendarIcon className="w-5 h-5" />, label: 'Calendar', refreshable: true },
  { key: 'tunes', icon: <MusicIcon className="w-5 h-5" />, label: 'Tunes', refreshable: true },
];

export function Now() {
  const { data, isLoading, error, fetchNow, refreshChannel } = useNowStore();
  
  useEffect(() => {
    fetchNow();
  }, [fetchNow]);

  const lastUpdated = data
    ? [
        data.channels.email.lastSyncAt,
        data.channels.calendar.lastSyncAt,
        data.channels.tunes.lastSyncAt,
        ...Object.values(data.channels).flatMap((channel) =>
          channel.items.map((item) => item.ts)
        ),
      ]
        .filter(Boolean)
        .map((ts) => new Date(ts as string).getTime())
        .reduce((max, ts) => Math.max(max, ts), 0)
    : 0;
  
  const handleItemAction = async (itemId: string, action: 'pin' | 'task' | 'ignore') => {
    try {
      await apiClient.updateItem(itemId, {
        pinned: action === 'pin' ? true : undefined,
        tasked: action === 'task' ? true : undefined,
        ignored: action === 'ignore' ? true : undefined,
      });
      fetchNow();
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
    <div className="p-4 lg:p-8">
      <div className="page-shell">
      {/* Header */}
      <header className="page-header lg:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold">Now</h1>
          <p className="text-slate-400 text-sm lg:text-base">Your recent activity at a glance</p>
        </div>
        <div className="hidden lg:flex items-center gap-4 text-slate-500 text-sm">
          {lastUpdated > 0 && (
            <span>Last updated: {new Date(lastUpdated).toLocaleString()}</span>
          )}
          <Link to="/ask" className="btn-secondary px-3 py-1.5 text-xs">
            Ask AI
          </Link>
        </div>
      </header>
      
      {/* Channel grid - responsive layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
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
      </div>
      
      {/* Empty state */}
      {data && Object.values(data.channels).every((c) => c.items.length === 0) && (
        <div className="text-center py-12 lg:py-20">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/50 flex items-center justify-center">
            <SparklesIcon className="w-8 h-8 text-brand-400" />
          </div>
          <h3 className="text-lg font-medium mb-2">No recent activity yet</h3>
          <p className="text-slate-400 mb-6 max-w-sm mx-auto">
            Start capturing thoughts or connect your accounts to see your activity here.
          </p>
          <a href="/settings/connections" className="btn-primary">
            Connect accounts
          </a>
        </div>
      )}
      </div>
    </div>
  );
}
