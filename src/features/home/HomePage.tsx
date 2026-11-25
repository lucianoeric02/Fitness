import { Droplets, Dumbbell, Flag, Scale } from 'lucide-react';
import { Link } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card, MetricCard } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { PageContainer, TileGrid } from '@/components/layout/PageContainer';
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
      <AppHeader
        eyebrow={formatLongDay(today)}
        title={
          <>
            {greetingFor()}
            {firstName && <span className="text-muted">, {firstName}</span>}
          </>
        }
      />

      <PageContainer>
        {progress && <CaloriesCard kcal={progress.kcal} protein={progress.protein} carbs={progress.carbs} fat={progress.fat} entries={nutrition?.entries ?? 0} />}

        <TileGrid>
          {water && <WaterTile water={water} />}
          <WeightTile summary={weight!} today={today} />
        </TileGrid>

        {goal && weight?.latest && <GoalCard goal={goal} current={weight.latest.weightKg} rate={weight.ratePerWeek} today={today} />}

        <WorkoutTodayCard sessions={sessions ?? []} />
      </PageContainer>
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
    <Card tone="accent" interactive className="p-5">
      <Link to="/nutricao" className="flex items-center gap-5" aria-label="Abrir nutrição">
        <ProgressRing ratio={kcal.ratio} over={kcal.over} size={136} stroke={11} label={`${Math.round(kcal.rawRatio * 100)}% da meta calórica`}>
          <span className="tabular font-display text-metric font-bold leading-none">{formatNumber(Math.abs(kcal.remaining))}</span>
          <span className="mt-1 text-xs font-medium text-muted">{kcal.over ? 'kcal acima' : 'kcal restantes'}</span>
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-label text-muted">Calorias</p>
            <p className="tabular text-body">
              <b className="text-ink">{formatNumber(kcal.consumed)}</b>
              <span className="text-muted"> / {formatNumber(kcal.target)}</span>
            </p>
          </div>
          <MacroLine label="Proteína" p={protein} color="var(--color-protein)" />
          <MacroLine label="Carbo" p={carbs} color="var(--color-carbs)" />
          <MacroLine label="Gordura" p={fat} color="var(--color-fat)" />
        </div>
      </Link>
      {entries === 0 && <p className="mt-4 border-t border-line/60 pt-3 text-caption text-muted">Nenhuma refeição registrada hoje.</p>}
    </Card>
  );
}

function MacroLine({ label, p, color }: { label: string; p: MetricProgress; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
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
    <MetricCard
      label="Água"
      icon={<Droplets className="size-4 text-water" />}
      value={formatNumber(water.consumed / 1000, 1)}
      unit={`/ ${formatNumber(water.target / 1000, 1)} L`}
      progress={{ ratio: water.ratio, color: 'var(--color-water)', label: 'Progresso de hidratação' }}
      footnote={water.consumed >= water.target ? 'Meta batida' : `Faltam ${formatVolumeMl(water.target - water.consumed)}`}
    />
  );
}

function WeightTile({ summary, today }: { summary: NonNullable<ReturnType<typeof useWeightSummary>>; today: string }) {
  const latest = summary.latest;
  return (
    <MetricCard
      label="Peso"
      icon={<Scale className="size-4 text-accent" />}
      value={latest ? formatNumber(latest.weightKg, 1) : null}
      unit="kg"
      emptyText="Sem pesagens ainda."
      footnote={
        latest &&
        (summary.change7d !== null ? (
          <>
            <b className="tabular text-ink">{formatSigned(summary.change7d)} kg</b> em 7 dias
          </>
        ) : (
          <>Registrado {formatRelativeDay(latest.day, today).toLowerCase()}</>
        ))
      }
    />
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
      <SectionHeader
        icon={<Flag className="size-4 text-accent" />}
        title="Meta principal"
        action={<span className="tabular text-caption font-semibold text-accent">{Math.round(p.ratio * 100)}%</span>}
      />
      <div className="flex items-baseline justify-between">
        <p className="text-body">
          {p.achieved ? (
            <b className="text-accent">Meta atingida</b>
          ) : (
            <>
              <b className="tabular">{formatNumber(Math.abs(p.remaining), 1)} kg</b>
              <span className="text-muted"> {p.direction === 'increase' ? 'para ganhar' : 'para perder'}</span>
            </>
          )}
        </p>
        <p className="tabular text-caption text-muted">
          {formatNumber(goal.startValue, 1)} → <b className="text-ink">{formatNumber(goal.targetValue, 1)} kg</b>
        </p>
      </div>
      <ProgressBar ratio={p.ratio} label="Progresso da meta de peso" className="mt-3" />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
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
      <SectionHeader icon={<Dumbbell className="size-4 text-accent" />} title="Treino de hoje" />
      {active ? (
        <p className="text-body">
          <b>{active.name}</b> <span className="text-accent">em andamento</span>
        </p>
      ) : done.length > 0 ? (
        <p className="text-body">
          <b>{done.map((s) => s.name).join(', ')}</b> <span className="text-muted">concluído</span>
        </p>
      ) : (
        <p className="text-body text-muted">Nenhum treino registrado hoje.</p>
      )}
    </Card>
  );
}
