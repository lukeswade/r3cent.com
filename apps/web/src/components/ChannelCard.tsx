import type { ChannelBlock } from '@r3cent/shared';
import { ItemRow } from './ItemRow';
import { formatRelativeTime } from '@/lib/time';

interface ChannelCardProps {
  channel: string;
  icon: string;
  label: string;
  data: ChannelBlock;
  onRefresh?: () => void;
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
  return (
    <div className="channel-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h2 className="font-semibold text-slate-200">{label}</h2>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {data.lastSyncAt && (
            <span>Updated {formatRelativeTime(data.lastSyncAt)}</span>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 hover:bg-slate-700/50 rounded transition-colors"
              title="Refresh"
            >
              <RefreshIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Items */}
      <div className="divide-y divide-slate-800/30">
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
        <div className="px-4 py-2 border-t border-slate-800/30">
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

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
