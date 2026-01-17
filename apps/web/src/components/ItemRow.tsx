import type { ItemCard as ItemCardType } from '@r3cent/shared';
import { formatRelativeTime } from '@/lib/time';

interface ItemRowProps {
  item: ItemCardType;
  onPin?: () => void;
  onTask?: () => void;
  onIgnore?: () => void;
}

export function ItemRow({ item, onPin, onTask, onIgnore }: ItemRowProps) {
  const getTypeIcon = () => {
    const type = item.type.split('.')[0];
    switch (type) {
      case 'thought':
        return '🎙';
      case 'scrawl':
        return '✍️';
      case 'email':
        return '📨';
      case 'calendar':
        return '📅';
      case 'tunes':
        return '🎧';
      default:
        return '📝';
    }
  };
  
  return (
    <div className="item-row group">
      <span className="text-xl flex-shrink-0">{getTypeIcon()}</span>
      
      <div className="flex-1 min-w-0">
        {item.title && (
          <p className="text-sm font-medium text-slate-200 truncate">
            {item.title}
          </p>
        )}
        {item.content && (
          <p className="text-sm text-slate-400 line-clamp-2">
            {item.content}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          {formatRelativeTime(item.ts)}
        </p>
      </div>
      
      {/* Quick actions (shown on hover) */}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onPin && (
          <button
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className={`p-1.5 rounded-lg transition-colors ${
              item.status.pinned
                ? 'bg-brand-600/20 text-brand-400'
                : 'hover:bg-slate-700/50 text-slate-500 hover:text-slate-300'
            }`}
            title={item.status.pinned ? 'Unpin' : 'Pin'}
          >
            <PinIcon className="w-4 h-4" />
          </button>
        )}
        {onTask && (
          <button
            onClick={(e) => { e.stopPropagation(); onTask(); }}
            className={`p-1.5 rounded-lg transition-colors ${
              item.status.tasked
                ? 'bg-green-600/20 text-green-400'
                : 'hover:bg-slate-700/50 text-slate-500 hover:text-slate-300'
            }`}
            title="Make task"
          >
            <TaskIcon className="w-4 h-4" />
          </button>
        )}
        {onIgnore && (
          <button
            onClick={(e) => { e.stopPropagation(); onIgnore(); }}
            className="p-1.5 rounded-lg hover:bg-slate-700/50 text-slate-500 hover:text-slate-300 transition-colors"
            title="Ignore"
          >
            <IgnoreIcon className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function TaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IgnoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
