import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { useOverlay } from './useOverlay';

/** Bottom sheet for quick actions; thumb-friendly on phones. */
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
  useOverlay(open, onClose, panelRef, titleId);
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
        className="relative mx-auto flex max-h-sheet w-full max-w-app animate-sheet-in flex-col rounded-t-sheet border-t border-line bg-surface pb-safe shadow-overlay focus:outline-none"
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
