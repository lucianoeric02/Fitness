import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'lg' | 'sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink shadow-[0_8px_24px_-12px_rgba(163,230,53,0.6)] active:bg-accent-strong disabled:bg-elevated disabled:text-faint disabled:shadow-none',
  secondary: 'bg-elevated text-ink border border-line active:bg-line disabled:text-faint',
  ghost: 'bg-transparent text-muted active:bg-elevated disabled:text-faint',
  danger: 'bg-danger/12 text-danger border border-danger/30 active:bg-danger/20 disabled:opacity-50',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-12 px-5 text-[15px] rounded-2xl gap-2',
  lg: 'h-14 px-6 text-base rounded-2xl gap-2',
};

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
        'inline-flex items-center justify-center font-semibold tracking-tight transition-[background-color,transform,opacity] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100',
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
        'inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors active:bg-elevated disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
