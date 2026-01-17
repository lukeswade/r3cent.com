import { useState } from 'react';
import type { ItemCard as ItemCardType } from '@r3cent/shared';
import { formatRelativeTime } from '@/lib/time';
import { MicIcon, PenIcon, MailIcon, CalendarIcon, MusicIcon, DocIcon, PinIcon, TaskIcon, IgnoreIcon, ChevronRightIcon } from '@/components/icons';

interface ItemRowProps {
  item: ItemCardType;
  onPin?: () => void;
  onTask?: () => void;
  onIgnore?: () => void;
}

export function ItemRow({ item, onPin, onTask, onIgnore }: ItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const getTypeIcon = () => {
    const type = item.type.split('.')[0];
    switch (type) {
      case 'thought':
        return <MicIcon className="w-4 h-4" />;
      case 'scrawl':
        return <PenIcon className="w-4 h-4" />;
      case 'email':
        return <MailIcon className="w-4 h-4" />;
      case 'calendar':
        return <CalendarIcon className="w-4 h-4" />;
      case 'tunes':
        return <MusicIcon className="w-4 h-4" />;
      default:
        return <DocIcon className="w-4 h-4" />;
    }
  };
  
  const meta = (item.meta || {}) as Record<string, unknown>;
  const typeKey = item.type.split('.')[0];
  const detailLines: string[] = [];
  
  if ('from' in meta && meta.from) {
    detailLines.push(`From: ${meta.from}`);
  }
  if ('to' in meta && Array.isArray(meta.to) && meta.to.length) {
    detailLines.push(`To: ${(meta.to as string[]).join(', ')}`);
  } else if ('to' in meta && typeof meta.to === 'string' && meta.to) {
    detailLines.push(`To: ${meta.to}`);
  }
  if ('location' in meta && meta.location) {
    detailLines.push(`Location: ${meta.location as string}`);
  }
  if ('end' in meta && meta.end) {
    detailLines.push(`Ends: ${new Date(meta.end as string).toLocaleString()}`);
  }
  if ('attendees' in meta && typeof meta.attendees === 'number') {
    detailLines.push(`Attendees: ${meta.attendees}`);
  }
  if ('artist' in meta && meta.artist) {
    detailLines.push(`Artist: ${meta.artist}`);
  }
  if ('album' in meta && meta.album) {
    detailLines.push(`Album: ${meta.album}`);
  }
  if ('contextType' in meta && meta.contextType) {
    detailLines.push(`Context: ${String(meta.contextType)}`);
  }
  
  return (
    <div
      className={`item-row group ${expanded ? 'dark:bg-slate-800/40 bg-slate-100/80 lg:bg-inherit' : ''}`}
      onClick={() => setExpanded((prev) => !prev)}
    >
      <div className="w-8 h-8 rounded-lg bg-slate-800/50 flex items-center justify-center text-slate-400 flex-shrink-0">
        {getTypeIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {item.title && (
            <p className={`text-sm font-medium text-slate-200 ${expanded ? '' : 'truncate'}`}>
              {item.title}
            </p>
          )}
          <ChevronRightIcon className={`w-3.5 h-3.5 mt-0.5 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
        {item.content && (
          <p className={`text-sm text-slate-400 ${expanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
            {item.content}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">
          {typeKey.toUpperCase()} • {formatRelativeTime(item.ts)}
        </p>
        
        {expanded && (
          <div className="mt-2 space-y-1">
            {detailLines.map((line) => (
              <p key={line} className="text-xs text-slate-400">
                {line}
              </p>
            ))}
            {item.digest && (
              <p className="text-xs text-slate-400">
                Summary: {item.digest}
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Quick actions (shown on hover) */}
      <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
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
