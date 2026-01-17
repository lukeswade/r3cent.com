import { Link } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';

export function Profile() {
  const { user } = useAuthStore();
  
  return (
    <div className="p-4 lg:p-8">
      <div className="page-shell max-w-3xl">
        {/* Header */}
        <header className="page-header">
          <Link to="/settings" className="text-slate-400 hover:text-slate-200 text-sm mb-2 block">
            ← Settings
          </Link>
          <h1 className="text-2xl lg:text-3xl font-bold">Profile</h1>
          <p className="text-slate-400 text-sm">Review your account details.</p>
        </header>
      
        {/* Profile info */}
        <div className="space-y-4">
          <div className="section-card p-4">
            <label className="text-sm text-slate-400 block mb-1">Email</label>
            <p className="text-slate-800 dark:text-slate-200">{user?.email}</p>
          </div>
        
          <div className="section-card p-4">
            <label className="text-sm text-slate-400 block mb-1">Display Name</label>
            <p className="text-slate-800 dark:text-slate-200">{user?.displayName || 'Not set'}</p>
          </div>
        
          <div className="section-card p-4">
            <label className="text-sm text-slate-400 block mb-1">Plan</label>
            <p className="text-slate-800 dark:text-slate-200 capitalize">{user?.plan || 'Free'}</p>
          </div>
        
          <div className="section-card p-4">
            <label className="text-sm text-slate-400 block mb-1">Timezone</label>
            <p className="text-slate-800 dark:text-slate-200">{user?.timeZone || 'UTC'}</p>
          </div>
        
          <div className="section-card p-4">
            <label className="text-sm text-slate-400 block mb-1">Language</label>
            <p className="text-slate-800 dark:text-slate-200">{user?.locale || 'en-US'}</p>
          </div>
        </div>
      
        <p className="mt-6 text-sm text-slate-500 text-center">
          Profile editing coming soon
        </p>
      </div>
    </div>
  );
}
