import { useState } from 'react';
import type { ChannelBlock } from '@r3cent/shared';
import { ItemRow } from './ItemRow';
import { formatRelativeTime } from '@/lib/time';
import { RefreshIcon } from './icons';

interface ChannelCardProps {
  channel: string;
  icon: React.ReactNode;
  label: string;
  data: ChannelBlock;
  onRefresh?: () => Promise<void> | void;
  onViewAll?: () => void;
  onItemAction?: (itemId: string, action: 'pin' | 'task' | 'ignore') => void;
}

export function ChannelCard({
  channel,
  icon,
  label,
  data,
  onRefresh,
  onViewAll,
  onItemAction,
}: ChannelCardProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasContent = data.items.length > 0;
  
  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };
  
  return (
    <div className="channel-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-800/50 border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            hasContent 
              ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30' 
              : 'dark:bg-slate-800/80 bg-slate-100 text-slate-500'
          }`}>
            {icon}
          </div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-200">{label}</h2>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {data.lastSyncAt && (
            <span className="hidden sm:inline">Updated {formatRelativeTime(data.lastSyncAt)}</span>
          )}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-1.5 dark:hover:bg-slate-700/50 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>
      
      {/* Items */}
      <div className="divide-y dark:divide-slate-800/30 divide-slate-200">
        {data.items.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-500 text-sm">
            No items yet
          </div>
        ) : (
          data.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onPin={() => onItemAction?.(item.id, 'pin')}
              onTask={() => onItemAction?.(item.id, 'task')}
              onIgnore={() => onItemAction?.(item.id, 'ignore')}
            />
          ))
        )}
      </div>
      
      {/* Digest */}
      {data.digest && (
        <div className="digest-bar">
          <span className="text-slate-500">AI:</span> {data.digest}
        </div>
      )}
      
      {/* Footer */}
      {onViewAll && data.items.length > 0 && (
        <div className="px-4 py-2 border-t dark:border-slate-800/30 border-slate-200">
          <button
            onClick={onViewAll}
            className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            View all →
          </button>
        </div>
      )}
    </div>
  );
}
