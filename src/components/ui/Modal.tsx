import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { IconButton } from './Button';
import { useOverlay } from './useOverlay';

/**
 * Centred dialog for short, focused content (e.g. a confirmation or a
 * single important message). Prefer BottomSheet for actions and forms.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** When false, backdrop taps don't close (Escape/back still do). */
  dismissible?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(open, onClose, panelRef, titleId);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5 pt-safe pb-safe">
      <div className="absolute inset-0 animate-fade-in bg-black/60" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-sheet w-full max-w-sm animate-modal-in flex-col rounded-card border border-line bg-surface shadow-overlay focus:outline-none"
      >
        <div className="flex items-center justify-between gap-3 py-3 pl-5 pr-3">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <IconButton label="Fechar" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-5 text-body text-muted">{children}</div>
        {footer && <div className="border-t border-line/60 px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
