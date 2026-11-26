import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, RangePicker } from '@/components/charts/BarChart';
import { LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { db } from '@/data/db';
import { MIN_LOGGED_DAYS, nutritionAnalytics } from '@/domain/calc/analytics';
import { useTargetForDay } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { addDays, dayRange, parseDayKey } from '@/lib/dates';
import { formatNumber } from '@/lib/numbers';

type Days = '7' | '14' | '30';

export function NutritionTab() {
  const today = useToday();
  const [days, setDays] = useState<Days>('14');
  const from = addDays(today, -(Number(days) - 1));
  const data = useLiveQuery(async () => {
    const [entries, targets] = await Promise.all([db.foodEntries.where('day').between(addDays(today, -60), today, true, true).toArray(), db.nutritionTargets.toArray()]);
    return { entries, targets };
  }, [today]);
  const target = useTargetForDay(today);
  if (data === undefined || target === undefined) return <LoadingScreen />;
  const a = nutritionAnalytics(data.entries, data.targets, from, today);

  // Weekly trend: last 4 blocks of 7 days, averages over logged days only.
  const weeks = [3, 2, 1, 0].map((i) => {
    const end = addDays(today, -7 * i);
    const start = addDays(end, -6);
    return { start, end, a: nutritionAnalytics(data.entries, data.targets, start, end) };
  });

  const range = (
    <RangePicker
      label="Período"
      value={days}
      onChange={setDays}
      options={[
        { value: '7', label: '7 dias' },
        { value: '14', label: '14 dias' },
        { value: '30', label: '30 dias' },
      ]}
    />
  );

  if (a.loggedDays === 0) {
    return (
      <div className="flex flex-col gap-4">
        {range}
        <Card>
          <EmptyState icon={<UtensilsCrossed className="size-6" />} title="Sem registros no período" description={`Médias e aderência aparecem com refeições registradas em pelo menos ${MIN_LOGGED_DAYS} dias.`} action={<LinkButton to="/nutricao/adicionar">Registrar alimento</LinkButton>} />
        </Card>
      </div>
    );
  }

  const byDay = new Map(a.days.map((d) => [d.day, d.totals.kcal]));
  const label = (d: string) => String(parseDayKey(d).getDate());

  return (
    <div className="flex flex-col gap-4">
      {range}
      <Card>
        <SectionHeader title="Médias diárias" />
        <p className="mb-3 text-caption text-muted">
          Dias com registro: <b className="text-ink">{a.loggedDays} de {a.totalDays}</b>. Médias consideram só os dias registrados.
        </p>
        {a.averages ? (
          <div className="grid grid-cols-2 gap-3">
            <Avg label="Calorias" value={`${formatNumber(a.averages.kcal)} kcal`} target={target ? `meta ${formatNumber(target.kcal)}` : undefined} />
            <Avg label="Proteína" value={`${formatNumber(a.averages.proteinG, 1)} g`} target={target ? `meta ${formatNumber(target.proteinG)} g` : undefined} />
            <Avg label="Carboidratos" value={`${formatNumber(a.averages.carbsG, 1)} g`} target={target ? `meta ${formatNumber(target.carbsG)} g` : undefined} />
            <Avg label="Gordura" value={`${formatNumber(a.averages.fatG, 1)} g`} target={target ? `meta ${formatNumber(target.fatG)} g` : undefined} />
          </div>
        ) : (
          <p className="rounded-control bg-elevated/60 p-4 text-caption text-muted">Registre refeições em pelo menos {MIN_LOGGED_DAYS} dias do período para ver as médias ({a.loggedDays} até agora).</p>
        )}
        {a.nearTarget && (
          <p className="mt-3 text-caption text-muted">
            Perto da meta calórica (±10%): <b className="text-ink">{a.nearTarget.days} de {a.nearTarget.of}</b> dias registrados.
          </p>
        )}
      </Card>

      <Card>
        <SectionHeader title="Calorias por dia" />
        <BarChart
          label="Calorias por dia"
          color="var(--color-accent)"
          reference={target?.kcal}
          bars={dayRange(from, today).map((d) => ({ key: d, label: label(d), value: byDay.get(d) ?? 0, title: byDay.has(d) ? `${d}: ${formatNumber(byDay.get(d)!)} kcal` : `${d}: sem registro` }))}
        />
        <p className="mt-2 text-xs text-faint">Barras cinza = dias sem registro (não contam como 0 kcal nas médias). Linha tracejada = meta atual.</p>
      </Card>

      <Card>
        <SectionHeader title="Tendência semanal" />
        <table className="w-full text-caption">
          <thead>
            <tr className="text-left text-muted">
              <th className="pb-2 font-medium">Semana</th>
              <th className="pb-2 text-right font-medium">Dias</th>
              <th className="pb-2 text-right font-medium">kcal</th>
              <th className="pb-2 text-right font-medium">Prot.</th>
            </tr>
          </thead>
          <tbody className="tabular">
            {weeks.map((w) => (
              <tr key={w.start} className="border-t border-line/60">
                <td className="py-2">
                  {parseDayKey(w.start).getDate()}/{parseDayKey(w.start).getMonth() + 1}–{parseDayKey(w.end).getDate()}/{parseDayKey(w.end).getMonth() + 1}
                </td>
                <td className="py-2 text-right">{w.a.loggedDays}/7</td>
                <td className="py-2 text-right">{w.a.averages ? formatNumber(w.a.averages.kcal) : '—'}</td>
                <td className="py-2 text-right">{w.a.averages ? `${formatNumber(w.a.averages.proteinG)} g` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-faint">“—” quando a semana tem menos de {MIN_LOGGED_DAYS} dias registrados.</p>
      </Card>
    </div>
  );
}

function Avg({ label, value, target }: { label: string; value: string; target?: string }) {
  return (
    <div className="rounded-control bg-elevated/60 p-3">
      <p className="text-caption text-muted">{label}</p>
      <p className="tabular text-body font-semibold">{value}</p>
      {target && <p className="text-xs text-faint">{target}</p>}
    </div>
  );
}
