import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { clamp } from '@/lib/numbers';

export function ProgressRing({
  ratio,
  size = 152,
  stroke = 12,
  color = 'var(--color-accent)',
  over = false,
  children,
  label,
}: {
  ratio: number;
  size?: number;
  stroke?: number;
  color?: string;
  over?: boolean;
  children?: ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamp(ratio, 0, 1));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={label}
      >
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-elevated)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--color-warning)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-slow ease-out-expo"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({
  ratio,
  color = 'var(--color-accent)',
  over = false,
  className,
  label,
}: {
  ratio: number;
  color?: string;
  over?: boolean;
  className?: string;
  label: string;
}) {
  const pct = Math.round(clamp(ratio, 0, 1) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-elevated', className)}
    >
      <div
        className="h-full rounded-full transition-all duration-slow ease-out-expo"
        style={{ width: `${pct}%`, background: over ? 'var(--color-warning)' : color }}
      />
    </div>
  );
}
