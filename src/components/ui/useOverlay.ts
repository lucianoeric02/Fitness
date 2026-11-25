import { useEffect, useRef, type RefObject } from 'react';

let openOverlays = 0;

/**
 * Shared behaviour for modal overlays (BottomSheet, Modal):
 * - locks page scroll while open,
 * - closes on Escape,
 * - closes on the Android back gesture via a temporary history entry,
 * - moves focus into the panel.
 */
export function useOverlay(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>, id: string) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    openOverlays += 1;
    document.body.style.overflow = 'hidden';

    window.history.pushState({ overlay: id }, '');
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
      openOverlays -= 1;
      if (openOverlays === 0) document.body.style.overflow = '';
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
      if (!closedByPop && window.history.state?.overlay === id) window.history.back();
    };
  }, [open, id, panelRef]);
}
