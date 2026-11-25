import { Dumbbell, House, LayoutGrid, TrendingUp, UtensilsCrossed, type LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '@/lib/cn';

export const NAV_ITEMS: ReadonlyArray<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/treino', label: 'Treino', icon: Dumbbell },
  { to: '/nutricao', label: 'Nutrição', icon: UtensilsCrossed },
  { to: '/progresso', label: 'Progresso', icon: TrendingUp },
  { to: '/mais', label: 'Mais', icon: LayoutGrid },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/92 pb-safe px-safe backdrop-blur-md"
    >
      <ul className="mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold tracking-wide transition-colors',
                  isActive ? 'text-ink' : 'text-faint active:text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-200',
                      isActive ? 'bg-accent/15 text-accent' : '',
                    )}
                  >
                    <Icon className="size-[22px]" strokeWidth={isActive ? 2.3 : 1.9} />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
