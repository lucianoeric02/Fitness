import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink shadow-accent active:bg-accent-strong disabled:bg-elevated disabled:text-faint disabled:shadow-none',
  secondary: 'border border-line bg-elevated text-ink active:bg-line disabled:text-faint',
  ghost: 'bg-transparent text-muted active:bg-elevated disabled:text-faint',
  danger: 'border border-danger/30 bg-danger/12 text-danger active:bg-danger/20 disabled:opacity-50',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 gap-1.5 rounded-xl px-3.5 text-sm',
  md: 'h-12 gap-2 rounded-control px-5 text-body',
  lg: 'h-14 gap-2 rounded-control px-6 text-base',
};

export function buttonClass({ variant = 'primary', size = 'md', block }: { variant?: Variant; size?: Size; block?: boolean } = {}) {
  return cn('pressable inline-flex items-center justify-center font-semibold tracking-tight', variants[variant], sizes[size], block && 'w-full');
}

/** Navigation styled as a button (a link must not wrap a <button>). */
export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  block,
  icon,
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={cn(buttonClass({ variant, size, block }), className)}>
      {icon}
      {children}
    </Link>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, block, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'pressable inline-flex items-center justify-center font-semibold tracking-tight disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export const PrimaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(function PrimaryButton(props, ref) {
  return <Button ref={ref} variant="primary" {...props} />;
});

export const SecondaryButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'variant'>>(function SecondaryButton(props, ref) {
  return <Button ref={ref} variant="secondary" {...props} />;
});

/** Icon-only button with a 44px touch target and required accessible label. */
export function IconButton({
  label,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'pressable inline-flex size-touch shrink-0 items-center justify-center rounded-full text-muted active:bg-elevated disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
