import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DateInput, Input, NumberInput } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useToast } from '@/components/ui/Toast';
import { saveMeasurements, type MeasurementValue } from '@/data/repos/body';
import { MEASUREMENT_REGIONS } from '@/domain/catalog';
import { RULES, validateNumber, validateRecordDate, validateText } from '@/domain/validation';
import type { MeasurementSite } from '@/domain/models';
import { useToday } from '@/hooks/useToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { newId } from '@/lib/ids';
import { parseDecimal } from '@/lib/numbers';

interface CustomRow {
  id: string;
  name: string;
  value: string;
}

/** Record any subset of measurements for one date. Empty fields are skipped. */
export function MeasurementFormPage() {
  const today = useToday();
  const toast = useToast();
  const navigate = useNavigate();
  const [day, setDay] = useState(today);
  const [values, setValues] = useState<Partial<Record<MeasurementSite, string>>>({});
  const [custom, setCustom] = useState<CustomRow[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const filled = Object.values(values).some((v) => v?.trim()) || custom.some((c) => c.name.trim() || c.value.trim());
  const unsavedGuard = useUnsavedChangesGuard(filled && !saving);

  const siteErrors = Object.fromEntries(
    Object.entries(values)
      .filter(([, v]) => v?.trim())
      .map(([site, v]) => [site, validateNumber(parseDecimal(v!), RULES.measurementCm)]),
  ) as Partial<Record<MeasurementSite, string | null>>;
  const customErrors = custom.map((c) => ({
    name: validateText(c.name, 'o nome da medida', 30),
    value: validateNumber(parseDecimal(c.value), RULES.measurementCm),
  }));
  const dayError = validateRecordDate(day, today);
  const hasErrors = Boolean(dayError) || Object.values(siteErrors).some(Boolean) || customErrors.some((e) => e.name || e.value);

  const save = async () => {
    if (!filled) {
      toast.info('Preencha pelo menos uma medida.');
      return;
    }
    if (hasErrors) {
      setShowErrors(true);
      toast.error('Revise os campos destacados.');
      return;
    }
    const list: MeasurementValue[] = [
      ...Object.entries(values)
        .filter(([, v]) => v?.trim())
        .map(([site, v]) => ({ site: site as MeasurementSite, valueCm: parseDecimal(v!)! })),
      ...custom.map((c) => ({ site: 'custom' as const, customName: c.name, valueCm: parseDecimal(c.value)! })),
    ];
    setSaving(true);
    try {
      const { saved, replaced } = await saveMeasurements(day, list);
      toast.success(`${saved} medida${saved > 1 ? 's' : ''} salva${saved > 1 ? 's' : ''}${replaced ? ` (${replaced} substituída${replaced > 1 ? 's' : ''})` : ''}.`);
      setValues({});
      setCustom([]);
      navigate('/mais/perfil/medidas');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar as medidas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppHeader title="Registrar medidas" back="/mais/perfil/medidas" />
      <PageContainer className="gap-4">
        <Card>
          <DateInput label="Data da medição" value={day} onChange={setDay} max={today} error={showErrors ? dayError : null} hint="Preencha só o que mediu. Mesma medida na mesma data substitui a anterior." />
        </Card>
        <Card className="flex flex-col gap-4">
          <SectionHeader title="Medidas (cm)" className="mb-0" />
          {MEASUREMENT_REGIONS.map((region) => (
            <div key={region.label} className={region.sites.length > 1 ? 'grid grid-cols-2 gap-3' : undefined}>
              {region.sites.map(({ site, label }) => (
                <NumberInput
                  key={site}
                  label={label}
                  suffix="cm"
                  value={values[site] ?? ''}
                  onChange={(v) => setValues((prev) => ({ ...prev, [site]: v }))}
                  error={showErrors ? (siteErrors[site] ?? null) : null}
                />
              ))}
            </div>
          ))}
        </Card>
        <Card className="flex flex-col gap-4">
          <SectionHeader title="Personalizadas" className="mb-0" />
          {custom.map((c, i) => (
            <div key={c.id} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-2 gap-3">
                <Input
                  label="Nome"
                  value={c.name}
                  maxLength={30}
                  placeholder="Ex.: Ombro"
                  onChange={(v) => setCustom((prev) => prev.map((x) => (x.id === c.id ? { ...x, name: v } : x)))}
                  error={showErrors ? customErrors[i]?.name : null}
                />
                <NumberInput
                  label="Valor"
                  suffix="cm"
                  value={c.value}
                  onChange={(v) => setCustom((prev) => prev.map((x) => (x.id === c.id ? { ...x, value: v } : x)))}
                  error={showErrors ? customErrors[i]?.value : null}
                />
              </div>
              <IconButton label="Remover medida personalizada" className="mt-7" onClick={() => setCustom((prev) => prev.filter((x) => x.id !== c.id))}>
                <X className="size-5" />
              </IconButton>
            </div>
          ))}
          <Button variant="secondary" icon={<Plus className="size-5" />} onClick={() => setCustom((prev) => [...prev, { id: newId(), name: '', value: '' }])}>
            Adicionar medida personalizada
          </Button>
        </Card>
        <Button size="lg" block loading={saving} onClick={save}>
          Salvar medidas
        </Button>
      </PageContainer>
      {unsavedGuard}
    </>
  );
}
