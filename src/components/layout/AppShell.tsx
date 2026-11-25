import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { BottomNav } from './BottomNav';

export function AppShell() {
  const { pathname } = useLocation();

  // Each screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="mx-auto min-h-full max-w-lg px-safe">
      <main className="pb-[calc(var(--nav-h)+var(--sab)+1rem)]">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
