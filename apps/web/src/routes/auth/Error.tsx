import { useSearchParams, Link } from 'react-router-dom';

export function AuthError() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error') || 'unknown_error';
  
  const errorMessages: Record<string, string> = {
    access_denied: 'You denied access to your account. Please try again if you want to connect.',
    invalid_state: 'The authentication session expired. Please try again.',
    token_exchange_failed: 'Failed to authenticate with the provider. Please try again.',
    userinfo_failed: 'Failed to get your account information. Please try again.',
    internal_error: 'Something went wrong on our end. Please try again later.',
    session_expired: 'Your session has expired. Please log in again.',
    not_logged_in: 'You need to be logged in to connect accounts.',
    unknown_error: 'An unknown error occurred. Please try again.',
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <ErrorIcon className="w-8 h-8 text-red-400" />
        </div>
        
        <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
        <p className="text-slate-400 mb-6">
          {errorMessages[error] || errorMessages.unknown_error}
        </p>
        
        <div className="flex flex-col gap-3">
          <Link to="/auth/login" className="btn-primary">
            Try again
          </Link>
          <Link to="/" className="btn-secondary">
            Go home
          </Link>
        </div>
        
        {error !== 'unknown_error' && (
          <p className="mt-6 text-xs text-slate-600">
            Error code: {error}
          </p>
        )}
      </div>
    </div>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}
