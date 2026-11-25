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
      <label htmlFor={id} className="text-[13px] font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-[13px] text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const inputClass = (error?: string | null) =>
  cn(
    'h-13 w-full rounded-2xl border bg-elevated px-4 text-base text-ink placeholder:text-faint transition-colors focus:outline-none',
    error ? 'border-danger/70 focus:border-danger' : 'border-line focus:border-accent/70',
  );

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & BaseFieldProps;

export function TextField({
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
 * Numeric input that accepts pt-BR decimals ("82,5"). Uses a text input with
 * a numeric keyboard so the comma key is available on Android.
 */
export function NumberField({
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
          className={cn(inputClass(error), 'tabular text-lg font-semibold', suffix && 'pr-14')}
          {...rest}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted">
            {suffix}
          </span>
        )}
      </div>
    </FieldShell>
  );
}

export function DateField({
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
        className={cn(inputClass(error), '[color-scheme:dark]')}
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
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-line bg-elevated p-1">
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
                'h-11 rounded-xl text-sm font-semibold transition-colors',
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
