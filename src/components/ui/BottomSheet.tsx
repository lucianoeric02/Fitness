import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';

/**
 * Bottom sheet for quick actions. Closes on backdrop tap, Escape and the
 * Android back gesture (via a history entry).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Back gesture closes the sheet instead of leaving the screen.
    const marker = { sheet: titleId };
    window.history.pushState(marker, '');
    let closedByPop = false;
    const onPop = () => {
      closedByPop = true;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      if (!closedByPop && window.history.state?.sheet === titleId) window.history.back();
    };
  }, [open, titleId]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[88dvh] animate-sheet-in flex-col rounded-t-[1.75rem] border-t border-line bg-surface pb-safe focus:outline-none"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line" aria-hidden />
        <div className="flex items-center justify-between px-5 pb-1 pt-2">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <IconButton label="Fechar" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-line/60 px-5 pb-4 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
