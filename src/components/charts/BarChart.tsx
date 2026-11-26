import { cn } from '@/lib/cn';

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Accessible description, e.g. "Semana de 17 nov: 3 treinos". */
  title: string;
  muted?: boolean;
}

/** Simple vertical bars with an optional dashed reference line. */
export function BarChart({ bars, reference, color = 'var(--color-accent)', label, formatValue }: { bars: Bar[]; reference?: number | null; color?: string; label: string; formatValue?: (v: number) => string }) {
  const max = Math.max(reference ?? 0, ...bars.map((b) => b.value), 1) / 0.9;
  const step = Math.max(1, Math.ceil(bars.length / 7));
  return (
    <div role="list" aria-label={label}>
      <div className="relative h-28">
        {reference != null && reference > 0 && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/60" style={{ bottom: `${(reference / max) * 100}%` }} aria-hidden />}
        <div className="flex h-full items-end gap-1">
          {bars.map((b) => (
            <div key={b.key} role="listitem" aria-label={b.title} title={b.title} className="flex h-full flex-1 flex-col items-center justify-end">
              {formatValue && b.value > 0 && <span className="tabular mb-0.5 text-micro text-muted">{formatValue(b.value)}</span>}
              <span className={cn('w-full rounded-t-md transition-all duration-base', b.muted && 'opacity-40')} style={{ height: `${Math.max((b.value / max) * 100, b.value > 0 ? 3 : 1)}%`, background: b.value > 0 ? color : 'var(--color-line)' }} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex gap-1" aria-hidden>
        {bars.map((b, i) => (
          <span key={b.key} className="flex-1 overflow-visible whitespace-nowrap text-center text-micro text-faint">
            {/* With many bars, label every k-th bar (always the last) so labels never collide. */}
            {i % step === 0 || i === bars.length - 1 ? b.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Segmented range picker (horizontal, scrollable). */
export function RangePicker<T extends string>({ value, options, onChange, label }: { value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('pressable min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium', o.value === value ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line bg-elevated text-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
