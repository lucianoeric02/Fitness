import { useState } from 'react';
import { Plus, Scale } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import type { BodyWeightEntry } from '@/domain/models';
import { useGoalViews, useWeightHistory } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { formatRelativeDay } from '@/lib/dates';
import { formatNumber, formatSigned } from '@/lib/numbers';
import { WeightSheet } from './WeightSheet';

export function WeightHistoryPage() {
  const today = useToday();
  const weights = useWeightHistory();
  const goals = useGoalViews(today);
  const [sheet, setSheet] = useState<{ open: boolean; entry?: BodyWeightEntry }>({ open: false });
  if (weights === undefined || goals === undefined) return <LoadingScreen />;

  const weightGoal = goals.find((g) => g.goal.kind === 'body_weight' && g.goal.status === 'active')?.goal;
  const initial = weightGoal?.startValue ?? weights[weights.length - 1]?.weightKg;

  return (
    <>
      <AppHeader
        title="Pesagens"
        back="/mais/perfil"
        action={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setSheet({ open: true })}>
            Registrar
          </Button>
        }
      />
      <PageContainer>
        {weights.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Scale className="size-6" />}
              title="Nenhuma pesagem"
              description="Registre seu peso inicial. Ele vira o ponto de partida da sua meta."
              action={<Button onClick={() => setSheet({ open: true })}>Registrar peso</Button>}
            />
          </Card>
        ) : (
          <>
            <Card className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-caption text-muted">Peso inicial</p>
                <p className="tabular text-lg font-semibold">{initial !== undefined ? `${formatNumber(initial, 1)} kg` : '—'}</p>
              </div>
              <div>
                <p className="text-caption text-muted">Variação total</p>
                <p className="tabular text-lg font-semibold">{initial !== undefined ? `${formatSigned(weights[0]!.weightKg - initial)} kg` : '—'}</p>
              </div>
              <p className="col-span-2 text-xs text-faint">O peso inicial é o ponto de partida da sua meta e não muda com novas pesagens.</p>
            </Card>
            <Card className="p-0">
              <ul className="divide-y divide-line/60">
                {weights.map((w, i) => {
                  const prev = weights[i + 1];
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => setSheet({ open: true, entry: w })}
                        className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-fast active:bg-elevated"
                        aria-label={`Editar pesagem de ${formatRelativeDay(w.day, today)}`}
                      >
                        <span className="min-w-0">
                          <span className="block text-body font-medium">{formatRelativeDay(w.day, today)}</span>
                          {w.note && <span className="block truncate text-caption text-muted">{w.note}</span>}
                        </span>
                        <span className="text-right">
                          <span className="tabular block text-body font-semibold">{formatNumber(w.weightKg, 1)} kg</span>
                          {prev && <span className="tabular block text-caption text-muted">{formatSigned(w.weightKg - prev.weightKg)} kg</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </PageContainer>
      <WeightSheet open={sheet.open} entry={sheet.entry} lastWeightKg={weights[0]?.weightKg} onClose={() => setSheet({ open: false })} />
    </>
  );
}
