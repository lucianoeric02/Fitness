import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '@/components/ui/Toast';
import { getSettings, updateSettings } from '@/data/repos/profile';
import { ActiveSessionExistsError, startSession } from '@/data/repos/sessions';
import { useToday } from '@/hooks/useToday';
import { ensureRestAlertPermission } from '@/services/restAlerts';

/** Explicit start (button tap only). Asks notification permission once. */
export function useStartWorkout() {
  const today = useToday();
  const toast = useToast();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const start = useCallback(
    async (templateId?: string) => {
      setStarting(true);
      try {
        await startSession({ templateId, day: today });
        const settings = await getSettings();
        if (!settings.restAlertsAsked) {
          await ensureRestAlertPermission();
          await updateSettings({ restAlertsAsked: true });
        }
        navigate('/treino/sessao');
      } catch (e) {
        if (e instanceof ActiveSessionExistsError) {
          toast.info('Você já tem um treino em andamento.');
          navigate('/treino/sessao');
        } else {
          console.error(e);
          toast.error('Não foi possível iniciar o treino.');
        }
      } finally {
        setStarting(false);
      }
    },
    [today, toast, navigate],
  );

  return { start, starting };
}
