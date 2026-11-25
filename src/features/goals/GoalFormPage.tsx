import { useMemo, useState } from 'react';
import { CheckCircle2, Pause, Play, Star, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ChipGroup, DateInput, Input, NumberInput, TextArea } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ErrorState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { createGoal, deleteGoal, setGoalStatus, setPrimaryGoal, updateGoal, type GoalInput } from '@/data/repos/goals';
import { GOAL_KIND_ORDER, GOAL_KINDS, MEASUREMENT_REGIONS, measurementLabel } from '@/domain/catalog';
import { evaluateGoal, goalIssueMessage } from '@/domain/calc/goals';
import { validateGoalValue, validateOptionalFutureDate, validateText } from '@/domain/validation';
import type { GoalKind, MeasurementSite } from '@/domain/models';
import { useGoalRecords, useGoalViews, type GoalView } from '@/hooks/data';
import { resolveGoalCurrent, type GoalRecords } from '@/domain/calc/goalCurrent';
import { useToday } from '@/hooks/useToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/dates';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';
import { formatGoalValue } from './GoalProgress';

const SITE_OPTIONS = [
  ...MEASUREMENT_REGIONS.flatMap((r) => r.sites.map((s) => ({ value: s.site as MeasurementSite, label: s.label }))),
  { value: 'custom' as MeasurementSite, label: 'Personalizada' },
];

export function GoalFormPage() {
  const { id } = useParams();
  const today = useToday();
  const views = useGoalViews(today);
  const records = useGoalRecords(today);
  if (views === undefined || records === undefined) return <LoadingScreen />;
  const existing = id ? views.find((v) => v.goal.id === id) : undefined;
  if (id && !existing) {
    return (
      <>
        <AppHeader title="Objetivo" back="/mais/objetivos" />
        <ErrorState title="Objetivo não encontrado" description="Ele pode ter sido excluído." />
      </>
    );
  }
  return <GoalForm key={id ?? 'new'} existing={existing} views={views} records={records} />;
}

function defaultTitle(kind: GoalKind, site?: MeasurementSite, customName?: string) {
  if (kind === 'measurement' && site) return measurementLabel(site, customName);
  if (kind === 'body_weight') return 'Peso corporal';
  return GOAL_KINDS[kind].label;
}

function GoalForm({ existing, views, records }: { existing?: GoalView; views: GoalView[]; records: GoalRecords }) {
  const today = useToday();
  const toast = useToast();
  const navigate = useNavigate();
  const g = existing?.goal;

  const [kind, setKind] = useState<GoalKind | undefined>(g?.kind);
  const [site, setSite] = useState<MeasurementSite | undefined>(g?.ref);
  const [refName, setRefName] = useState(g?.refName ?? '');
  const [title, setTitle] = useState(g?.title ?? '');
  const [titleTouched, setTitleTouched] = useState(Boolean(g));
  const [unit, setUnit] = useState(g?.unit ?? '');
  const [start, setStart] = useState(toInputValue(g?.startValue, 2));
  const [manualCurrent, setManualCurrent] = useState(toInputValue(g?.manualCurrentValue, 2));
  const [target, setTarget] = useState(toInputValue(g?.targetValue, 2));
  const [targetDate, setTargetDate] = useState(g?.targetDate ?? '');
  const [notes, setNotes] = useState(g?.notes ?? '');
  const [makePrimary, setMakePrimary] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const meta = kind ? GOAL_KINDS[kind] : null;
  const effectiveUnit = meta ? (meta.unitEditable ? unit : meta.defaultUnit) : '';
  const effectiveTitle = titleTouched ? title : kind ? defaultTitle(kind, site, refName) : '';
  const isManual = meta?.source === 'manual';

  // Current value from records, for automatic kinds (shown read-only).
  const recordCurrent = useMemo(() => {
    if (!kind || isManual) return null;
    return resolveGoalCurrent({ kind, ref: site, refName }, records);
  }, [kind, isManual, site, refName, records]);

  const startN = parseDecimal(start);
  const targetN = parseDecimal(target);
  const manualN = parseDecimal(manualCurrent);
  const weightGoalExists = !g && kind === 'body_weight' && views.some((v) => v.goal.kind === 'body_weight' && v.goal.status === 'active');

  const errors = {
    kind: !kind ? 'Escolha uma categoria.' : weightGoalExists ? 'Já existe um objetivo de peso ativo. Edite-o ou pause-o antes.' : null,
    site: kind === 'measurement' && !site ? 'Escolha a medida.' : null,
    refName: kind === 'measurement' && site === 'custom' ? validateText(refName, 'o nome da medida', 30) : null,
    title: validateText(effectiveTitle, 'o nome do objetivo', 40),
    unit: meta?.unitEditable ? validateText(unit, 'a unidade', 12) : null,
    start: validateGoalValue(startN, 'Valor inicial', false, effectiveUnit),
    current: isManual ? validateGoalValue(manualN, 'Valor atual', false, effectiveUnit) : null,
    target:
      validateGoalValue(targetN, 'Valor-alvo', true, effectiveUnit) ??
      (kind === 'consistency' && targetN !== null && (!Number.isInteger(targetN) || targetN < 1 || targetN > 14) ? 'Use um número inteiro entre 1 e 14.' : null),
    targetDate: validateOptionalFutureDate(targetDate, today),
  };
  const valid = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const currentForPreview = isManual ? manualN : (recordCurrent?.value ?? null);
  const preview = targetN !== null ? evaluateGoal(startN, currentForPreview, targetN) : null;

  const snapshot = JSON.stringify([kind, site, refName, effectiveTitle, unit, start, manualCurrent, target, targetDate, notes]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  const unsavedGuard = useUnsavedChangesGuard(dirty && !saving && !confirmDelete);

  const chooseKind = (k: GoalKind) => {
    setKind(k);
    setUnit(GOAL_KINDS[k].defaultUnit);
    if (k === 'consistency' && !start) setStart('0');
  };

  // Pre-fill the initial value with the latest record once, on creation.
  const fillStartFromRecord = () => {
    if (recordCurrent?.value !== null && recordCurrent?.value !== undefined) setStart(toInputValue(recordCurrent.value, 2));
  };

  const save = async () => {
    if (!valid || !kind || targetN === null) {
      setShowErrors(true);
      return;
    }
    const input: GoalInput = {
      kind,
      title: effectiveTitle,
      unit: effectiveUnit,
      startValue: startN ?? undefined,
      targetValue: targetN,
      manualCurrentValue: isManual ? (manualN ?? undefined) : undefined,
      targetDate: targetDate || undefined,
      notes,
      ref: site,
      refName,
    };
    setSaving(true);
    try {
      if (g) {
        await updateGoal(g.id, input);
        toast.success('Objetivo atualizado.');
      } else {
        await createGoal(input, today, { primary: makePrimary });
        toast.success('Objetivo criado.');
      }
      setSavedSnapshot(snapshot);
      navigate('/mais/objetivos');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o objetivo.');
    } finally {
      setSaving(false);
    }
  };

  const act = async (fn: () => Promise<void>, message: string) => {
    try {
      await fn();
      toast.success(message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível concluir a ação.');
    }
  };

  return (
    <>
      <AppHeader title={g ? 'Editar objetivo' : 'Novo objetivo'} back="/mais/objetivos" />
      <PageContainer className="gap-4">
        {g && (
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 text-caption text-muted">
              <span>Criado em {formatShortDay(g.startDate)}</span>
              <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', g.status === 'active' ? 'bg-accent/15 text-accent' : 'bg-elevated text-muted')}>
                {g.status === 'active' ? (g.isPrimary ? 'Principal' : 'Ativo') : g.status === 'paused' ? 'Pausado' : 'Concluído'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {g.status === 'active' && !g.isPrimary && (
                <Button variant="secondary" size="sm" icon={<Star className="size-4" />} onClick={() => act(() => setPrimaryGoal(g.id), 'Agora é o objetivo principal.')}>
                  Tornar principal
                </Button>
              )}
              {g.status === 'active' && (
                <Button variant="secondary" size="sm" icon={<Pause className="size-4" />} onClick={() => act(() => setGoalStatus(g.id, 'paused'), 'Objetivo pausado.')}>
                  Pausar
                </Button>
              )}
              {g.status !== 'active' && (
                <Button variant="secondary" size="sm" icon={<Play className="size-4" />} onClick={() => act(() => setGoalStatus(g.id, 'active'), 'Objetivo reativado.')}>
                  Reativar
                </Button>
              )}
              {g.status !== 'completed' && (
                <Button variant="secondary" size="sm" icon={<CheckCircle2 className="size-4" />} onClick={() => act(() => setGoalStatus(g.id, 'completed'), 'Objetivo concluído. Parabéns!')}>
                  Concluir
                </Button>
              )}
            </div>
          </Card>
        )}

        <Card className="flex flex-col gap-4">
          {g ? (
            <p className="text-caption text-muted">
              Categoria: <b className="text-ink">{GOAL_KINDS[g.kind].label}</b>
              {g.kind === 'measurement' && g.ref && <> · {measurementLabel(g.ref, g.refName)}</>}
            </p>
          ) : (
            <ChipGroup
              label="Categoria"
              value={kind}
              onChange={chooseKind}
              options={GOAL_KIND_ORDER.map((k) => ({ value: k, label: GOAL_KINDS[k].label }))}
              error={err('kind')}
            />
          )}
          {!g && kind === 'measurement' && (
            <>
              <ChipGroup label="Medida" value={site} onChange={setSite} options={SITE_OPTIONS} error={err('site')} />
              {site === 'custom' && <Input label="Nome da medida" value={refName} onChange={setRefName} maxLength={30} placeholder="Ex.: Ombro relaxado" error={err('refName')} />}
            </>
          )}
          {kind && (
            <Input
              label="Nome do objetivo"
              value={effectiveTitle}
              onChange={(v) => {
                setTitleTouched(true);
                setTitle(v);
              }}
              maxLength={40}
              placeholder={meta?.example}
              error={err('title')}
            />
          )}
          {meta?.unitEditable && <Input label="Unidade" value={unit} onChange={setUnit} maxLength={12} placeholder="kg, reps, min, km…" error={err('unit')} hint={`Exemplo: ${meta.example}`} />}
        </Card>

        {kind && (
          <Card className="flex flex-col gap-4">
            <SectionHeader title="Valores" className="mb-0" />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Valor inicial" suffix={effectiveUnit} value={start} onChange={setStart} error={err('start')} />
              <NumberInput label="Valor-alvo" suffix={effectiveUnit} value={target} onChange={setTarget} error={err('target')} decimal={kind !== 'consistency'} />
            </div>
            {isManual ? (
              <NumberInput label="Valor atual" suffix={effectiveUnit} value={manualCurrent} onChange={setManualCurrent} error={err('current')} hint="Atualize sempre que bater uma marca nova." />
            ) : (
              <div className="rounded-control bg-elevated/60 p-3 text-caption text-muted">
                {kind === 'consistency' ? (
                  <>Valor atual: treinos concluídos nesta semana (<b className="text-ink">{formatNumber(recordCurrent?.value ?? 0)}</b>).</>
                ) : recordCurrent?.value !== null && recordCurrent?.value !== undefined ? (
                  <>
                    Valor atual vem do último registro: <b className="tabular text-ink">{formatGoalValue(recordCurrent.value, effectiveUnit)}</b>
                    {recordCurrent.day && <> ({formatShortDay(recordCurrent.day)})</>}.
                    {!g && !start && (
                      <button type="button" className="ml-1 font-medium text-accent" onClick={fillStartFromRecord}>
                        Usar como inicial
                      </button>
                    )}
                  </>
                ) : (
                  <>Sem registros ainda. O valor atual aparece quando você registrar {kind === 'body_weight' ? 'uma pesagem' : kind === 'measurement' ? 'esta medida' : 'uma avaliação de composição'}.</>
                )}
              </div>
            )}
            <DateInput label="Data-alvo (opcional)" value={targetDate} onChange={setTargetDate} min={today} error={err('targetDate')} />
            {preview && !preview.ok && targetN !== null && <p className="text-caption text-faint">{goalIssueMessage(preview.issue)}</p>}
            {preview?.ok && (
              <p className="text-caption text-muted">
                Progresso atual: <b className="text-ink">{Math.round(preview.ratio * 100)}%</b> ({preview.direction === 'increase' ? 'aumentar' : 'reduzir'} de {formatGoalValue(preview.start, effectiveUnit)} para {formatGoalValue(preview.target, effectiveUnit)})
              </p>
            )}
          </Card>
        )}

        {kind && (
          <Card className="flex flex-col gap-4">
            <TextArea label="Notas (opcional)" value={notes} onChange={setNotes} maxLength={300} />
            {!g && (
              <button
                type="button"
                role="switch"
                aria-checked={makePrimary}
                onClick={() => setMakePrimary(!makePrimary)}
                className="flex min-h-touch items-center justify-between gap-3 text-left text-body"
              >
                <span>
                  Definir como objetivo principal
                  <span className="block text-caption text-muted">Aparece em destaque no Início.</span>
                </span>
                <span className={cn('flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-fast', makePrimary ? 'bg-accent' : 'bg-line')}>
                  <span className={cn('size-6 rounded-full bg-ink transition-transform duration-fast', makePrimary && 'translate-x-5')} />
                </span>
              </button>
            )}
          </Card>
        )}

        <Button size="lg" block loading={saving} disabled={!kind || (Boolean(g) && !dirty)} onClick={save}>
          {g ? (dirty ? 'Salvar alterações' : 'Tudo salvo') : 'Criar objetivo'}
        </Button>
        {g && (
          <Button variant="danger" block icon={<Trash2 className="size-5" />} onClick={() => setConfirmDelete(true)}>
            Excluir objetivo
          </Button>
        )}
      </PageContainer>
      {unsavedGuard}
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir objetivo?"
        description="O objetivo será removido. Seus registros de peso, medidas e composição continuam salvos."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (!g) return;
          await deleteGoal(g.id);
          toast.success('Objetivo excluído.');
          navigate('/mais/objetivos', { replace: true });
        }}
      />
    </>
  );
}
