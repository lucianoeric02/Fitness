import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ProgressBar } from './Progress';
import { SectionHeader } from './SectionHeader';

type Tone = 'default' | 'elevated' | 'accent';

const tones: Record<Tone, string> = {
  default: 'border-line/70 bg-surface',
  elevated: 'border-line bg-elevated shadow-raised',
  accent: 'border-accent/20 bg-accent-glow',
};

export function Card({
  tone = 'default',
  interactive = false,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone; interactive?: boolean }) {
  return (
    <div className={cn('rounded-card border p-4', tones[tone], interactive && 'pressable', className)} {...rest}>
      {children}
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

/**
 * Compact metric tile: label, big value, optional progress and footnote.
 * Pass `value={null}` with an `emptyText` to render the no-data state.
 */
export function MetricCard({
  label,
  icon,
  value,
  unit,
  progress,
  footnote,
  emptyText = 'Sem registros ainda.',
  className,
}: {
  label: string;
  icon?: ReactNode;
  value: string | null;
  unit?: string;
  progress?: { ratio: number; color?: string; label: string; over?: boolean };
  footnote?: ReactNode;
  emptyText?: string;
  className?: string;
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <SectionHeader icon={icon} title={label} />
      {value === null ? (
        <p className="text-caption text-muted">{emptyText}</p>
      ) : (
        <>
          <BigNumber value={value} unit={unit} />
          <div className="mt-auto pt-3">
            {progress && <ProgressBar ratio={progress.ratio} color={progress.color} over={progress.over} label={progress.label} />}
            {footnote && <p className={cn('text-xs text-muted', progress && 'mt-2')}>{footnote}</p>}
          </div>
        </>
      )}
    </Card>
  );
}
