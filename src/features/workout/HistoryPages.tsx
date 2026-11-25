import { useState } from 'react';
import { History, PartyPopper, Trash2, Trophy } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, ErrorState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { deleteSession } from '@/data/repos/sessions';
import { activeDurationMs, newRecords, sessionStats, type PrKind } from '@/domain/calc/workout';
import { MUSCLE_LABELS } from '@/domain/exerciseCatalog';
import type { MuscleGroup, SetRecord } from '@/domain/models';
import { useSessionDetail } from '@/hooks/workout';
import { formatLongDay, formatTime } from '@/lib/dates';
import { formatNumber } from '@/lib/numbers';
import { formatDuration, formatSetsLine } from './format';

export function HistoryPage() {
  const sessions = useLiveQuery(async () => {
    const done = (await db.workoutSessions.where('status').equals('completed').toArray()).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
    return Promise.all(
      done.map(async (s) => {
        const sets = await db.sets.where('sessionId').equals(s.id).toArray();
        const items = await db.sessionExercises.where('sessionId').equals(s.id).toArray();
        return { session: s, stats: sessionStats(items, sets) };
      }),
    );
  }, []);
  if (sessions === undefined) return <LoadingScreen />;

  return (
    <>
      <AppHeader title="Histórico de treinos" back="/treino" />
      <PageContainer>
        {sessions.length === 0 ? (
          <Card>
            <EmptyState icon={<History className="size-6" />} title="Nenhum treino concluído" description="Seus treinos finalizados aparecem aqui com séries, cargas e recordes." action={<LinkButton to="/treino">Ir para rotinas</LinkButton>} />
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line/60">
              {sessions.map(({ session, stats }) => (
                <li key={session.id}>
                  <Link to={`/treino/historico/${session.id}`} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3 active:bg-elevated">
                    <span className="min-w-0">
                      <span className="block truncate text-body font-semibold">{session.name}</span>
                      <span className="block text-caption text-muted">
                        {formatLongDay(session.day)} · {formatDuration(activeDurationMs(session))}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-right text-caption text-muted">
                      <span className="block text-body font-semibold text-ink">{stats.completedSets} séries</span>
                      {stats.volumeKg > 0 && <>{formatNumber(stats.volumeKg)} kg</>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PageContainer>
    </>
  );
}

const PR_LABELS: Record<PrKind, string> = { heaviest: 'maior carga', e1rm: 'melhor 1RM estimado', reps: 'mais repetições' };

/** Records broken in this session per exercise, compared with sessions before it. */
function useSessionRecords(sessionId: string | undefined) {
  return useLiveQuery(async () => {
    if (!sessionId) return [];
    const session = await db.workoutSessions.get(sessionId);
    if (!session) return [];
    const items = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    const sets = await db.sets.where('sessionId').equals(sessionId).toArray();
    const out: { name: string; kinds: PrKind[] }[] = [];
    for (const item of items) {
      const current = sets.filter((s) => s.sessionExerciseId === item.id);
      if (!current.length) continue;
      const others = await db.sessionExercises.where('exerciseId').equals(item.exerciseId).toArray();
      const before: SetRecord[] = [];
      for (const o of others) {
        if (o.sessionId === sessionId) continue;
        const s = await db.workoutSessions.get(o.sessionId);
        if (!s || s.status !== 'completed' || s.startedAt >= session.startedAt) continue;
        before.push(...(await db.sets.where('sessionExerciseId').equals(o.id).toArray()));
      }
      const kinds = newRecords(before, current);
      if (kinds.length) out.push({ name: item.exerciseName, kinds });
    }
    return out;
  }, [sessionId]);
}

export function SessionDetailPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const justFinished = params.get('concluido') === '1';
  const detail = useSessionDetail(id);
  const records = useSessionRecords(id);
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (detail === undefined || records === undefined) return <LoadingScreen />;
  if (!detail) {
    return (
      <>
        <AppHeader title="Treino" back="/treino/historico" />
        <ErrorState title="Treino não encontrado" description="Ele pode ter sido excluído." />
      </>
    );
  }
  const { session, items, sets, exercises } = detail;
  const stats = sessionStats(items, sets);
  const muscles = Object.entries(stats.setsByMuscle).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <AppHeader title={justFinished ? 'Treino concluído' : session.name} eyebrow={justFinished ? session.name : formatLongDay(session.day)} back={justFinished ? '/' : '/treino/historico'} />
      <PageContainer className="gap-4">
        {justFinished && (
          <Card tone="accent" className="flex items-center gap-3">
            <PartyPopper className="size-6 shrink-0 text-accent" />
            <p className="text-body">Treino salvo. Bom trabalho!</p>
          </Card>
        )}
        <Card>
          <div className="grid grid-cols-2 gap-4 xs:grid-cols-4">
            <Stat label="Duração" value={formatDuration(activeDurationMs(session))} />
            <Stat label="Exercícios" value={`${stats.exercisesCompleted}`} />
            <Stat label="Séries" value={`${stats.completedSets}`} />
            <Stat label="Volume" value={stats.volumeKg > 0 ? `${formatNumber(stats.volumeKg)} kg` : '—'} />
          </div>
          <p className="mt-3 text-caption text-faint">
            {session.status === 'completed' ? 'Concluído' : 'Em andamento'} · {formatTime(session.startedAt)}
            {session.endedAt && ` – ${formatTime(session.endedAt)}`}
            {(session.pausedMs ?? 0) > 60000 && ` · ${formatDuration(session.pausedMs!)} pausado`}. Volume = carga × repetições das séries válidas; é uma referência de treino, não uma medida precisa.
          </p>
        </Card>

        {records.length > 0 && (
          <Card>
            <SectionHeader icon={<Trophy className="size-4 text-accent" />} title="Recordes pessoais" />
            <ul className="flex flex-col gap-2">
              {records.map((r) => (
                <li key={r.name} className="text-body">
                  <b>{r.name}</b> <span className="text-muted">· {r.kinds.map((k) => PR_LABELS[k]).join(', ')}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className="flex flex-col gap-4">
          <SectionHeader title="Exercícios" className="mb-0" />
          {items.map((item) => {
            const own = sets.filter((s) => s.sessionExerciseId === item.id && s.completedAt);
            const cardio = exercises.get(item.exerciseId)?.movementType === 'cardio';
            return (
              <div key={item.id}>
                <Link to={`/treino/exercicios/${item.exerciseId}`} className="text-body font-semibold">
                  {item.exerciseName}
                </Link>
                {item.substitutedFromName && <p className="text-caption text-muted">Substituiu {item.substitutedFromName}</p>}
                <p className="text-caption text-muted">{own.length ? formatSetsLine(own, cardio) : 'Não realizado'}</p>
                {item.notes && <p className="text-caption text-faint">Nota: {item.notes}</p>}
              </div>
            );
          })}
        </Card>

        {muscles.length > 0 && (
          <Card>
            <SectionHeader title="Séries por grupo muscular" />
            <ul className="flex flex-col gap-1.5 text-body">
              {muscles.map(([m, n]) => (
                <li key={m} className="flex justify-between">
                  <span className="text-muted">{MUSCLE_LABELS[m as MuscleGroup] ?? m}</span>
                  <b className="tabular">{n}</b>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {session.notes && (
          <Card>
            <SectionHeader title="Notas" />
            <p className="whitespace-pre-line text-body text-muted">{session.notes}</p>
          </Card>
        )}

        {justFinished ? (
          <LinkButton to="/" block size="lg">
            Voltar ao início
          </LinkButton>
        ) : (
          <Button variant="danger" block icon={<Trash2 className="size-5" />} onClick={() => setConfirmDelete(true)}>
            Excluir do histórico
          </Button>
        )}
      </PageContainer>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir treino do histórico?"
        description="As séries deste treino serão apagadas e deixam de contar em recordes e no progresso. Isso não pode ser desfeito."
        confirmLabel="Excluir treino"
        onConfirm={async () => {
          await deleteSession(session.id);
          toast.success('Treino excluído do histórico.');
          navigate('/treino/historico', { replace: true });
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-muted">{label}</p>
      <p className="tabular text-lg font-semibold">{value}</p>
    </div>
  );
}
