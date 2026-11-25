import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BaseFieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  suffix?: string;
}

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
}: BaseFieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-caption text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputClass = (error?: string | null) =>
  cn(
    'h-13 w-full rounded-control border bg-elevated px-4 text-base text-ink placeholder:text-faint transition-colors duration-fast focus:outline-none',
    error ? 'border-danger/70 focus:border-danger' : 'border-line focus:border-accent/70',
  );

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & BaseFieldProps;

/** Single-line text input with label, hint and error. */
export function Input({
  label,
  hint,
  error,
  value,
  onChange,
  ...rest
}: InputProps & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={inputClass(error)}
        {...rest}
      />
    </FieldShell>
  );
}

/**
 * Numeric input (NumberInput) that accepts pt-BR decimals ("82,5"). Uses a text input with
 * a numeric keyboard so the comma key is available on Android.
 */
export function NumberInput({
  label,
  hint,
  error,
  suffix,
  value,
  onChange,
  decimal = true,
  ...rest
}: InputProps & { value: string; onChange: (v: string) => void; decimal?: boolean }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={decimal ? 'decimal' : 'numeric'}
          autoComplete="off"
          enterKeyHint="next"
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(decimal ? /[^\d.,]/g : /\D/g, '');
            onChange(v);
          }}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error || hint ? `${id}-msg` : undefined}
          className={cn(inputClass(error), 'tabular text-lg font-semibold', suffix && (suffix.length <= 2 ? 'pl-3 pr-8' : 'pr-14'))}
          {...rest}
        />
        {suffix && (
          <span className={cn('pointer-events-none absolute inset-y-0 flex items-center text-sm font-medium text-muted', suffix.length <= 2 ? 'right-3' : 'right-4')}>
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

export function DateInput({
  label,
  hint,
  error,
  value,
  onChange,
  ...rest
}: InputProps & { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        className={cn(inputClass(error), 'scheme-dark')}
        {...rest}
      />
    </FieldShell>
  );
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-control border border-line bg-elevated p-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'pressable h-11 rounded-xl text-sm font-semibold',
                active ? 'bg-ink text-bg' : 'text-muted active:bg-line',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Multi-line text (notes). */
export function TextArea({
  label,
  hint,
  error,
  value,
  onChange,
  rows = 3,
  maxLength,
}: BaseFieldProps & { value: string; onChange: (v: string) => void; rows?: number; maxLength?: number }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        rows={rows}
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error) || undefined}
        className={cn(inputClass(error), 'h-auto py-3 leading-relaxed')}
      />
    </FieldShell>
  );
}

/** Wrapping single-select chips, for short option lists that don't fit a segmented control. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | undefined;
  onChange: (v: T) => void;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                'pressable min-h-10 rounded-full border px-4 text-sm font-medium',
                active ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line bg-elevated text-muted active:bg-line',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Wrapping multi-select chips. */
export function MultiChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: ReadonlyArray<T>;
  onChange: (v: T[]) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-medium text-muted">{label}</span>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? value.filter((v) => v !== o.value) : [...value, o.value])}
              className={cn(
                'pressable min-h-10 rounded-full border px-4 text-sm font-medium',
                active ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line bg-elevated text-muted active:bg-line',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
