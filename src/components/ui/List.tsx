import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-2 text-caption font-semibold uppercase tracking-label text-faint">{title}</h2>}
      <div className="divide-y divide-line/60 overflow-hidden rounded-card border border-line/70 bg-surface">{children}</div>
    </section>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  to,
  onClick,
  disabled,
  trailing,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
  trailing?: ReactNode;
}) {
  const content = (
    <>
      {icon && <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-ink">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium">{title}</span>
        {subtitle && <span className="block truncate text-caption text-muted">{subtitle}</span>}
      </span>
      {trailing ?? (!disabled && <ChevronRight className="size-5 text-faint" />)}
    </>
  );
  const cls = cn(
    'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-fast',
    disabled ? 'opacity-50' : 'active:bg-elevated',
  );
  if (to && !disabled) {
    return (
      <Link to={to} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {content}
    </button>
  );
}
