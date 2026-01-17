import { Link } from 'react-router-dom';
import { useState } from 'react';
import { apiClient } from '@/lib/api';

export function Privacy() {
  const [isDeleting, setIsDeleting] = useState(false);
  
  const handleDeleteProviderData = async (provider: 'google' | 'spotify') => {
    if (!confirm(`Are you sure you want to delete all ${provider} data? This cannot be undone.`)) {
      return;
    }
    
    try {
      await apiClient.deleteProviderData(provider);
      alert(`${provider} data deleted successfully`);
    } catch (err) {
      alert('Failed to delete data');
    }
  };
  
  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone.')) {
      return;
    }
    
    if (!confirm('This is your final warning. Click OK to permanently delete your account.')) {
      return;
    }
    
    setIsDeleting(true);
    // TODO: Implement account deletion endpoint
    alert('Account deletion not yet implemented');
    setIsDeleting(false);
  };
  
  return (
    <div className="p-4">
      {/* Header */}
      <header className="py-4">
        <Link to="/settings" className="text-slate-400 hover:text-slate-200 text-sm mb-2 block">
          ← Settings
        </Link>
        <h1 className="text-2xl font-bold">Privacy</h1>
        <p className="text-slate-400 text-sm">Manage your data and privacy settings</p>
      </header>
      
      {/* Data storage info */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">How we handle your data</h2>
        <div className="bg-slate-800/30 rounded-xl p-4 space-y-3 text-sm text-slate-400">
          <p>
            <strong className="text-slate-200">Gmail:</strong> We only store email headers (from, to, subject, date) and the first few lines snippet. We never store full email bodies.
          </p>
          <p>
            <strong className="text-slate-200">Calendar:</strong> We store event titles, times, locations, and meeting links. Event descriptions are truncated.
          </p>
          <p>
            <strong className="text-slate-200">Spotify:</strong> We store track metadata only (song name, artist, album, play time).
          </p>
          <p>
            <strong className="text-slate-200">Voice:</strong> Transcripts are stored. Audio is not stored by default.
          </p>
          <p>
            <strong className="text-slate-200">Encryption:</strong> All OAuth tokens are encrypted at rest using AES-256-GCM.
          </p>
        </div>
      </section>
      
      {/* Delete provider data */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Delete provider data</h2>
        <p className="text-sm text-slate-400 mb-4">
          Remove all synced data from a specific provider while keeping your account.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => handleDeleteProviderData('google')}
            className="w-full text-left px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl transition-colors text-slate-300"
          >
            Delete all Google data (Gmail + Calendar)
          </button>
          <button
            onClick={() => handleDeleteProviderData('spotify')}
            className="w-full text-left px-4 py-3 bg-slate-800/30 hover:bg-slate-800/50 rounded-xl transition-colors text-slate-300"
          >
            Delete all Spotify data
          </button>
        </div>
      </section>
      
      {/* Export data */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Export your data</h2>
        <p className="text-sm text-slate-400 mb-4">
          Download a copy of all your data in JSON format.
        </p>
        <button className="btn-secondary" disabled>
          Export data (coming soon)
        </button>
      </section>
      
      {/* Delete account */}
      <section className="pt-8 border-t border-slate-800">
        <h2 className="text-lg font-semibold mb-4 text-red-400">Danger zone</h2>
        <p className="text-sm text-slate-400 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={handleDeleteAccount}
          disabled={isDeleting}
          className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-xl transition-colors disabled:opacity-50"
        >
          {isDeleting ? 'Deleting...' : 'Delete my account'}
        </button>
      </section>
    </div>
  );
}
