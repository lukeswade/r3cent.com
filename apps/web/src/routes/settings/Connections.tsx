import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useConnectionsStore } from '@/lib/store';

export function Connections() {
  const { connections, isLoading, fetchConnections, connect, disconnect } = useConnectionsStore();
  
  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);
  
  const googleConnection = connections.find((c) => c.provider === 'google');
  const spotifyConnection = connections.find((c) => c.provider === 'spotify');
  
  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <header className="py-4 lg:py-6">
        <Link to="/settings" className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 text-sm mb-3 group">
          <ArrowLeftIcon className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Settings
        </Link>
        <h1 className="text-2xl lg:text-3xl font-bold">Connections</h1>
        <p className="text-slate-400 text-sm lg:text-base">Connect your accounts to sync data</p>
      </header>
      
      <div className="max-w-xl">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Google */}
            <ConnectionCard
              provider="google"
              name="Google"
              description="Gmail & Calendar"
              icon={<GoogleIcon />}
              connection={googleConnection}
              onConnect={() => connect('google')}
              onDisconnect={() => disconnect('google')}
            />
            
            {/* Spotify */}
            <ConnectionCard
              provider="spotify"
              name="Spotify"
              description="Recently played tracks"
              icon={<SpotifyIcon />}
              connection={spotifyConnection}
              onConnect={() => connect('spotify')}
              onDisconnect={() => disconnect('spotify')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

interface ConnectionCardProps {
  provider: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connection?: {
    status: string;
    scopes: string[];
    lastSyncAt: string | null;
    error: string | null;
  };
  onConnect: () => void;
  onDisconnect: () => void;
}

function ConnectionCard({
  provider,
  name,
  description,
  icon,
  connection,
  onConnect,
  onDisconnect,
}: ConnectionCardProps) {
  const isConnected = connection?.status === 'connected';
  const hasError = connection?.status === 'error';
  
  return (
    <div className="channel-card p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-200">{name}</h3>
            <p className="text-sm text-slate-400">{description}</p>
          </div>
        </div>
        
        {isConnected ? (
          <span className="text-xs font-medium bg-green-900/30 text-green-400 px-2.5 py-1 rounded-full">
            Connected
          </span>
        ) : hasError ? (
          <span className="text-xs font-medium bg-red-900/30 text-red-400 px-2.5 py-1 rounded-full">
            Error
          </span>
        ) : null}
      </div>
      
      {isConnected && (
        <div className="mb-4 text-sm text-slate-500 space-y-1">
          {connection.lastSyncAt && (
            <p>Last synced: {new Date(connection.lastSyncAt).toLocaleString()}</p>
          )}
          {connection.scopes.length > 0 && (
            <p>
              Scopes: {connection.scopes.length} granted
            </p>
          )}
        </div>
      )}
      
      {hasError && connection?.error && (
        <p className="mb-4 text-sm text-red-400">{connection.error}</p>
      )}
      
      <div className="flex gap-2">
        {isConnected ? (
          <button
            onClick={onDisconnect}
            className="btn-secondary text-red-400 hover:bg-red-900/20"
          >
            Disconnect
          </button>
        ) : (
          <button onClick={onConnect} className="btn-primary">
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function SpotifyIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#1DB954">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}
