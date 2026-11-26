import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingScreen } from '@/components/ui/States';
import { db } from '@/data/db';
import { getSettings } from '@/data/repos/profile';
import { hydrationAverages, nutritionAnalytics, trainingByWeek } from '@/domain/calc/analytics';
import { dailyWeights } from '@/domain/calc/weight';
import { goalIssueMessage } from '@/domain/calc/goals';
import { useGoalViews } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { addDays, formatShortDay, startOfWeek, type DayKey } from '@/lib/dates';
import { formatNumber, formatSigned, formatVolumeMl } from '@/lib/numbers';
import { formatGoalValue } from '@/features/goals/GoalProgress';
import { recordsTimeline, useTrainingData } from './TrainingTab';

/** Factual weekly summary. Only states what the records support. */
export function WeekReport() {
  const today = useToday();
  const settings = useLiveQuery(() => getSettings(), []);
  const training = useTrainingData();
  const goals = useGoalViews(today);
  const [offset, setOffset] = useState(0);
  const weekStart: DayKey | null = settings ? addDays(startOfWeek(today, settings.weekStartsOn), -7 * offset) : null;
  const weekEnd = weekStart ? addDays(weekStart, 6) : null;
  const until = weekEnd && weekEnd > today ? today : weekEnd;
  const data = useLiveQuery(async () => {
    if (!weekStart || !until) return null;
    const [weights, food, targets, water] = await Promise.all([
      db.bodyWeights.where('day').between(addDays(weekStart, -7), until, true, true).toArray(),
      db.foodEntries.where('day').between(weekStart, until, true, true).toArray(),
      db.nutritionTargets.toArray(),
      db.waterEntries.where('day').between(weekStart, until, true, true).toArray(),
    ]);
    return { weights, food, targets, water };
  }, [weekStart, until]);
  if (!settings || !training || !goals || data === undefined || !data || !weekStart || !weekEnd || !until) return <LoadingScreen />;

  const w = dailyWeights(data.weights);
  const inWeek = w.filter((x) => x.day >= weekStart);
  const prevWeek = w.filter((x) => x.day < weekStart);
  const avg = (xs: typeof w) => xs.reduce((a, b) => a + b.weightKg, 0) / xs.length;
  const t = trainingByWeek(training.sessions, training.sets, [weekStart])[0]!;
  const n = nutritionAnalytics(data.food, data.targets, weekStart, until);
  const h = hydrationAverages(data.water, weekStart, until);
  const records = recordsTimeline(training).filter((r) => r.day >= weekStart && r.day <= until);
  const active = goals.filter((g) => g.goal.status === 'active').sort((a, b) => Number(b.goal.isPrimary) - Number(a.goal.isPrimary));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <IconButton label="Semana anterior" onClick={() => setOffset(offset + 1)}>
          <ChevronLeft className="size-6" />
        </IconButton>
        <div className="text-center">
          <p className="text-body font-semibold">{offset === 0 ? 'Esta semana' : offset === 1 ? 'Semana passada' : `Há ${offset} semanas`}</p>
          <p className="text-caption text-muted">
            {formatShortDay(weekStart)} – {formatShortDay(weekEnd)}
            {offset === 0 && ' (em andamento)'}
          </p>
        </div>
        <IconButton label="Próxima semana" disabled={offset === 0} onClick={() => setOffset(offset - 1)}>
          <ChevronRight className="size-6" />
        </IconButton>
      </div>

      <Section title="Peso">
        {inWeek.length === 0 ? (
          <Line>Nenhuma pesagem nesta semana.</Line>
        ) : (
          <>
            <Line>
              {inWeek.length} pesage{inWeek.length > 1 ? 'ns' : 'm'}: de {formatNumber(inWeek[0]!.weightKg, 1)} kg ({formatShortDay(inWeek[0]!.day)}) para {formatNumber(inWeek[inWeek.length - 1]!.weightKg, 1)} kg
              {inWeek.length > 1 && <> ({formatSigned(inWeek[inWeek.length - 1]!.weightKg - inWeek[0]!.weightKg)} kg)</>}.
            </Line>
            {prevWeek.length > 0 && (
              <Line>
                Média da semana {formatNumber(avg(inWeek), 1)} kg vs {formatNumber(avg(prevWeek), 1)} kg na semana anterior ({formatSigned(avg(inWeek) - avg(prevWeek))} kg).
              </Line>
            )}
          </>
        )}
      </Section>

      <Section title="Treino">
        <Line>
          {t.sessions} treino{t.sessions === 1 ? '' : 's'} concluído{t.sessions === 1 ? '' : 's'} em {t.trainingDays} dia{t.trainingDays === 1 ? '' : 's'}
          {t.sessions > 0 && <>; {t.sets} séries válidas; volume {formatNumber(t.volumeKg)} kg</>}.
        </Line>
        {records.length > 0 && <Line>Recordes: {records.map((r) => `${r.exercise} (1RM ~${formatNumber(r.e1rm, 1)} kg)`).join('; ')}.</Line>}
      </Section>

      <Section title="Nutrição">
        {n.loggedDays === 0 ? (
          <Line>Nenhuma refeição registrada.</Line>
        ) : n.averages ? (
          <>
            <Line>
              Média em {n.loggedDays} dias registrados: {formatNumber(n.averages.kcal)} kcal · P {formatNumber(n.averages.proteinG)} g · C {formatNumber(n.averages.carbsG)} g · G {formatNumber(n.averages.fatG)} g.
            </Line>
            {n.nearTarget && <Line>Perto da meta calórica (±10%) em {n.nearTarget.days} de {n.nearTarget.of} dias.</Line>}
          </>
        ) : (
          <Line>Registros em {n.loggedDays} dia{n.loggedDays > 1 ? 's' : ''}: poucos para calcular médias.</Line>
        )}
      </Section>

      <Section title="Hidratação">
        {h.loggedDays === 0 ? (
          <Line>Nenhum registro de água.</Line>
        ) : (
          <Line>
            Média de {formatVolumeMl(h.avgLoggedDays!)} nos {h.loggedDays} dias com registro ({formatVolumeMl(h.avgAllDays)} considerando os {h.totalDays} dias).
          </Line>
        )}
      </Section>

      <Section title="Objetivos (situação atual)">
        {active.length === 0 ? (
          <Line>Nenhum objetivo ativo.</Line>
        ) : (
          active.map((g) => (
            <Line key={g.goal.id}>
              {g.goal.isPrimary && '★ '}
              {g.goal.title}: {g.evaluation.ok ? `${Math.round(g.evaluation.ratio * 100)}% (atual ${formatGoalValue(g.current.value, g.goal.unit)}, alvo ${formatGoalValue(g.goal.targetValue, g.goal.unit)})` : goalIssueMessage(g.evaluation.issue)}
            </Line>
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <SectionHeader title={title} />
      <div className="flex flex-col gap-1.5">{children}</div>
    </Card>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return <p className="text-body text-muted">{children}</p>;
}
