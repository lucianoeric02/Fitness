import { Droplets, Dumbbell, Flag, Scale } from 'lucide-react';
import { Link } from 'react-router';
import { BigNumber, Card, CardTitle } from '@/components/ui/Card';
import { PageBody } from '@/components/ui/Page';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { LoadingScreen } from '@/components/ui/States';
import { goalProgress, projectGoalDate, requiredWeeklyRate } from '@/domain/calc/goals';
import { dailyNutritionProgress, type MetricProgress } from '@/domain/calc/nutrition';
import { metricProgress } from '@/domain/calc/nutrition';
import {
  useDayNutritionTotals,
  useDaySessions,
  useDayWaterMl,
  usePrimaryGoal,
  useProfile,
  useTargetForDay,
  useWeightSummary,
} from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { formatLongDay, formatRelativeDay, formatShortDay, greetingFor } from '@/lib/dates';
import { formatNumber, formatSigned, formatVolumeMl } from '@/lib/numbers';

export function HomePage() {
  const today = useToday();
  const profile = useProfile();
  const target = useTargetForDay(today);
  const nutrition = useDayNutritionTotals(today);
  const waterMl = useDayWaterMl(today);
  const weight = useWeightSummary();
  const goal = usePrimaryGoal();
  const sessions = useDaySessions(today);

  if ([profile, target, nutrition, waterMl, weight, goal, sessions].some((v) => v === undefined)) {
    return <LoadingScreen />;
  }

  const firstName = profile?.name.split(' ')[0] ?? '';
  const progress = target && nutrition ? dailyNutritionProgress(nutrition.totals, target) : null;
  const water = target ? metricProgress(waterMl ?? 0, target.waterMl) : null;

  return (
    <>
      <header className="px-5 pb-4 pt-[calc(var(--sat)+1.25rem)]">
        <p className="text-[13px] font-medium text-muted">{formatLongDay(today)}</p>
        <h1 className="mt-0.5 text-[28px] font-semibold leading-tight tracking-tight">
          {greetingFor()}
          {firstName && <span className="text-muted">, {firstName}</span>}
        </h1>
      </header>

      <PageBody>
        {progress && <CaloriesCard kcal={progress.kcal} protein={progress.protein} carbs={progress.carbs} fat={progress.fat} entries={nutrition?.entries ?? 0} />}

        <div className="grid grid-cols-2 gap-3">
          {water && <WaterTile water={water} />}
          <WeightTile summary={weight!} today={today} />
        </div>

        {goal && weight?.latest && <GoalCard goal={goal} current={weight.latest.weightKg} rate={weight.ratePerWeek} today={today} />}

        <WorkoutTodayCard sessions={sessions ?? []} />
      </PageBody>
    </>
  );
}

function CaloriesCard({
  kcal,
  protein,
  carbs,
  fat,
  entries,
}: {
  kcal: MetricProgress;
  protein: MetricProgress;
  carbs: MetricProgress;
  fat: MetricProgress;
  entries: number;
}) {
  return (
    <Card tone="accent" className="p-5">
      <Link to="/nutricao" className="flex items-center gap-5" aria-label="Abrir nutrição">
        <ProgressRing ratio={kcal.ratio} over={kcal.over} size={136} stroke={11} label={`${Math.round(kcal.rawRatio * 100)}% da meta calórica`}>
          <span className="tabular font-display text-[34px] font-bold leading-none">{formatNumber(Math.abs(kcal.remaining))}</span>
          <span className="mt-1 text-[12px] font-medium text-muted">{kcal.over ? 'kcal acima' : 'kcal restantes'}</span>
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">Calorias</p>
            <p className="tabular text-[15px]">
              <b className="text-ink">{formatNumber(kcal.consumed)}</b>
              <span className="text-muted"> / {formatNumber(kcal.target)}</span>
            </p>
          </div>
          <MacroLine label="Proteína" p={protein} color="var(--color-protein)" />
          <MacroLine label="Carbo" p={carbs} color="var(--color-carbs)" />
          <MacroLine label="Gordura" p={fat} color="var(--color-fat)" />
        </div>
      </Link>
      {entries === 0 && <p className="mt-4 border-t border-line/60 pt-3 text-[13px] text-muted">Nenhuma refeição registrada hoje.</p>}
    </Card>
  );
}

function MacroLine({ label, p, color }: { label: string; p: MetricProgress; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[12px]">
        <span className="text-muted">{label}</span>
        <span className="tabular font-medium">
          {formatNumber(p.consumed)}
          <span className="text-faint">/{formatNumber(p.target)} g</span>
        </span>
      </div>
      <ProgressBar ratio={p.ratio} over={p.over} color={color} label={`${label}: ${Math.round(p.rawRatio * 100)}%`} className="h-1.5" />
    </div>
  );
}

function WaterTile({ water }: { water: MetricProgress }) {
  return (
    <Card className="flex flex-col">
      <CardTitle icon={<Droplets className="size-4 text-water" />}>Água</CardTitle>
      <BigNumber value={formatNumber(water.consumed / 1000, 1)} unit={`/ ${formatNumber(water.target / 1000, 1)} L`} />
      <ProgressBar ratio={water.ratio} color="var(--color-water)" label="Progresso de hidratação" className="mt-auto" />
      <p className="mt-2 text-[12px] text-muted">
        {water.consumed >= water.target ? 'Meta batida' : `Faltam ${formatVolumeMl(water.target - water.consumed)}`}
      </p>
    </Card>
  );
}

function WeightTile({ summary, today }: { summary: NonNullable<ReturnType<typeof useWeightSummary>>; today: string }) {
  const latest = summary.latest;
  return (
    <Card className="flex flex-col">
      <CardTitle icon={<Scale className="size-4 text-accent" />}>Peso</CardTitle>
      {latest ? (
        <>
          <BigNumber value={formatNumber(latest.weightKg, 1)} unit="kg" />
          <p className="mt-auto pt-3 text-[12px] text-muted">
            {summary.change7d !== null ? (
              <>
                <b className="tabular text-ink">{formatSigned(summary.change7d)} kg</b> em 7 dias
              </>
            ) : (
              <>Registrado {formatRelativeDay(latest.day, today).toLowerCase()}</>
            )}
          </p>
        </>
      ) : (
        <p className="text-[13px] text-muted">Sem pesagens ainda.</p>
      )}
    </Card>
  );
}

function GoalCard({
  goal,
  current,
  rate,
  today,
}: {
  goal: NonNullable<ReturnType<typeof usePrimaryGoal>>;
  current: number;
  rate: number | null;
  today: string;
}) {
  const p = goalProgress(goal, current);
  const eta = projectGoalDate(p.remaining, rate, today);
  const needed = requiredWeeklyRate(goal, current, today);
  return (
    <Card>
      <CardTitle icon={<Flag className="size-4 text-accent" />} action={<span className="tabular text-[13px] font-semibold text-accent">{Math.round(p.ratio * 100)}%</span>}>
        Meta principal
      </CardTitle>
      <div className="flex items-baseline justify-between">
        <p className="text-[15px]">
          {p.achieved ? (
            <b className="text-accent">Meta atingida</b>
          ) : (
            <>
              <b className="tabular">{formatNumber(Math.abs(p.remaining), 1)} kg</b>
              <span className="text-muted"> {p.direction === 'increase' ? 'para ganhar' : 'para perder'}</span>
            </>
          )}
        </p>
        <p className="tabular text-[13px] text-muted">
          {formatNumber(goal.startValue, 1)} → <b className="text-ink">{formatNumber(goal.targetValue, 1)} kg</b>
        </p>
      </div>
      <ProgressBar ratio={p.ratio} label="Progresso da meta de peso" className="mt-3" />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        {rate !== null && (
          <span>
            Ritmo: <b className="tabular text-ink">{formatSigned(rate, 2)} kg/sem</b>
          </span>
        )}
        {needed !== null && !p.achieved && (
          <span>
            Necessário: <b className="tabular text-ink">{formatSigned(needed, 2)} kg/sem</b>
          </span>
        )}
        {eta && !p.achieved && (
          <span>
            Previsão: <b className="text-ink">{formatShortDay(eta)}</b>
          </span>
        )}
        {rate === null && <span>O ritmo aparece após algumas pesagens em dias diferentes.</span>}
      </div>
    </Card>
  );
}

function WorkoutTodayCard({ sessions }: { sessions: NonNullable<ReturnType<typeof useDaySessions>> }) {
  const active = sessions.find((s) => s.status === 'in_progress');
  const done = sessions.filter((s) => s.status === 'completed');
  return (
    <Card>
      <CardTitle icon={<Dumbbell className="size-4 text-accent" />}>Treino de hoje</CardTitle>
      {active ? (
        <p className="text-[15px]">
          <b>{active.name}</b> <span className="text-accent">em andamento</span>
        </p>
      ) : done.length > 0 ? (
        <p className="text-[15px]">
          <b>{done.map((s) => s.name).join(', ')}</b> <span className="text-muted">concluído</span>
        </p>
      ) : (
        <p className="text-[15px] text-muted">Nenhum treino registrado hoje.</p>
      )}
    </Card>
  );
}
