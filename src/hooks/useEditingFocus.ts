import { useEffect, useState } from 'react';

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'radio', 'range', 'submit', 'reset', 'file', 'color', 'date', 'time']);

/** True when the element opens the on-screen keyboard. */
export function isTextEntry(el: Element | null): el is HTMLElement {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type) && !el.readOnly && !el.disabled;
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Tracks whether the user is typing in a field (i.e. the keyboard is likely
 * open). Also keeps the focused field visible once the keyboard has resized
 * the viewport.
 */
export function useEditingFocus(): boolean {
  const [editing, setEditing] = useState(() => isTextEntry(document.activeElement));

  useEffect(() => {
    let timer: number | undefined;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as Element | null;
      if (!isTextEntry(target)) return;
      setEditing(true);
      window.clearTimeout(timer);
      // Wait for the keyboard to finish resizing the viewport.
      timer = window.setTimeout(() => target.scrollIntoView?.({ block: 'center', behavior: 'smooth' }), 300);
    };
    const onFocusOut = () => {
      // Defer: focus may be moving to another field.
      window.setTimeout(() => setEditing(isTextEntry(document.activeElement)), 0);
    };
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, []);

  return editing;
}
