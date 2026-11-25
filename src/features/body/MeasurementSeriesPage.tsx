import { useEffect, useState } from 'react';
import { Ruler, Trash2 } from 'lucide-react';
import { useParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { DateInput, NumberInput } from '@/components/ui/Field';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { deleteMeasurement, DuplicateDayError, updateMeasurement } from '@/data/repos/body';
import { measurementKey, measurementLabel, parseMeasurementKey } from '@/domain/catalog';
import { RULES, validateNumber, validateRecordDate } from '@/domain/validation';
import type { MeasurementEntry } from '@/domain/models';
import { useMeasurementHistory } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { formatRelativeDay, formatShortDay } from '@/lib/dates';
import { formatNumber, formatSigned, parseDecimal, toInputValue } from '@/lib/numbers';

export function MeasurementSeriesPage() {
  const today = useToday();
  const { key = '' } = useParams();
  const entries = useMeasurementHistory();
  const [editing, setEditing] = useState<MeasurementEntry | null>(null);
  if (entries === undefined) return <LoadingScreen />;

  const parsed = parseMeasurementKey(key);
  const series = entries.filter((e) => measurementKey(e.site, e.customName) === key).reverse();
  const title = series[0] ? measurementLabel(series[0].site, series[0].customName) : measurementLabel(parsed.site, parsed.customName);

  return (
    <>
      <AppHeader title={title} back="/mais/perfil/medidas" />
      <PageContainer>
        {series.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Ruler className="size-6" />}
              title="Sem registros"
              description="Todos os registros desta medida foram excluídos."
              action={<LinkButton to="/mais/perfil/medidas/nova">Registrar medida</LinkButton>}
            />
          </Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line/60">
              {series.map((m, i) => {
                const prev = series[i + 1];
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => setEditing(m)}
                      className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-fast active:bg-elevated"
                    >
                      <span className="text-body font-medium">{formatRelativeDay(m.day, today)}</span>
                      <span className="text-right">
                        <span className="tabular block text-body font-semibold">{formatNumber(m.valueCm, 1)} cm</span>
                        {prev && <span className="tabular block text-caption text-muted">{formatSigned(m.valueCm - prev.valueCm)} cm</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </PageContainer>
      <MeasurementEditSheet entry={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function MeasurementEditSheet({ entry, onClose }: { entry: MeasurementEntry | null; onClose: () => void }) {
  const today = useToday();
  const toast = useToast();
  const [day, setDay] = useState(today);
  const [value, setValue] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setDay(entry.day);
    setValue(toInputValue(entry.valueCm));
    setShowErrors(false);
  }, [entry]);

  const valueN = parseDecimal(value);
  const errors = { day: validateRecordDate(day, today), value: validateNumber(valueN, RULES.measurementCm) };

  const save = async () => {
    if (!entry) return;
    if (errors.day || errors.value || valueN === null) {
      setShowErrors(true);
      return;
    }
    try {
      await updateMeasurement(entry.id, { day, valueCm: valueN });
      toast.success('Medida atualizada.');
      onClose();
    } catch (e) {
      if (e instanceof DuplicateDayError) toast.error(`Já existe esta medida em ${formatShortDay(e.day)}.`);
      else toast.error('Não foi possível salvar.');
    }
  };

  return (
    <>
      <BottomSheet
        open={entry !== null}
        onClose={onClose}
        title="Editar medida"
        footer={
          <div className="flex gap-3">
            <Button variant="danger" aria-label="Excluir medida" icon={<Trash2 className="size-5" />} onClick={() => setConfirmDelete(true)} />
            <Button block onClick={save}>
              Salvar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-3 pt-2">
          <NumberInput label="Valor" suffix="cm" value={value} onChange={setValue} error={showErrors ? errors.value : null} />
          <DateInput label="Data" value={day} onChange={setDay} max={today} error={showErrors ? errors.day : null} />
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir medida?"
        description="Este registro será removido do histórico."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!entry) return;
          await deleteMeasurement(entry.id);
          setConfirmDelete(false);
          onClose();
          toast.success('Medida excluída.');
        }}
      />
    </>
  );
}
