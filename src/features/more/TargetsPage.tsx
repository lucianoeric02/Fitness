import { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { DEFAULT_TARGETS, setTargetsFrom } from '@/data/repos/targets';
import type { NutritionTarget } from '@/domain/models';
import { useTargetForDay, useTargetHistory, useWeightSummary } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { formatShortDay, type DayKey } from '@/lib/dates';
import { formatNumber } from '@/lib/numbers';
import { parseTargetsDraft, TargetsForm, targetsToDraft } from './TargetsForm';

export function TargetsPage() {
  const today = useToday();
  const current = useTargetForDay(today);
  const history = useTargetHistory();
  const weight = useWeightSummary();
  if (current === undefined || history === undefined || weight === undefined) return <LoadingScreen />;
  return <TargetsEditor key={current?.id ?? 'none'} today={today} current={current} history={history} bodyWeightKg={weight.latest?.weightKg ?? null} />;
}

function TargetsEditor({
  today,
  current,
  history,
  bodyWeightKg,
}: {
  today: DayKey;
  current: NutritionTarget | null;
  history: NutritionTarget[];
  bodyWeightKg: number | null;
}) {
  const toast = useToast();
  const initial = targetsToDraft(current ?? DEFAULT_TARGETS);
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== saved;
  const unsavedGuard = useUnsavedChangesGuard(dirty && !saving);

  const save = async () => {
    const { values } = parseTargetsDraft(draft);
    if (!values) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await setTargetsFrom(today, values);
      setSaved(JSON.stringify(draft));
      toast.success('Metas atualizadas a partir de hoje.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar as metas.');
    } finally {
      setSaving(false);
    }
  };

  const past = [...history].reverse();

  return (
    <>
      <AppHeader title="Metas diárias" back="/mais" />
      <PageContainer className="gap-4">
        <Card>
          <TargetsForm draft={draft} onChange={setDraft} showErrors={showErrors} bodyWeightKg={bodyWeightKg} />
          <p className="mt-4 text-caption text-muted">
            Alterações valem a partir de hoje. Dias anteriores mantêm as metas que estavam em vigor.
          </p>
        </Card>

        <Button size="lg" block loading={saving} disabled={!dirty} onClick={save}>
          {dirty ? 'Salvar metas' : 'Metas em vigor'}
        </Button>

        {past.length > 1 && (
          <Card>
            <SectionHeader icon={<History className="size-4" />} title="Histórico" />
            <ul className="divide-y divide-line/60">
              {past.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted">desde {formatShortDay(t.effectiveFrom)}</span>
                  <span className="tabular">
                    <b>{formatNumber(t.kcal)}</b> kcal · {formatNumber(t.proteinG)}P · {formatNumber(t.carbsG)}C · {formatNumber(t.fatG)}G
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PageContainer>
      {unsavedGuard}
    </>
  );
}
