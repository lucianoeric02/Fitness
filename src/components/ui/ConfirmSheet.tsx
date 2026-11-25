import { useState, type ReactNode } from 'react';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

/** Confirmation for destructive or irreversible actions. */
export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  destructive?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[15px] leading-relaxed text-muted">{description}</div>
    </BottomSheet>
  );
}
