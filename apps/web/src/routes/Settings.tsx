import { Link } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';

export function Settings() {
  const { user, logout } = useAuthStore();
  
  return (
    <div className="p-4">
      {/* Header */}
      <header className="py-4">
        <h1 className="text-2xl font-bold">Settings</h1>
      </header>
      
      {/* User info */}
      <div className="bg-slate-800/50 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center text-xl font-bold">
            {user?.displayName?.[0] || user?.email?.[0] || '?'}
          </div>
          <div>
            <p className="font-medium text-slate-200">
              {user?.displayName || 'User'}
            </p>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>
      </div>
      
      {/* Settings links */}
      <nav className="space-y-2">
        <SettingsLink to="/settings/profile" icon="👤" label="Profile" />
        <SettingsLink to="/settings/connections" icon="🔗" label="Connections" />
        <SettingsLink to="/settings/privacy" icon="🔒" label="Privacy" />
      </nav>
      
      {/* Logout */}
      <div className="mt-8 pt-8 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full text-left px-4 py-3 text-red-400 hover:bg-red-900/20 rounded-xl transition-colors"
        >
          Sign out
        </button>
      </div>
      
      {/* Version */}
      <p className="mt-8 text-center text-xs text-slate-600">
        Recent v0.1.0
      </p>
    </div>
  );
}

function SettingsLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <span className="text-slate-200">{label}</span>
      </div>
      <ChevronIcon className="w-5 h-5 text-slate-500" />
    </Link>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
