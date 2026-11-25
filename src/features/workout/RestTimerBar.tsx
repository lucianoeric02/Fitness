import { useEffect, useRef } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw, SkipForward, Timer } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { IconButton } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { restControl } from '@/data/repos/sessions';
import { formatClock, restPhase, restRemainingMs } from '@/domain/calc/restTimer';
import { useActiveSession } from '@/hooks/workout';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';
import { cancelRestAlert, restDoneFeedback, scheduleRestAlert } from '@/services/restAlerts';

/**
 * Global rest timer. Lives in the app shell so it never blocks navigation or
 * logging the next set. Keeps the native end-of-rest notification in sync and
 * gives haptic + toast feedback when rest ends in the foreground.
 */
export function RestTimerBar({ hidden }: { hidden: boolean }) {
  const session = useActiveSession();
  const toast = useToast();
  const { pathname } = useLocation();
  const rest = session?.rest;
  const now = useNow(Boolean(rest));
  const phase = restPhase(rest, now);
  const remaining = restRemainingMs(rest, now);

  // Keep the OS notification aligned with the persisted state.
  const scheduledFor = useRef<string | null>(null);
  useEffect(() => {
    const key = phase === 'running' && rest?.endsAt ? rest.endsAt : null;
    if (key === scheduledFor.current) return;
    scheduledFor.current = key;
    if (key) void scheduleRestAlert(new Date(key));
    else void cancelRestAlert();
  }, [phase, rest?.endsAt]);

  // Foreground completion feedback, once per rest.
  const notifiedFor = useRef<string | null>(null);
  useEffect(() => {
    if (phase === 'done' && rest?.endsAt && notifiedFor.current !== rest.endsAt) {
      notifiedFor.current = rest.endsAt;
      // Only buzz if the rest ended recently (not when reopening hours later).
      if (now - new Date(rest.endsAt).getTime() < 5000 && document.visibilityState === 'visible') {
        void restDoneFeedback();
        toast.success('Descanso concluído. Próxima série!');
      }
    }
  }, [phase, rest?.endsAt, now, toast]);

  if (!session || !rest || phase === 'idle' || session.pausedAt) return null;
  const act = (a: Parameters<typeof restControl>[1]) => void restControl(session.id, a);
  const ratio = rest.durationSec > 0 ? remaining / (rest.durationSec * 1000) : 0;
  const onSession = pathname.startsWith('/treino/sessao');

  return (
    <div
      role="timer"
      aria-label="Timer de descanso"
      className={cn(
        'fixed inset-x-0 z-30 mx-auto max-w-app px-3 transition-transform duration-base ease-out-expo',
        'bottom-above-nav',
        hidden && 'pointer-events-none translate-y-full opacity-0',
      )}
    >
      <div className={cn('overflow-hidden rounded-card border bg-elevated shadow-overlay', phase === 'done' ? 'border-accent/60' : 'border-line')}>
        <div className="h-1 bg-line">
          <div className="h-full bg-accent transition-all duration-base" style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
        <div className="flex items-center gap-1 px-2 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 pl-1">
            <Timer className={cn('size-5 shrink-0', phase === 'done' ? 'text-accent' : 'text-muted')} />
            {onSession ? (
              <span className="tabular font-display text-3xl font-bold" aria-live="off">
                {phase === 'done' ? 'Pronto' : formatClock(remaining)}
              </span>
            ) : (
              <Link to="/treino/sessao" className="tabular font-display text-3xl font-bold">
                {phase === 'done' ? 'Pronto' : formatClock(remaining)}
              </Link>
            )}
            {phase === 'paused' && <span className="text-caption text-warning">pausado</span>}
          </div>
          {phase !== 'done' && (
            <>
              <IconButton label="Menos 15 segundos" onClick={() => act({ adjust: -15 })}>
                <Minus className="size-5" />
              </IconButton>
              <IconButton label="Mais 15 segundos" onClick={() => act({ adjust: 15 })}>
                <Plus className="size-5" />
              </IconButton>
              <IconButton label={phase === 'paused' ? 'Retomar descanso' : 'Pausar descanso'} onClick={() => act(phase === 'paused' ? 'resume' : 'pause')}>
                {phase === 'paused' ? <Play className="size-5" /> : <Pause className="size-5" />}
              </IconButton>
            </>
          )}
          <IconButton label="Reiniciar descanso" onClick={() => act('reset')}>
            <RotateCcw className="size-5" />
          </IconButton>
          <IconButton label={phase === 'done' ? 'Fechar timer' : 'Pular descanso'} className="text-ink" onClick={() => act('skip')}>
            <SkipForward className="size-5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
}
