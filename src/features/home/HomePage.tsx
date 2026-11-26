import { useState, type ReactNode } from 'react';
import { CalendarCheck, ChevronRight, Droplets, Dumbbell, Flag, Play, Plus, Scale, Undo2, UtensilsCrossed } from 'lucide-react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingScreen } from '@/components/ui/States';
import { db } from '@/data/db';
import { evaluateGoal } from '@/domain/calc/goals';
import { dailyNutritionProgress, metricProgress, type MetricProgress } from '@/domain/calc/nutrition';
import { activeDurationMs } from '@/domain/calc/workout';
import { MUSCLE_LABELS } from '@/domain/exerciseCatalog';
import type { MuscleGroup } from '@/domain/models';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { routineDetails } from '@/features/workout/WorkoutPage';
import { useRoutines, type TemplateSummary } from '@/hooks/workout';
import { dailyWeights } from '@/domain/calc/weight';
import type { WeekSummary } from '@/domain/calc/weekly';
import { WeightSheet } from '@/features/body/WeightSheet';
import { GoalRow } from '@/features/goals/GoalProgress';
import { QUICK_WATER_ML, useWaterActions } from '@/features/hydration/useWaterActions';
import { WaterSheet } from '@/features/hydration/WaterSheet';
import {
  useDayNutritionTotals,
  useDayWater,
  useGoalViews,
  useProfile,
  useTargetForDay,
  useWeekSummary,
  useWeightHistory,
  type GoalView,
} from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { usePlan } from '@/hooks/planning';
import { useSettings } from '@/hooks/data';
import { weekPlanStats, type PlannedKind, type WeekPlanStats } from '@/domain/calc/planning';
import { cn } from '@/lib/cn';
import { addDays, formatLongDay, formatRelativeDay, greetingFor, startOfWeek, type DayKey } from '@/lib/dates';
import { formatNumber, formatSigned, formatVolumeMl } from '@/lib/numbers';


/** Today's session (active first, then the latest completed) with its exercises. */
function useTodayWorkout(today: DayKey) {
  return useLiveQuery(async () => {
    const active = await db.workoutSessions.where('status').equals('in_progress').first();
    const todays = await db.workoutSessions.where('day').equals(today).toArray();
    const session = active ?? todays.filter((s) => s.status === 'completed').sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))[0] ?? null;
    if (!session) return { session: null, exerciseCount: 0, muscles: [] as string[] };
    const items = await db.sessionExercises.where('sessionId').equals(session.id).toArray();
    const exercises = await db.exercises.bulkGet(items.map((i) => i.exerciseId));
    const muscles = [...new Set(exercises.flatMap((e) => (e ? [e.primaryMuscle] : [])))];
    return { session, exerciseCount: items.length, muscles };
  }, [today]);
}

export function HomePage() {
  const today = useToday();
  const profile = useProfile();
  const target = useTargetForDay(today);
  const nutrition = useDayNutritionTotals(today);
  const water = useDayWater(today);
  const weights = useWeightHistory();
  const goals = useGoalViews(today);
  const week = useWeekSummary(today);
  const workout = useTodayWorkout(today);
  const routines = useRoutines();
  const settingsForPlan = useSettings();
  const plan = usePlan(startOfWeek(today, settingsForPlan?.weekStartsOn ?? 1), addDays(startOfWeek(today, settingsForPlan?.weekStartsOn ?? 1), 6), today);
  const [weightOpen, setWeightOpen] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);

  if ([profile, target, nutrition, water, weights, goals, week, workout, routines, plan].some((v) => v === undefined)) {
    return <LoadingScreen />;
  }

  const firstName = profile?.name.split(' ')[0] ?? '';
  const progress = target && nutrition ? dailyNutritionProgress(nutrition.totals, target) : null;

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
        action={
          <Link
            to="/mais/perfil"
            aria-label="Abrir perfil"
            className="pressable flex size-touch shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-sm font-semibold text-ink"
          >
            {firstName.charAt(0).toUpperCase() || 'P'}
          </Link>
        }
      />

      <PageContainer>
        <WorkoutTodayCard data={workout!} next={routines!.next} hasRoutines={routines!.summaries.length > 0} todayPlan={plan!.days.find((d) => d.day === today)?.planned ?? 'unplanned'} />
        {progress && (
          <>
            <CaloriesCard kcal={progress.kcal} hasEntries={(nutrition?.entries ?? 0) > 0} />
            <MacrosCard progress={progress} />
          </>
        )}
        {target && <HydrationCard water={metricProgress(water!.totalMl, target.waterMl)} last={water!.last} />}
        <WeightCard weights={weights!} goals={goals!} today={today} onLog={() => setWeightOpen(true)} />
        <GoalsCard goals={goals!} />
        <WeekCard week={week!} planStats={plan!.trainingDays !== undefined ? weekPlanStats(plan!.days, today) : null} frequencyTarget={goals!.find((g) => g.goal.kind === 'consistency' && g.goal.status === 'active')?.goal.targetValue ?? null} />
        <QuickActions onWeight={() => setWeightOpen(true)} onWater={() => setWaterOpen(true)} />
      </PageContainer>

      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} lastWeightKg={weights![0]?.weightKg ?? null} />
      <WaterSheet open={waterOpen} onClose={() => setWaterOpen(false)} />
    </>
  );
}

// ---- Cards ---------------------------------------------------------------------

function HeaderLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="-my-2 -mr-2 flex min-h-touch items-center gap-0.5 px-2 text-caption font-medium text-muted">
      {children} <ChevronRight className="size-4" />
    </Link>
  );
}

function WorkoutTodayCard({ data, next, hasRoutines, todayPlan }: { data: NonNullable<ReturnType<typeof useTodayWorkout>>; next: TemplateSummary | null; hasRoutines: boolean; todayPlan: PlannedKind }) {
  const { session, exerciseCount, muscles } = data;
  const { start, starting } = useStartWorkout();
  const active = session?.status === 'in_progress';
  const details = session
    ? [
        muscles.map((m) => MUSCLE_LABELS[m as MuscleGroup] ?? m).join(', '),
        exerciseCount ? `${exerciseCount} exercício${exerciseCount > 1 ? 's' : ''}` : '',
        `${Math.round(activeDurationMs(session) / 60000)} min`,
      ].filter(Boolean)
    : [];

  return (
    <Card>
      <SectionHeader
        icon={<Dumbbell className="size-4 text-accent" />}
        title="Treino de hoje"
        action={
          <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', active ? 'bg-accent/15 text-accent' : 'bg-elevated text-muted')}>
            {active ? 'Em andamento' : session ? 'Concluído' : todayPlan === 'rest' ? 'Descanso' : next ? (todayPlan === 'training' ? 'Planejado' : 'Próximo') : 'Sem rotina'}
          </span>
        }
      />
      {session ? (
        <>
          <p className="text-lg font-semibold tracking-tight">{session.name}</p>
          {details.length > 0 && <p className="mt-0.5 text-caption text-muted">{details.join(' · ')}</p>}
          <LinkButton to={active ? '/treino/sessao' : `/treino/historico/${session.id}`} block variant={active ? 'primary' : 'secondary'} className="mt-4">
            {active ? 'Retomar treino' : 'Ver treino'}
          </LinkButton>
        </>
      ) : todayPlan === 'rest' ? (
        <>
          <p className="text-body font-semibold">Dia de descanso</p>
          <p className="mt-0.5 text-caption text-muted">
            {next ? `Próximo treino na sequência: ${next.template.name}.` : 'Seu plano marca descanso hoje.'} O plano orienta, não obriga.
          </p>
          {next && next.items.length > 0 && (
            <Button block variant="secondary" className="mt-4" loading={starting} onClick={() => void start(next.template.id)}>
              Treinar mesmo assim
            </Button>
          )}
        </>
      ) : next ? (
        <>
          <p className="text-caption text-muted">{todayPlan === 'training' ? 'Planejado para hoje' : 'Próximo na sequência'}</p>
          <p className="text-lg font-semibold tracking-tight">{next.template.name}</p>
          <p className="mt-0.5 text-caption text-muted">{routineDetails(next)}</p>
          {next.items.length > 0 ? (
            <Button block className="mt-4" loading={starting} icon={<Play className="size-5" />} onClick={() => void start(next.template.id)}>
              Iniciar treino
            </Button>
          ) : (
            <LinkButton to={`/treino/rotinas/${next.template.id}`} block variant="secondary" className="mt-4">
              Adicionar exercícios
            </LinkButton>
          )}
        </>
      ) : (
        <>
          <p className="text-body font-semibold">{hasRoutines ? 'Nenhuma rotina ativa' : 'Nenhuma rotina criada'}</p>
          <p className="mt-0.5 text-caption text-muted">Crie suas rotinas (ex.: A, B, C). Elas seguem em sequência e o próximo treino aparece aqui.</p>
          <LinkButton to={hasRoutines ? '/treino' : '/treino/rotinas/nova'} block variant="secondary" className="mt-4">
            {hasRoutines ? 'Ver rotinas' : 'Criar rotina'}
          </LinkButton>
        </>
      )}
    </Card>
  );
}

function CaloriesCard({ kcal, hasEntries }: { kcal: MetricProgress; hasEntries: boolean }) {
  return (
    <Link to="/nutricao" aria-label="Calorias: abrir nutrição" className="block rounded-card">
      <Card tone="accent" interactive className="flex items-center gap-5 p-5">
        <ProgressRing ratio={kcal.ratio} over={kcal.over} size={120} stroke={10} label={`${Math.round(kcal.rawRatio * 100)}% da meta calórica`}>
          <span className="tabular font-display text-metric font-bold">{formatNumber(Math.abs(kcal.remaining))}</span>
          <span className="mt-1 text-xs font-medium text-muted">{kcal.over ? 'kcal acima' : 'kcal restantes'}</span>
        </ProgressRing>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <p className="text-caption font-semibold uppercase tracking-label text-muted">Calorias</p>
          <Stat label="Consumidas" value={`${formatNumber(kcal.consumed)} kcal`} />
          <Stat label="Meta" value={`${formatNumber(kcal.target)} kcal`} />
          {!hasEntries && <p className="text-caption text-accent">Adicione sua primeira refeição</p>}
        </div>
      </Card>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-caption text-muted">{label}</span>
      <span className="tabular text-body font-semibold">{value}</span>
    </div>
  );
}

function MacrosCard({ progress }: { progress: ReturnType<typeof dailyNutritionProgress> }) {
  const rows = [
    { label: 'Proteína', p: progress.protein, color: 'var(--color-protein)' },
    { label: 'Carboidratos', p: progress.carbs, color: 'var(--color-carbs)' },
    { label: 'Gordura', p: progress.fat, color: 'var(--color-fat)' },
  ];
  return (
    <Link to="/nutricao" aria-label="Macronutrientes: abrir nutrição" className="block rounded-card">
      <Card interactive className="flex flex-col gap-3.5">
        {rows.map(({ label, p, color }) => (
          <div key={label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-caption">
              <span className="font-medium text-ink">{label}</span>
              <span className="tabular text-muted">
                <b className="text-ink">{formatNumber(p.consumed)}</b> / {formatNumber(p.target)} g ·{' '}
                {p.over ? `+${formatNumber(-p.remaining)} g` : `faltam ${formatNumber(p.remaining)} g`}
              </span>
            </div>
            <ProgressBar ratio={p.ratio} over={p.over} color={color} label={`${label}: ${Math.round(p.rawRatio * 100)}%`} />
          </div>
        ))}
      </Card>
    </Link>
  );
}

function HydrationCard({ water, last }: { water: MetricProgress; last: { id: string; amountMl: number } | null }) {
  const { add, undo } = useWaterActions();
  return (
    <Card>
      <SectionHeader
        icon={<Droplets className="size-4 text-water" />}
        title="Hidratação"
        action={
          last && (
            <button
              type="button"
              onClick={() => void undo(last)}
              className="pressable -my-2 -mr-2 flex min-h-touch items-center gap-1 rounded-xl px-2 text-caption font-medium text-muted active:bg-elevated"
            >
              <Undo2 className="size-4" /> Desfazer +{formatNumber(last.amountMl)} ml
            </button>
          )
        }
      />
      <div className="flex items-baseline justify-between gap-2">
        <p>
          <span className="tabular font-display text-4xl font-bold">{formatNumber(water.consumed / 1000, 2)}</span>
          <span className="text-sm text-muted"> / {formatNumber(water.target / 1000, 2)} L</span>
        </p>
        <p className="text-caption text-muted">
          {water.consumed >= water.target ? <span className="text-accent">Meta batida</span> : `Faltam ${formatVolumeMl(water.target - water.consumed)}`}
        </p>
      </div>
      <ProgressBar ratio={water.ratio} color="var(--color-water)" label="Progresso de hidratação" className="mt-3" />
      <div className="mt-4 grid grid-cols-3 gap-2">
        {QUICK_WATER_ML.map((ml) => (
          <Button key={ml} variant="secondary" size="sm" onClick={() => void add(ml)}>
            +{ml} ml
          </Button>
        ))}
      </div>
      <Link to="/mais/hidratacao" className="-mb-2 mt-1 flex min-h-touch items-center justify-center gap-0.5 text-caption font-medium text-muted">
        Histórico e ajustes <ChevronRight className="size-4" />
      </Link>
    </Card>
  );
}

function WeightCard({
  weights,
  goals,
  today,
  onLog,
}: {
  weights: NonNullable<ReturnType<typeof useWeightHistory>>;
  goals: GoalView[];
  today: DayKey;
  onLog: () => void;
}) {
  const daily = dailyWeights(weights).reverse();
  const current = daily[0];
  const previous = daily[1];
  const weightGoal = goals.find((g) => g.goal.kind === 'body_weight' && g.goal.status === 'active');
  const evaluation = weightGoal ? evaluateGoal(weightGoal.goal.startValue, current?.weightKg, weightGoal.goal.targetValue) : null;

  return (
    <Card>
      <SectionHeader icon={<Scale className="size-4 text-accent" />} title="Peso" action={<HeaderLink to="/mais/perfil/peso">Histórico</HeaderLink>} />
      {current ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <p className="shrink-0">
              <span className="tabular font-display text-4xl font-bold">{formatNumber(current.weightKg, 1)}</span>
              <span className="text-sm text-muted"> kg</span>
            </p>
            <p className="text-right text-caption text-muted">
              {previous ? (
                <>
                  <b className="tabular text-ink">{formatSigned(current.weightKg - previous.weightKg)} kg</b> vs anterior
                  <br />
                  {formatNumber(previous.weightKg, 1)} kg · {formatRelativeDay(previous.day, today).toLowerCase()}
                </>
              ) : (
                <>Primeira pesagem · {formatRelativeDay(current.day, today).toLowerCase()}</>
              )}
            </p>
          </div>
          {weightGoal && (
            <div className="mt-3">
              <div className="mb-1.5 flex justify-between text-caption text-muted">
                <span>
                  Meta <b className="tabular text-ink">{formatNumber(weightGoal.goal.targetValue, 1)} kg</b>
                </span>
                {evaluation?.ok && <span className="tabular">{Math.round(evaluation.ratio * 100)}%</span>}
              </div>
              {evaluation?.ok && <ProgressBar ratio={evaluation.ratio} label="Progresso da meta de peso" />}
            </div>
          )}
        </>
      ) : (
        <p className="text-body text-muted">Registre seu peso inicial para acompanhar a evolução.</p>
      )}
      <Button variant="secondary" block className="mt-4" icon={<Plus className="size-5" />} onClick={onLog}>
        Registrar peso
      </Button>
    </Card>
  );
}

function GoalsCard({ goals }: { goals: GoalView[] }) {
  const active = goals.filter((g) => g.goal.status === 'active');
  const primary = active.find((g) => g.goal.isPrimary);
  const secondary = active.filter((g) => !g.goal.isPrimary).slice(0, 3);
  return (
    <Card>
      <SectionHeader icon={<Flag className="size-4 text-accent" />} title="Objetivos" action={<HeaderLink to="/mais/objetivos">Ver todos</HeaderLink>} />
      {active.length === 0 ? (
        <SetupPrompt text="Defina seu objetivo principal para acompanhar o progresso aqui." to="/mais/objetivos/novo" cta="Definir objetivo" />
      ) : (
        <div className="flex flex-col gap-4">
          {primary ? (
            <GoalRow view={primary} to={`/mais/objetivos/${primary.goal.id}`} prominent />
          ) : (
            <SetupPrompt text="Nenhum objetivo marcado como principal." to="/mais/objetivos" cta="Escolher principal" />
          )}
          {secondary.length > 0 ? (
            <div className="flex flex-col gap-4 border-t border-line/60 pt-4">
              {secondary.map((g) => (
                <GoalRow key={g.goal.id} view={g} to={`/mais/objetivos/${g.goal.id}`} />
              ))}
            </div>
          ) : (
            <Link to="/mais/objetivos/novo" className="flex min-h-touch items-center text-caption font-medium text-accent">
              + Adicionar objetivo secundário
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}

function WeekCard({ week, frequencyTarget, planStats }: { week: WeekSummary; frequencyTarget: number | null; planStats: WeekPlanStats | null }) {
  return (
    <Card>
      <SectionHeader icon={<CalendarCheck className="size-4 text-accent" />} title="Esta semana" />
      <div className="grid grid-cols-2 gap-3">
        <WeekStat
          label="Treinos concluídos"
          value={String(week.workoutsCompleted)}
          note={week.workoutsCompleted ? `${week.trainingDays} dia${week.trainingDays > 1 ? 's' : ''} de treino` : 'Nenhum ainda'}
        />
        {planStats ? (
          <WeekStat label="Planejados" value={String(planStats.plannedTotal)} note={`${planStats.plannedDaysDone} de ${planStats.plannedSoFar} feitos até hoje`} />
        ) : (
        <WeekStat
          label="Meta da semana"
          value={frequencyTarget === null ? '—' : String(frequencyTarget)}
          note={frequencyTarget === null ? 'Defina em Objetivos → Frequência de treino' : `${Math.max(0, frequencyTarget - week.workoutsCompleted)} restante${frequencyTarget - week.workoutsCompleted === 1 ? '' : 's'}`}
        />
        )}
      </div>
      <p className="mt-3 border-t border-line/60 pt-3 text-caption text-muted">
        {week.nutrition ? (
          <>
            Alimentação registrada em{' '}
            <b className="text-ink">
              {week.nutrition.daysLogged} de {week.nutrition.daysElapsed} dias
            </b>
          </>
        ) : (
          <>Consistência alimentar aparece após registros em pelo menos 3 dias da semana ({week.nutritionDaysLogged} até agora).</>
        )}
      </p>
    </Card>
  );
}

function WeekStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-control bg-elevated/60 p-3">
      <p className="text-caption text-muted">{label}</p>
      <p className="tabular font-display text-3xl font-bold">{value}</p>
      {note && <p className="text-xs text-faint">{note}</p>}
    </div>
  );
}

function QuickActions({ onWeight, onWater }: { onWeight: () => void; onWater: () => void }) {
  const cls =
    'pressable flex min-h-16 flex-col items-start justify-center gap-1 rounded-card border border-line/70 bg-surface p-4 text-left text-body font-semibold active:bg-elevated';
  const content = (icon: ReactNode, label: string) => (
    <>
      <span className="text-accent">{icon}</span>
      {label}
    </>
  );
  return (
    <section aria-label="Ações rápidas">
      <SectionHeader title="Ações rápidas" className="px-1" />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className={cls} onClick={onWeight}>
          {content(<Scale className="size-5" />, 'Registrar peso')}
        </button>
        <Link to="/nutricao/adicionar" className={cls}>
          {content(<UtensilsCrossed className="size-5" />, 'Adicionar alimento')}
        </Link>
        <button type="button" className={cls} onClick={onWater}>
          {content(<Droplets className="size-5" />, 'Adicionar água')}
        </button>
        <Link to="/treino" className={cls}>
          {content(<Dumbbell className="size-5" />, 'Iniciar treino')}
        </Link>
      </div>
    </section>
  );
}

function SetupPrompt({ text, to, cta }: { text: string; to: string; cta: string }) {
  return (
    <div>
      <p className="text-body text-muted">{text}</p>
      <LinkButton to={to} variant="secondary" block className="mt-3">
        {cta}
      </LinkButton>
    </div>
  );
}
