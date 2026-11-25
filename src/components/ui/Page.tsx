import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import { IconButton } from './Button';

export function PageHeader({
  title,
  eyebrow,
  action,
  back,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  /** Path to return to; shows a back button. */
  back?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className="flex items-end justify-between gap-3 px-5 pb-4 pt-[calc(var(--sat)+1rem)]">
      <div className="flex min-w-0 items-center gap-1">
        {back && (
          <IconButton label="Voltar" className="-ml-3 text-ink" onClick={() => navigate(back)}>
            <ChevronLeft className="size-6" />
          </IconButton>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-[13px] font-medium text-muted">{eyebrow}</p>}
          <h1 className={cn('truncate font-semibold tracking-tight', back ? 'text-xl' : 'text-[28px] leading-tight')}>{title}</h1>
        </div>
      </div>
      {action}
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3 px-4 pb-6', className)}>{children}</div>;
}

export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && <h2 className="mb-2 px-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-faint">{title}</h2>}
      <div className="divide-y divide-line/60 overflow-hidden rounded-[var(--radius-card)] border border-line/70 bg-surface">{children}</div>
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
      {icon && (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-ink">{icon}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{title}</span>
        {subtitle && <span className="block truncate text-[13px] text-muted">{subtitle}</span>}
      </span>
      {trailing ?? (!disabled && <ChevronRight className="size-5 text-faint" />)}
    </>
  );
  const cls = cn(
    'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors',
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
