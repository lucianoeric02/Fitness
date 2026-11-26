import { useEffect, useState } from 'react';
import { Activity, Plus, Trash2 } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ChipGroup, DateInput, NumberInput } from '@/components/ui/Field';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { deleteComposition, DuplicateDayError, saveComposition } from '@/data/repos/body';
import { RULES, validateNumber, validateRecordDate } from '@/domain/validation';
import type { BodyCompositionEntry } from '@/domain/models';
import { useCompositionHistory } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { formatRelativeDay, formatShortDay } from '@/lib/dates';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';

type Method = NonNullable<BodyCompositionEntry['method']>;
const METHOD_LABELS: Record<Method, string> = { bioimpedance: 'Bioimpedância', skinfold: 'Dobras', dexa: 'DEXA', estimate: 'Estimativa' };

export function CompositionPage() {
  const today = useToday();
  const entries = useCompositionHistory();
  const [sheet, setSheet] = useState<{ open: boolean; entry?: BodyCompositionEntry }>({ open: false });
  if (entries === undefined) return <LoadingScreen />;

  return (
    <>
      <AppHeader
        title="Composição corporal"
        back="/mais/perfil"
        action={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setSheet({ open: true })}>
            Registrar
          </Button>
        }
      />
      <PageContainer>
        {entries.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Activity className="size-6" />}
              title="Nenhuma avaliação"
              description="Registre % de gordura e massa muscular de uma bioimpedância ou avaliação física."
              action={<Button onClick={() => setSheet({ open: true })}>Registrar avaliação</Button>}
            />
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line/60">
              {entries.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSheet({ open: true, entry: c })}
                    className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-fast active:bg-elevated"
                  >
                    <span>
                      <span className="block text-body font-medium">{formatRelativeDay(c.day, today)}</span>
                      {c.method && <span className="block text-caption text-muted">{METHOD_LABELS[c.method]}{c.method === 'estimate' ? ' (valor estimado)' : ''}</span>}
                    </span>
                    <span className="tabular text-right text-caption text-muted">
                      {c.bodyFatPct !== undefined && (
                        <span className="block">
                          Gordura <b className="text-body text-ink">{formatNumber(c.bodyFatPct, 1)}%</b>
                        </span>
                      )}
                      {c.muscleMassKg !== undefined && (
                        <span className="block">
                          Músculo <b className="text-body text-ink">{formatNumber(c.muscleMassKg, 1)} kg</b>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PageContainer>
      <CompositionSheet open={sheet.open} entry={sheet.entry} onClose={() => setSheet({ open: false })} />
    </>
  );
}

function CompositionSheet({ open, entry, onClose }: { open: boolean; entry?: BodyCompositionEntry; onClose: () => void }) {
  const today = useToday();
  const toast = useToast();
  const [day, setDay] = useState(today);
  const [fat, setFat] = useState('');
  const [muscle, setMuscle] = useState('');
  const [water, setWater] = useState('');
  const [visceral, setVisceral] = useState('');
  const [method, setMethod] = useState<Method | undefined>();
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDay(entry?.day ?? today);
    setFat(toInputValue(entry?.bodyFatPct));
    setMuscle(toInputValue(entry?.muscleMassKg));
    setWater(toInputValue(entry?.bodyWaterPct));
    setVisceral(toInputValue(entry?.visceralFat));
    setMethod(entry?.method);
    setShowErrors(false);
  }, [open, entry, today]);

  const fatN = parseDecimal(fat);
  const muscleN = parseDecimal(muscle);
  const waterN = parseDecimal(water);
  const visceralN = parseDecimal(visceral);
  const errors = {
    day: validateRecordDate(day, today),
    fat: validateNumber(fatN, { ...RULES.bodyFatPct, required: false }),
    muscle: validateNumber(muscleN, { ...RULES.muscleMassKg, required: false }),
    water: validateNumber(waterN, { label: 'Água corporal', min: 20, max: 80, required: false }),
    visceral: validateNumber(visceralN, { label: 'Gordura visceral', min: 1, max: 60, required: false }),
    empty: fatN === null && muscleN === null ? 'Informe gordura corporal, massa muscular ou ambos.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  const save = async () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      const { replaced } = await saveComposition({ day, bodyFatPct: fatN ?? undefined, muscleMassKg: muscleN ?? undefined, bodyWaterPct: waterN ?? undefined, visceralFat: visceralN ?? undefined, method }, entry?.id);
      toast.success(entry ? 'Avaliação atualizada.' : replaced ? `Avaliação de ${formatShortDay(day)} substituída.` : 'Avaliação registrada.');
      onClose();
    } catch (e) {
      if (e instanceof DuplicateDayError) toast.error(`Já existe uma avaliação em ${formatShortDay(e.day)}.`);
      else {
        console.error(e);
        toast.error('Não foi possível salvar.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <BottomSheet
        open={open}
        onClose={onClose}
        title={entry ? 'Editar avaliação' : 'Nova avaliação'}
        footer={
          <div className="flex gap-3">
            {entry && <Button variant="danger" aria-label="Excluir avaliação" icon={<Trash2 className="size-5" />} onClick={() => setConfirmDelete(true)} />}
            <Button block loading={saving} onClick={save}>
              Salvar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Gordura corporal" suffix="%" value={fat} onChange={setFat} error={showErrors ? errors.fat : null} />
            <NumberInput label="Massa muscular" suffix="kg" value={muscle} onChange={setMuscle} error={showErrors ? errors.muscle : null} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Água corporal (opcional)" suffix="%" value={water} onChange={setWater} error={showErrors ? errors.water : null} />
            <NumberInput label="Gordura visceral (opcional)" value={visceral} onChange={setVisceral} error={showErrors ? errors.visceral : null} hint="Nível da balança" />
          </div>
          {showErrors && errors.empty && (
            <p role="alert" className="text-caption text-danger">
              {errors.empty}
            </p>
          )}
          <DateInput label="Data" value={day} onChange={setDay} max={today} error={showErrors ? errors.day : null} />
          <ChipGroup label="Método (opcional)" value={method} onChange={setMethod} options={(Object.keys(METHOD_LABELS) as Method[]).map((m) => ({ value: m, label: METHOD_LABELS[m] }))} />
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir avaliação?"
        description="O registro será removido do histórico. Metas de gordura e massa muscular passam a usar a avaliação anterior."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!entry) return;
          await deleteComposition(entry.id);
          setConfirmDelete(false);
          onClose();
          toast.success('Avaliação excluída.');
        }}
      />
    </>
  );
}
