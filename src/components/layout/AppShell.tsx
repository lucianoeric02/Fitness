import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useEditingFocus } from '@/hooks/useEditingFocus';
import { BottomNavigation } from './BottomNavigation';

export function AppShell() {
  const { pathname } = useLocation();
  const editing = useEditingFocus();

  // Each screen starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="mx-auto min-h-full max-w-app px-safe">
      <main className="pb-nav-safe">
        {/* Keyed by route so each screen gets a short entrance transition. */}
        <div key={pathname} className="animate-page-in">
          <Outlet />
        </div>
      </main>
      <BottomNavigation hidden={editing} />
    </div>
  );
}
