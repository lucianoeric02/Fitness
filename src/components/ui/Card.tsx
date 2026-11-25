import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'default' | 'elevated' | 'accent';

export function Card({ tone = 'default', className, children, ...rest }: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border p-4',
        tone === 'default' && 'border-line/70 bg-surface',
        tone === 'elevated' && 'border-line bg-elevated',
        tone === 'accent' &&
          'border-accent/20 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(163,230,53,0.14),transparent_55%),linear-gradient(180deg,#1f2328,#1a1d21)]',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ icon, children, action }: { icon?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}

/** Large athletic numeric display. */
export function BigNumber({ value, unit, className }: { value: string; unit?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1', className)}>
      <span className="tabular font-display text-4xl font-bold leading-none tracking-tight text-ink">{value}</span>
      {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
    </span>
  );
}
