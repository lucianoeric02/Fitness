import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { IconButton } from '@/components/ui/Button';

/**
 * Screen header. Top-level screens show a large title and optional
 * description; sub-screens pass `back` for a compact title with a back button.
 */
export function AppHeader({
  title,
  eyebrow,
  description,
  action,
  back,
}: {
  title: ReactNode;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  /** Path to return to; shows a back button and a compact title. */
  back?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className="px-5 pb-4 pt-safe-4">
      <div className="flex min-h-touch items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          {back && (
            <IconButton label="Voltar" className="-ml-3 shrink-0 text-ink" onClick={() => navigate(back)}>
              <ChevronLeft className="size-6" />
            </IconButton>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="text-caption font-medium text-muted">{eyebrow}</p>}
            <h1 className={back ? 'truncate text-xl font-semibold tracking-tight' : 'text-title font-semibold tracking-tight'}>{title}</h1>
          </div>
        </div>
        {action}
      </div>
      {description && <p className="mt-1 max-w-prose text-body text-muted">{description}</p>}
    </header>
  );
}
