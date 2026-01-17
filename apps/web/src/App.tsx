import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';
import { Layout } from './components/Layout';
import { Now } from './routes/Now';
import { Ask } from './routes/Ask';
import { Capture } from './routes/Capture';
import { Settings } from './routes/Settings';
import { Connections } from './routes/settings/Connections';
import { Privacy } from './routes/settings/Privacy';
import { Profile } from './routes/settings/Profile';
import { AuthError } from './routes/auth/Error';
import { AuthCallback } from './routes/auth/Callback';
import { Login } from './routes/auth/Login';
import { Register } from './routes/auth/Register';

export function App() {
  const { isAuthenticated, isLoading } = useAuthStore();
  
  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/auth/error" element={<AuthError />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/auth/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
      <Route path="/auth/register" element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
      
      {/* Protected routes */}
      <Route element={<Layout />}>
        <Route path="/" element={isAuthenticated ? <Now /> : <Navigate to="/auth/login" />} />
        <Route path="/ask" element={isAuthenticated ? <Ask /> : <Navigate to="/auth/login" />} />
        <Route path="/capture" element={isAuthenticated ? <Capture /> : <Navigate to="/auth/login" />} />
        <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/auth/login" />} />
        <Route path="/settings/profile" element={isAuthenticated ? <Profile /> : <Navigate to="/auth/login" />} />
        <Route path="/settings/connections" element={isAuthenticated ? <Connections /> : <Navigate to="/auth/login" />} />
        <Route path="/settings/privacy" element={isAuthenticated ? <Privacy /> : <Navigate to="/auth/login" />} />
      </Route>
      
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
