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

/**
 * Fixed bottom navigation. `hidden` slides it away while the keyboard is
 * open so a tap aimed at the keyboard can't switch screens mid-form.
 */
export function BottomNavigation({ hidden = false }: { hidden?: boolean }) {
  return (
    <nav
      aria-label="Navegação principal"
      aria-hidden={hidden || undefined}
      inert={hidden}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-bg/92 pb-safe px-safe backdrop-blur-md transition-transform duration-base ease-out-expo',
        hidden && 'translate-y-full',
      )}
    >
      <ul className="mx-auto grid h-nav max-w-app grid-cols-5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-1 text-micro font-semibold tracking-wide transition-colors duration-fast',
                  isActive ? 'text-ink' : 'text-faint active:text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-base',
                      isActive && 'bg-accent/15 text-accent',
                    )}
                  >
                    <Icon className="size-5.5" strokeWidth={isActive ? 2.3 : 1.9} />
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
