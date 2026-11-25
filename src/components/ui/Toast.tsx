import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), kind === 'error' ? 5000 : 2800);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[calc(var(--sat)+0.75rem)]" aria-live="polite">
          {items.map((t) => (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-2xl border px-4 py-3 text-[15px] font-medium shadow-2xl shadow-black/40',
                'border-line bg-elevated text-ink',
              )}
            >
              {t.kind === 'success' && <CheckCircle2 className="size-5 shrink-0 text-accent" />}
              {t.kind === 'error' && <AlertCircle className="size-5 shrink-0 text-danger" />}
              {t.kind === 'info' && <Info className="size-5 shrink-0 text-water" />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
