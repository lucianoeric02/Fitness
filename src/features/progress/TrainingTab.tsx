import { useState } from 'react';
import { Dumbbell, Trophy } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, RangePicker } from '@/components/charts/BarChart';
import { TimeSeriesChart } from '@/components/charts/TimeSeriesChart';
import { LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { db } from '@/data/db';
import { getSettings } from '@/data/repos/profile';
import { e1rmSeries, setsByMuscle, trainingByWeek, weekStarts, weeklyConsistency } from '@/domain/calc/analytics';
import { MUSCLE_LABELS } from '@/domain/exerciseCatalog';
import type { SessionExercise, SetRecord, WorkoutSession } from '@/domain/models';
import { useToday } from '@/hooks/useToday';
import { addDays, formatShortDay, parseDayKey, startOfWeek, type DayKey } from '@/lib/dates';
import { formatNumber } from '@/lib/numbers';

type WeeksKey = '4' | '12' | '26';

export interface TrainingData {
  sessions: WorkoutSession[];
  items: SessionExercise[];
  sets: SetRecord[];
  weekStartsOn: 0 | 1;
}

export function useTrainingData() {
  return useLiveQuery(async (): Promise<TrainingData> => {
    const sessions = (await db.workoutSessions.where('status').equals('completed').toArray()).sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1));
    const ids = sessions.map((s) => s.id);
    const [items, sets, settings] = await Promise.all([db.sessionExercises.where('sessionId').anyOf(ids).toArray(), db.sets.where('sessionId').anyOf(ids).toArray(), getSettings()]);
    return { sessions, items, sets: sets.filter((s) => s.completedAt), weekStartsOn: settings.weekStartsOn };
  }, []);
}

/** Sessions where an exercise's best estimated 1RM beat all earlier sessions (first session excluded). */
export function recordsTimeline(data: TrainingData): Array<{ day: DayKey; exercise: string; e1rm: number }> {
  const out: Array<{ day: DayKey; exercise: string; e1rm: number }> = [];
  const byExercise = new Map<string, SessionExercise[]>();
  for (const i of data.items) byExercise.set(i.exerciseId, [...(byExercise.get(i.exerciseId) ?? []), i]);
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]));
  for (const items of byExercise.values()) {
    const history = items
      .map((i) => ({ session: sessionById.get(i.sessionId)!, sets: data.sets.filter((s) => s.sessionExerciseId === i.id), name: i.exerciseName }))
      .filter((h) => h.session);
    const series = e1rmSeries(history);
    let best = 0;
    series.forEach((p, idx) => {
      if (idx > 0 && p.value > best) out.push({ day: p.day, exercise: history.find((h) => h.session.day === p.day)?.name ?? '', e1rm: p.value });
      best = Math.max(best, p.value);
    });
  }
  return out.sort((a, b) => (a.day < b.day ? 1 : -1));
}

export function TrainingTab() {
  const today = useToday();
  const data = useTrainingData();
  const [weeksKey, setWeeksKey] = useState<WeeksKey>('12');
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  if (data === undefined) return <LoadingScreen />;

  if (data.sessions.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Dumbbell className="size-6" />} title="Sem treinos concluídos" description="Frequência, volume, desempenho por exercício e recordes aparecem depois do primeiro treino finalizado." action={<LinkButton to="/treino">Ir para Treino</LinkButton>} />
      </Card>
    );
  }

  const n = Number(weeksKey);
  const from = addDays(today, -(n * 7 - 1));
  const weeks = weekStarts(from, today, data.weekStartsOn);
  const perWeek = trainingByWeek(data.sessions, data.sets, weeks);
  // Adherence only counts weeks since the first recorded workout, never earlier empty weeks.
  const firstWeek = startOfWeek(data.sessions[0]!.day, data.weekStartsOn);
  const tracked = perWeek.filter((w) => w.weekStart >= firstWeek);
  const consistency = weeklyConsistency(tracked);
  const totalSessions = perWeek.reduce((a, w) => a + w.sessions, 0);
  const periodSessionIds = new Set(data.sessions.filter((s) => s.day >= weeks[0]!).map((s) => s.id));
  const muscles = setsByMuscle(
    data.items.filter((i) => periodSessionIds.has(i.sessionId)),
    data.sets.filter((s) => periodSessionIds.has(s.sessionId)),
  );
  const maxMuscle = Math.max(1, ...muscles.map((m) => m.sets));

  // Exercises performed, most frequent first.
  const counts = new Map<string, { name: string; n: number }>();
  for (const i of data.items) if (data.sets.some((s) => s.sessionExerciseId === i.id)) counts.set(i.exerciseId, { name: i.exerciseName, n: (counts.get(i.exerciseId)?.n ?? 0) + 1 });
  const exercises = [...counts.entries()].sort((a, b) => b[1].n - a[1].n);
  const selected = exerciseId && counts.has(exerciseId) ? exerciseId : exercises[0]?.[0];
  const sessionById = new Map(data.sessions.map((s) => [s.id, s]));
  const series = selected
    ? e1rmSeries(
        data.items
          .filter((i) => i.exerciseId === selected)
          .map((i) => ({ session: sessionById.get(i.sessionId)!, sets: data.sets.filter((s) => s.sessionExerciseId === i.id) }))
          .filter((h) => h.session),
      )
    : [];
  const records = recordsTimeline(data).filter((r) => r.day >= from).slice(0, 6);
  const label = (w: DayKey) => `${parseDayKey(w).getDate()}/${parseDayKey(w).getMonth() + 1}`;

  return (
    <div className="flex flex-col gap-4">
      <RangePicker
        label="Período"
        value={weeksKey}
        onChange={setWeeksKey}
        options={[
          { value: '4', label: '4 semanas' },
          { value: '12', label: '12 semanas' },
          { value: '26', label: '26 semanas' },
        ]}
      />
      <Card>
        <SectionHeader title="Frequência" />
        <div className="mb-3 grid grid-cols-3 gap-3 text-center">
          <Stat label="Treinos" value={String(totalSessions)} />
          <Stat label="Por semana" value={formatNumber(totalSessions / Math.max(1, tracked.length), 1)} />
          <Stat label="Semanas ativas" value={`${consistency.weeksHit}/${consistency.weeks}`} />
        </div>
        <BarChart label="Treinos por semana" bars={perWeek.map((w) => ({ key: w.weekStart, label: label(w.weekStart), value: w.sessions, title: `Semana de ${formatShortDay(w.weekStart)}: ${w.sessions} treino(s)` }))} formatValue={(v) => String(v)} />
        <p className="mt-2 text-xs text-faint">Semana ativa = pelo menos 1 treino concluído. Média e semanas ativas contam a partir do primeiro treino registrado ({formatShortDay(data.sessions[0]!.day)}); a semana atual ainda está em andamento.</p>
      </Card>

      <Card>
        <SectionHeader title="Volume semanal" />
        <BarChart label="Volume por semana" color="var(--color-carbs)" bars={perWeek.map((w) => ({ key: w.weekStart, label: label(w.weekStart), value: w.volumeKg, title: `Semana de ${formatShortDay(w.weekStart)}: ${formatNumber(w.volumeKg)} kg` }))} formatValue={(v) => (v >= 1000 ? `${formatNumber(v / 1000, 1)}t` : formatNumber(v))} />
        <p className="mt-2 text-xs text-faint">Volume = carga × repetições das séries válidas (sem aquecimento). Referência de treino, não medida científica.</p>
      </Card>

      <Card>
        <SectionHeader title="Séries por grupo muscular" />
        {muscles.length === 0 ? (
          <p className="text-body text-muted">Sem séries no período.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {muscles.map((m) => (
              <li key={m.muscle}>
                <div className="mb-1 flex justify-between text-caption">
                  <span>{MUSCLE_LABELS[m.muscle]}</span>
                  <span className="tabular text-muted">
                    {m.sets} séries · {formatNumber(m.sets / Math.max(1, tracked.length), 1)}/sem
                  </span>
                </div>
                <ProgressBar ratio={m.sets / maxMuscle} label={`${MUSCLE_LABELS[m.muscle]}: ${m.sets} séries`} className="h-1.5" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <SectionHeader title="Desempenho por exercício" />
        {exercises.length > 0 && (
          <RangePicker label="Exercício" value={selected!} onChange={setExerciseId} options={exercises.slice(0, 15).map(([id, v]) => ({ value: id, label: v.name }))} />
        )}
        <div className="mt-2">
          {series.length >= 2 ? (
            <TimeSeriesChart points={series} label="Melhor 1RM estimado por treino" color="var(--color-accent)" />
          ) : (
            <p className="rounded-control bg-elevated/60 p-4 text-caption text-muted">O gráfico aparece depois de 2 treinos com carga neste exercício ({series.length} até agora).</p>
          )}
        </div>
        <p className="mt-2 text-xs text-faint">Cada ponto é o melhor 1RM estimado do treino (Epley: carga × (1 + reps ÷ 30)).</p>
      </Card>

      <Card>
        <SectionHeader icon={<Trophy className="size-4 text-accent" />} title="Recordes no período" />
        {records.length === 0 ? (
          <p className="text-body text-muted">Nenhum recorde novo no período. Recordes comparam cada treino com todos os anteriores do mesmo exercício.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {records.map((r) => (
              <li key={`${r.day}-${r.exercise}`} className="flex justify-between gap-3 text-body">
                <span className="min-w-0 truncate">{r.exercise}</span>
                <span className="tabular shrink-0 text-caption text-muted">
                  1RM ~{formatNumber(r.e1rm, 1)} kg · {formatShortDay(r.day)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="tabular font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
