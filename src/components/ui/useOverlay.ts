import { useEffect, useRef, type RefObject } from 'react';

/**
 * Overlay stack shared by BottomSheet and Modal. Overlays can be stacked
 * (e.g. a confirmation over an edit sheet); only the topmost one reacts to
 * Escape and to the Android back gesture.
 */
interface Entry {
  id: string;
  close: () => void;
}
const stack: Entry[] = [];
/** popstate events caused by our own history.back() calls, to ignore. */
let selfPops = 0;
let listening = false;

function onPopState() {
  if (selfPops > 0) {
    selfPops -= 1;
    return;
  }
  const top = stack.pop();
  top?.close();
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') stack[stack.length - 1]?.close();
}

function ensureListeners() {
  if (listening) return;
  listening = true;
  window.addEventListener('popstate', onPopState);
  window.addEventListener('keydown', onKeyDown);
}

/**
 * - locks page scroll while any overlay is open,
 * - closes the topmost overlay on Escape / back gesture (via a history entry),
 * - moves focus into the panel.
 */
export function useOverlay(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement | null>, id: string) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    ensureListeners();
    const entry: Entry = { id, close: () => onCloseRef.current() };
    stack.push(entry);
    document.body.style.overflow = 'hidden';
    window.history.pushState({ overlay: id }, '');
    panelRef.current?.focus();

    return () => {
      const idx = stack.indexOf(entry);
      if (idx !== -1) {
        // Closed by the app (not by the back gesture): drop our history entry.
        stack.splice(idx, 1);
        // Every overlay pushed exactly one entry; while the current entry is an
        // overlay entry (not a route the user navigated to), pop one.
        if (window.history.state?.overlay) {
          selfPops += 1;
          window.history.back();
        }
      }
      if (stack.length === 0) document.body.style.overflow = '';
    };
  }, [open, id, panelRef]);
}
