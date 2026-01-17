import { useState } from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { CaptureSheet } from './CaptureSheet';
import { HomeIcon, ChatIcon, MicIcon, SettingsIcon, ChevronLeftIcon, ChevronRightIcon } from './icons';

export function Layout() {
  const location = useLocation();
  const isCapturePage = location.pathname === '/capture';
  const isAskPage = location.pathname === '/ask';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar - hidden on mobile */}
      <aside className={`hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 dark:bg-slate-900/50 bg-white/80 border-r dark:border-slate-800/50 border-slate-200 transition-all duration-300 ${sidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b dark:border-slate-800/50 border-slate-200">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">r3</span>
          </div>
          {!sidebarCollapsed && (
            <span className="font-semibold text-lg bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
              r3cent
            </span>
          )}
        </div>
        
        {/* Desktop nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <SidebarLink to="/" icon={<HomeIcon className="w-5 h-5" />} label="Now" collapsed={sidebarCollapsed} />
          <SidebarLink to="/ask" icon={<ChatIcon className="w-5 h-5" />} label="Ask" collapsed={sidebarCollapsed} />
          <SidebarLink to="/capture" icon={<MicIcon className="w-5 h-5" />} label="Capture" collapsed={sidebarCollapsed} />
        </nav>
        
        {/* Settings at bottom */}
        <div className="px-3 py-4 border-t dark:border-slate-800/50 border-slate-200">
          <SidebarLink to="/settings" icon={<SettingsIcon className="w-5 h-5" />} label="Settings" collapsed={sidebarCollapsed} />
        </div>
        
        {/* Collapse button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-300 rounded-full flex items-center justify-center dark:text-slate-400 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 dark:hover:bg-slate-700 hover:bg-slate-100 transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRightIcon className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          )}
        </button>
      </aside>
      
      {/* Main content */}
      <main className={`flex-1 pb-20 lg:pb-0 transition-all duration-300 ${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <div className="max-w-6xl mx-auto w-full pt-safe pt-3 lg:pt-0">
          <Outlet />
        </div>
      </main>
      
      {/* Mobile capture button - hide on capture and ask pages */}
      {!isCapturePage && !isAskPage && <CaptureSheet />}
      
      {/* Mobile bottom nav */}
      <div className="lg:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

function SidebarLink({ to, icon, label, collapsed }: { to: string; icon: React.ReactNode; label: string; collapsed: boolean }) {
  return (
    <NavLink
      to={to}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-brand-600/20 text-brand-400'
            : 'dark:text-slate-400 text-slate-500 dark:hover:text-slate-200 hover:text-slate-700 dark:hover:bg-slate-800/50 hover:bg-slate-100'
        }`
      }
    >
      {icon}
      {!collapsed && label}
    </NavLink>
  );
}
