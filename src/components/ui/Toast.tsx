import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastKind = 'success' | 'error' | 'info';
export interface ToastAction {
  label: string;
  onClick: () => void;
}
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
  info: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: ToastKind, message: string, action?: ToastAction) => {
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-2), { id, kind, message, action }]);
      // Toasts with an action stay longer so there is time to tap it.
      window.setTimeout(() => dismiss(id), kind === 'error' ? 5000 : action ? 5000 : 2800);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m, a) => push('success', m, a),
      error: (m) => push('error', m),
      info: (m, a) => push('info', m, a),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-60 flex flex-col items-center gap-2 px-4 pt-safe-3" aria-live="polite">
          {items.map((t) => (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className={cn(
                'pointer-events-auto flex w-full max-w-sm animate-toast-in items-center gap-3 rounded-control border px-4 py-3 text-body font-medium shadow-overlay',
                'border-line bg-elevated text-ink',
              )}
            >
              {t.kind === 'success' && <CheckCircle2 className="size-5 shrink-0 text-accent" />}
              {t.kind === 'error' && <AlertCircle className="size-5 shrink-0 text-danger" />}
              {t.kind === 'info' && <Info className="size-5 shrink-0 text-water" />}
              <span className="flex-1">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className="pressable -my-1 -mr-2 min-h-touch rounded-xl px-3 text-sm font-semibold text-accent active:bg-line"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
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
