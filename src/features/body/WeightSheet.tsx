import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { DateInput, Input, NumberInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { deleteWeight, DuplicateDayError, logWeight, restoreWeight, updateWeight } from '@/data/repos/body';
import { RULES, validateNumber, validateRecordDate } from '@/domain/validation';
import type { BodyWeightEntry } from '@/domain/models';
import { useToday } from '@/hooks/useToday';
import { formatShortDay } from '@/lib/dates';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';

/**
 * Record a new weigh-in (`entry` undefined) or edit/delete an existing one.
 * One weigh-in per day: recording again on the same day replaces it.
 */
export function WeightSheet({
  open,
  onClose,
  entry,
  lastWeightKg,
}: {
  open: boolean;
  onClose: () => void;
  entry?: BodyWeightEntry;
  /** Pre-fills new entries with the latest weight for faster logging. */
  lastWeightKg?: number | null;
}) {
  const today = useToday();
  const toast = useToast();
  const [day, setDay] = useState(today);
  const [weight, setWeight] = useState('');
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDay(entry?.day ?? today);
    setWeight(toInputValue(entry?.weightKg ?? lastWeightKg ?? null));
    setNote(entry?.note ?? '');
    setShowErrors(false);
  }, [open, entry, today, lastWeightKg]);

  const weightN = parseDecimal(weight);
  const errors = { weight: validateNumber(weightN, RULES.weightKg), day: validateRecordDate(day, today) };
  const valid = !errors.weight && !errors.day;

  const save = async () => {
    if (!valid || weightN === null) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      if (entry) {
        await updateWeight(entry.id, { day, weightKg: weightN, note });
        toast.success('Pesagem atualizada.');
      } else {
        const { replaced } = await logWeight({ day, weightKg: weightN, note });
        toast.success(
          replaced
            ? `Pesagem de ${day === today ? 'hoje' : formatShortDay(day)} substituída: ${formatNumber(weightN, 1)} kg.`
            : `${formatNumber(weightN, 1)} kg registrados.`,
        );
      }
      onClose();
    } catch (e) {
      if (e instanceof DuplicateDayError) toast.error(`Já existe uma pesagem em ${formatShortDay(e.day)}. Edite aquela ou escolha outra data.`);
      else {
        console.error(e);
        toast.error('Não foi possível salvar a pesagem.');
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    try {
      const removed = await deleteWeight(entry.id);
      onClose();
      toast.success('Pesagem excluída.', removed ? { label: 'Desfazer', onClick: () => void restoreWeight(removed) } : undefined);
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível excluir.');
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={entry ? 'Editar pesagem' : 'Registrar peso'}
      footer={
        <div className="flex gap-3">
          {entry && (
            <Button variant="danger" onClick={remove} aria-label="Excluir pesagem" icon={<Trash2 className="size-5" />} />
          )}
          <Button block loading={saving} onClick={save}>
            Salvar
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4 pt-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Peso" suffix="kg" value={weight} onChange={setWeight} error={showErrors ? errors.weight : null} autoFocus={!entry} />
          <DateInput label="Data" value={day} onChange={setDay} max={today} error={showErrors ? errors.day : null} />
        </div>
        <Input label="Observação (opcional)" value={note} onChange={setNote} maxLength={80} placeholder="Ex.: em jejum, após treino" />
        {!entry && <p className="text-caption text-faint">Uma pesagem por dia: registrar de novo na mesma data substitui o valor.</p>}
        <button type="submit" hidden />
      </form>
    </BottomSheet>
  );
}
