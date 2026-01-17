import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/lib/store';

// This component handles the OAuth callback when using token exchange
// With cookie-based auth on shared domain, this is just a fallback
export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // With cookie-based auth, just check auth and redirect
    async function handleCallback() {
      try {
        await checkAuth();
        navigate('/', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        setError('Authentication failed');
      }
    }

    handleCallback();
  }, [navigate, checkAuth]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2 text-red-400">Authentication Failed</h1>
          <p className="text-slate-400 mb-4">{error}</p>
          <a href="/auth/login" className="btn-primary">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400">Signing you in...</p>
      </div>
    </div>
  );
}
