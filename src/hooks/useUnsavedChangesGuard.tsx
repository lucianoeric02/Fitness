import { useBlocker } from 'react-router';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';

/**
 * Asks for confirmation before leaving a screen with unsaved edits
 * (bottom navigation, back button or the Android back gesture).
 * Render the returned element inside the screen.
 */
export function useUnsavedChangesGuard(dirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  return (
    <ConfirmSheet
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title="Descartar alterações?"
      description="Você tem alterações que ainda não foram salvas neste formulário."
      confirmLabel="Descartar"
      onConfirm={() => blocker.proceed?.()}
    />
  );
}
