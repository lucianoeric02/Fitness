import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-elevated/70', className)} aria-hidden />;
}

export function LoadingScreen({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex flex-col gap-3 px-5 pt-6" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-52" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-line bg-elevated text-accent">
        {icon}
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-muted">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Algo deu errado',
  description = 'Não foi possível carregar estes dados. Seus registros continuam salvos no aparelho.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-danger/30 bg-danger/10 text-danger">
        <AlertTriangle className="size-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[15px] text-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
