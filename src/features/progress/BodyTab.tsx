import { useState } from 'react';
import { Camera, ChevronRight, Flag, Plus, Ruler, Scale } from 'lucide-react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { RangePicker } from '@/components/charts/BarChart';
import { TimeSeriesChart, type ChartPoint } from '@/components/charts/TimeSeriesChart';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/Progress';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingScreen } from '@/components/ui/States';
import { db } from '@/data/db';
import { inRange, RANGE_LABELS, rangeStart, seriesChange, type RangeKey } from '@/domain/calc/analytics';
import { evaluateGoal } from '@/domain/calc/goals';
import { dailyWeights, movingAverage, weeklyRate } from '@/domain/calc/weight';
import { measurementKey, measurementLabel } from '@/domain/catalog';
import { WeightSheet } from '@/features/body/WeightSheet';
import { groupMeasurements } from '@/features/body/MeasurementsPage';
import { GoalRow } from '@/features/goals/GoalProgress';
import { useCompositionHistory, useGoalViews, useMeasurementHistory, useWeightHistory } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { formatShortDay, type DayKey } from '@/lib/dates';
import { formatNumber, formatSigned } from '@/lib/numbers';

const RANGES = (Object.keys(RANGE_LABELS) as RangeKey[]).map((r) => ({ value: r, label: RANGE_LABELS[r] }));

export function BodyTab() {
  const today = useToday();
  const weights = useWeightHistory();
  const goals = useGoalViews(today);
  const composition = useCompositionHistory();
  const measurements = useMeasurementHistory();
  const photoCount = useLiveQuery(() => db.progressPhotos.count(), []);
  const [range, setRange] = useState<RangeKey>('90d');
  const [weightOpen, setWeightOpen] = useState(false);
  if ([weights, goals, composition, measurements, photoCount].some((v) => v === undefined)) return <LoadingScreen />;

  const daily = dailyWeights(weights!);
  const from = rangeStart(today, range);
  const pts: ChartPoint[] = inRange(daily, from, today).map((d) => ({ day: d.day, value: d.weightKg }));
  const trend = inRange(movingAverage(daily), from, today).map((d) => ({ day: d.day, value: d.weightKg }));
  const change = seriesChange(pts);
  const current = daily[daily.length - 1];
  const weightGoal = goals!.find((g) => g.goal.kind === 'body_weight' && g.goal.status === 'active')?.goal;
  const initial = weightGoal?.startValue ?? daily[0]?.weightKg;
  const evaluation = weightGoal ? evaluateGoal(weightGoal.startValue, current?.weightKg, weightGoal.targetValue) : null;
  const rate = weeklyRate(daily);

  const active = goals!.filter((g) => g.goal.status === 'active');
  const primary = active.find((g) => g.goal.isPrimary);
  const secondary = active.filter((g) => !g.goal.isPrimary);

  return (
    <div className="flex flex-col gap-4">
      {/* Goals first: primary is the most prominent element. */}
      {primary ? (
        <Card tone="accent">
          <SectionHeader icon={<Flag className="size-4 text-accent" />} title="Objetivo principal" action={<Link to="/mais/objetivos" className="-my-2 flex min-h-touch items-center text-caption text-muted">Todos <ChevronRight className="size-4" /></Link>} />
          <GoalRow view={primary} to={`/mais/objetivos/${primary.goal.id}`} prominent />
          {secondary.length > 0 && (
            <div className="mt-4 flex flex-col gap-4 border-t border-line/60 pt-4">
              {secondary.map((g) => (
                <GoalRow key={g.goal.id} view={g} to={`/mais/objetivos/${g.goal.id}`} />
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <SectionHeader icon={<Flag className="size-4 text-accent" />} title="Objetivos" />
          <p className="text-body text-muted">Nenhum objetivo principal ativo. Defina um para acompanhar o progresso aqui.</p>
          <LinkButton to="/mais/objetivos/novo" variant="secondary" block className="mt-3">
            Definir objetivo
          </LinkButton>
        </Card>
      )}

      <Card>
        <SectionHeader icon={<Scale className="size-4 text-accent" />} title="Peso corporal" action={<Link to="/mais/perfil/peso" className="-my-2 flex min-h-touch items-center text-caption text-muted">Histórico <ChevronRight className="size-4" /></Link>} />
        {current ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Fact label="Atual" value={`${formatNumber(current.weightKg, 1)} kg`} note={formatShortDay(current.day)} big />
              <Fact label="Inicial" value={initial !== undefined ? `${formatNumber(initial, 1)} kg` : '—'} />
              <Fact label="Meta" value={weightGoal ? `${formatNumber(weightGoal.targetValue, 1)} kg` : '—'} />
              <Fact label="Desde o início" value={initial !== undefined ? `${formatSigned(current.weightKg - initial)} kg` : '—'} />
              <Fact label={`Em ${RANGE_LABELS[range]}`} value={change ? `${formatSigned(change.delta)} kg` : '—'} note={change ? undefined : 'poucos dados'} />
              <Fact label="Tendência" value={rate !== null ? `${formatSigned(rate, 2)} kg/sem` : '—'} note={rate === null ? 'poucos dados' : 'últimas 3 sem.'} />
            </div>
            {evaluation?.ok && (
              <div className="mt-3">
                <div className="mb-1 flex justify-between text-caption text-muted">
                  <span>Progresso da meta</span>
                  <span className="tabular text-ink">{Math.round(evaluation.ratio * 100)}%</span>
                </div>
                <ProgressBar ratio={evaluation.ratio} label="Progresso da meta de peso" />
              </div>
            )}
            <div className="mt-4">
              <RangePicker label="Período" value={range} onChange={setRange} options={RANGES} />
            </div>
            <div className="mt-3">
              {pts.length >= 2 ? (
                <TimeSeriesChart points={pts} trend={trend} target={weightGoal?.targetValue} from={from ?? pts[0]!.day} to={today} label="Gráfico de peso corporal" />
              ) : (
                <p className="rounded-control bg-elevated/60 p-4 text-caption text-muted">Registre pelo menos 2 pesagens em {RANGE_LABELS[range].toLowerCase()} para ver o gráfico. ({pts.length} no período)</p>
              )}
            </div>
            <p className="mt-2 text-xs text-faint">Pontos são pesagens reais; a linha é uma média calculada e não substitui registros. Dias sem pesagem não são preenchidos.</p>
          </>
        ) : (
          <p className="text-body text-muted">Registre seu peso para começar o acompanhamento.</p>
        )}
        <Button variant="secondary" block className="mt-4" icon={<Plus className="size-5" />} onClick={() => setWeightOpen(true)}>
          Registrar peso
        </Button>
      </Card>

      <CompositionCard composition={composition!} weights={daily} />
      <MeasurementsCard measurements={measurements!} />

      <Card>
        <SectionHeader icon={<Camera className="size-4 text-accent" />} title="Fotos de progresso" />
        <p className="text-body text-muted">{photoCount ? `${photoCount} foto${photoCount > 1 ? 's' : ''} guardada${photoCount > 1 ? 's' : ''} só neste aparelho.` : 'Fotos de frente, lado e costas para comparar a evolução. Ficam só neste aparelho.'}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <LinkButton to="/progresso/fotos" variant="secondary" size="sm">
            {photoCount ? 'Ver fotos' : 'Adicionar foto'}
          </LinkButton>
          <LinkButton to="/progresso/fotos/comparar" variant="secondary" size="sm" className={cn(photoCount! < 2 && 'pointer-events-none opacity-50')}>
            Comparar
          </LinkButton>
        </div>
      </Card>

      <WeightSheet open={weightOpen} onClose={() => setWeightOpen(false)} lastWeightKg={current?.weightKg ?? null} />
    </div>
  );
}

function Fact({ label, value, note, big }: { label: string; value: string; note?: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted">{label}</p>
      <p className={cn('tabular truncate font-semibold', big ? 'text-lg' : 'text-body')}>{value}</p>
      {note && <p className="truncate text-xs text-faint">{note}</p>}
    </div>
  );
}

function CompositionCard({ composition, weights }: { composition: NonNullable<ReturnType<typeof useCompositionHistory>>; weights: Array<{ day: DayKey; weightKg: number }> }) {
  const [metric, setMetric] = useState<'fat' | 'muscle'>('fat');
  const asc = [...composition].reverse();
  const fat = asc.filter((c) => c.bodyFatPct !== undefined).map((c) => ({ day: c.day, value: c.bodyFatPct! }));
  const muscle = asc.filter((c) => c.muscleMassKg !== undefined).map((c) => ({ day: c.day, value: c.muscleMassKg! }));
  const pts = metric === 'fat' ? fat : muscle;
  const latestFat = fat[fat.length - 1];
  // Calculated estimate: lean mass from the weigh-in closest to (on or before) the body-fat date.
  const weightAt = latestFat ? [...weights].reverse().find((w) => w.day <= latestFat.day) : undefined;
  const leanEstimate = latestFat && weightAt ? weightAt.weightKg * (1 - latestFat.value / 100) : null;
  const latest = composition[0];

  return (
    <Card>
      <SectionHeader title="Composição corporal" action={<Link to="/mais/perfil/composicao" className="-my-2 flex min-h-touch items-center text-caption text-muted">Registrar <ChevronRight className="size-4" /></Link>} />
      {composition.length === 0 ? (
        <p className="text-body text-muted">Sem avaliações. % de gordura e massa muscular aparecem aqui quando você registrar uma bioimpedância ou avaliação física.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xs:grid-cols-4">
            <Fact label="Gordura" value={latest?.bodyFatPct !== undefined ? `${formatNumber(latest.bodyFatPct, 1)}%` : '—'} note={latest ? formatShortDay(latest.day) : undefined} />
            <Fact label="Massa muscular" value={latest?.muscleMassKg !== undefined ? `${formatNumber(latest.muscleMassKg, 1)} kg` : '—'} />
            {latest?.bodyWaterPct !== undefined && <Fact label="Água corporal" value={`${formatNumber(latest.bodyWaterPct, 1)}%`} />}
            {latest?.visceralFat !== undefined && <Fact label="Visceral" value={formatNumber(latest.visceralFat, 1)} />}
          </div>
          {leanEstimate !== null && (
            <p className="mt-2 text-caption text-muted">
              Massa magra estimada: <b className="tabular text-ink">{formatNumber(leanEstimate, 1)} kg</b> <span className="text-faint">(calculada: peso × (1 − % gordura), não medida)</span>
            </p>
          )}
          <div className="mt-3">
            <RangePicker
              label="Métrica"
              value={metric}
              onChange={setMetric}
              options={[
                { value: 'fat', label: '% gordura' },
                { value: 'muscle', label: 'Massa muscular' },
              ]}
            />
          </div>
          <div className="mt-2">
            {pts.length >= 2 ? (
              <TimeSeriesChart points={pts} label={metric === 'fat' ? 'Gráfico de gordura corporal' : 'Gráfico de massa muscular'} color="var(--color-carbs)" />
            ) : (
              <p className="rounded-control bg-elevated/60 p-4 text-caption text-muted">O gráfico aparece com pelo menos 2 avaliações com este dado ({pts.length} até agora).</p>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function MeasurementsCard({ measurements }: { measurements: NonNullable<ReturnType<typeof useMeasurementHistory>> }) {
  const groups = groupMeasurements(measurements);
  const keys = [...groups.keys()];
  const [key, setKey] = useState<string | null>(null);
  const selected = key && groups.has(key) ? key : keys[0];
  const series = selected ? groups.get(selected)! : [];
  const pts = series.map((m) => ({ day: m.day, value: m.valueCm }));
  const change = seriesChange(pts);

  return (
    <Card>
      <SectionHeader icon={<Ruler className="size-4 text-accent" />} title="Medidas" action={<Link to="/mais/perfil/medidas/nova" className="-my-2 flex min-h-touch items-center text-caption text-muted">Registrar <ChevronRight className="size-4" /></Link>} />
      {keys.length === 0 ? (
        <p className="text-body text-muted">Nenhuma medida registrada. Registre cintura, braços, coxas e outras para ver a evolução.</p>
      ) : (
        <>
          <RangePicker
            label="Medida"
            value={selected!}
            onChange={setKey}
            options={keys.map((k) => {
              const first = groups.get(k)![0]!;
              return { value: k, label: measurementLabel(first.site, first.customName) };
            })}
          />
          <p className="mt-2 text-caption text-muted">
            Atual <b className="tabular text-ink">{formatNumber(series[series.length - 1]!.valueCm, 1)} cm</b>
            {change && (
              <>
                {' '}· <b className="tabular text-ink">{formatSigned(change.delta)} cm</b> desde {formatShortDay(change.from.day)}
              </>
            )}
          </p>
          <div className="mt-2">
            {pts.length >= 2 ? (
              <TimeSeriesChart points={pts} label={`Gráfico de ${measurementLabel(series[0]!.site, series[0]!.customName)}`} color="var(--color-fat)" />
            ) : (
              <p className="rounded-control bg-elevated/60 p-4 text-caption text-muted">Registre esta medida em pelo menos 2 datas para ver o gráfico.</p>
            )}
          </div>
          <Link to={`/mais/perfil/medidas/${encodeURIComponent(measurementKey(series[0]!.site, series[0]!.customName))}`} className="mt-1 flex min-h-touch items-center text-caption text-muted">
            Ver registros <ChevronRight className="size-4" />
          </Link>
        </>
      )}
    </Card>
  );
}
