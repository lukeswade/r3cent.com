import { Link } from 'react-router-dom';
import { useAuthStore, useThemeStore } from '@/lib/store';
import { UserIcon, LinkIcon, ShieldIcon, LogoutIcon, ChevronRightIcon, SunIcon, MoonIcon } from '@/components/icons';

export function Settings() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  
  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <header className="py-4 lg:py-6">
        <h1 className="text-2xl lg:text-3xl font-bold">Settings</h1>
      </header>
      
      <div className="max-w-xl">
        {/* User info */}
        <div className="channel-card p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-400 to-brand-600 rounded-2xl flex items-center justify-center text-xl font-bold text-white">
              {user?.displayName?.[0] || user?.email?.[0] || '?'}
            </div>
            <div>
              <p className="font-semibold dark:text-slate-200 text-slate-800">
                {user?.displayName || 'User'}
              </p>
              <p className="text-sm text-slate-400">{user?.email}</p>
            </div>
          </div>
        </div>
        
        {/* Appearance */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-slate-400 mb-2 px-1">Appearance</h2>
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-4 py-3 dark:bg-slate-800/30 dark:hover:bg-slate-800/50 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg dark:bg-slate-800 bg-white flex items-center justify-center text-slate-400 group-hover:text-brand-400 transition-colors">
                {theme === 'dark' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
              </div>
              <span className="dark:text-slate-200 text-slate-700">Theme</span>
            </div>
            <span className="text-sm text-slate-500 capitalize">{theme}</span>
          </button>
        </div>
        
        {/* Settings links */}
        <nav className="space-y-2">
          <SettingsLink to="/settings/profile" icon={<UserIcon className="w-5 h-5" />} label="Profile" />
          <SettingsLink to="/settings/connections" icon={<LinkIcon className="w-5 h-5" />} label="Connections" />
          <SettingsLink to="/settings/privacy" icon={<ShieldIcon className="w-5 h-5" />} label="Privacy" />
        </nav>
        
        {/* Logout */}
        <div className="mt-8 pt-8 border-t dark:border-slate-800 border-slate-200">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-xl transition-colors"
          >
            <LogoutIcon className="w-5 h-5" />
            Sign out
          </button>
        </div>
        
        {/* Version */}
        <p className="mt-8 text-center text-xs text-slate-500">
          r3cent v0.1.0
        </p>
      </div>
    </div>
  );
}

function SettingsLink({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between px-4 py-3 dark:bg-slate-800/30 dark:hover:bg-slate-800/50 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg dark:bg-slate-800 bg-white flex items-center justify-center text-slate-400 group-hover:text-brand-400 transition-colors">
          {icon}
        </div>
        <span className="dark:text-slate-200 text-slate-700">{label}</span>
      </div>
      <ChevronRightIcon className="w-5 h-5 text-slate-500 group-hover:text-slate-400 transition-colors" />
    </Link>
  );
}
