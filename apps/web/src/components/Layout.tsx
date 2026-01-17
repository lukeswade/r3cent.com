import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { CaptureSheet } from './CaptureSheet';

export function Layout() {
  const location = useLocation();
  const isCapturePage = location.pathname === '/capture';
  
  return (
    <div className="min-h-screen pb-20">
      <main className="max-w-2xl mx-auto">
        <Outlet />
      </main>
      
      {/* Floating capture button (except on capture page) */}
      {!isCapturePage && <CaptureSheet />}
      
      <BottomNav />
    </div>
  );
}
