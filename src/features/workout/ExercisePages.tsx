import { useMemo, useRef, useState } from 'react';
import { ImagePlus, Pencil, Plus, Trash2, Trophy, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ChipGroup, Input, MultiChipGroup, NumberInput, Segmented, TextArea } from '@/components/ui/Field';
import { ListGroup, ListRow } from '@/components/ui/List';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ErrorState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { createExercise, removeExercise, updateExercise, type ExerciseInput } from '@/data/repos/exercises';
import { estimateOneRepMax, personalRecords } from '@/domain/calc/workout';
import { EQUIPMENT_LABELS, LIBRARY_SECTIONS, MOVEMENT_LABELS, MUSCLE_LABELS } from '@/domain/exerciseCatalog';
import type { Equipment, Exercise, MovementType, MuscleGroup } from '@/domain/models';
import { validateText } from '@/domain/validation';
import { useExerciseHistory, useExerciseLibrary } from '@/hooks/workout';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { formatShortDay } from '@/lib/dates';
import { formatNumber, parseDecimal } from '@/lib/numbers';
import { ExercisePicker, filterExercises, SearchField, SectionChips } from './ExercisePicker';
import { formatPrescription, formatSetsLine } from './format';

export function ExerciseLibraryPage() {
  const library = useExerciseLibrary();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string | null>(null);
  const results = useMemo(() => filterExercises(library ?? [], query, section), [library, query, section]);
  if (library === undefined) return <LoadingScreen />;

  const groups = LIBRARY_SECTIONS.map((s) => ({ ...s, items: results.filter((e) => s.muscles.includes(e.primaryMuscle)) })).filter((g) => g.items.length);

  return (
    <>
      <AppHeader
        title="Exercícios"
        back="/treino"
        action={
          <LinkButton to="/treino/exercicios/novo" size="sm" icon={<Plus className="size-4" />}>
            Novo
          </LinkButton>
        }
      />
      <PageContainer className="gap-4">
        <SearchField value={query} onChange={setQuery} placeholder="Buscar exercício" />
        <SectionChips value={section} onChange={setSection} />
        {groups.length === 0 ? (
          <Card>
            <p className="py-4 text-center text-body text-muted">Nenhum exercício encontrado.</p>
            <LinkButton to="/treino/exercicios/novo" block variant="secondary">
              Criar exercício personalizado
            </LinkButton>
          </Card>
        ) : (
          groups.map((g) => (
            <ListGroup key={g.key} title={`${g.label} (${g.items.length})`}>
              {g.items.map((e) => (
                <ListRow key={e.id} title={e.name} subtitle={`${EQUIPMENT_LABELS[e.equipment]}${e.isSeed ? '' : ' · personalizado'}`} to={`/treino/exercicios/${e.id}`} />
              ))}
            </ListGroup>
          ))
        )}
      </PageContainer>
    </>
  );
}

export function ExerciseDetailPage() {
  const { id = '' } = useParams();
  const library = useExerciseLibrary();
  const history = useExerciseHistory(id);
  const toast = useToast();
  const navigate = useNavigate();
  const [confirmRemove, setConfirmRemove] = useState(false);
  if (library === undefined || history === undefined) return <LoadingScreen />;
  const ex = library.find((e) => e.id === id);
  if (!ex) {
    return (
      <>
        <AppHeader title="Exercício" back="/treino/exercicios" />
        <ErrorState title="Exercício não encontrado" description="Ele pode ter sido removido." />
      </>
    );
  }
  const cardio = ex.movementType === 'cardio';
  const allSets = history.flatMap((h) => h.sets);
  const pr = personalRecords(allSets);
  const last = history[0];
  const alternatives = ex.alternativeIds.map((aid) => library.find((e) => e.id === aid)).filter((e): e is Exercise => Boolean(e) && !e!.archivedAt);

  return (
    <>
      <AppHeader
        title={ex.name}
        back="/treino/exercicios"
        action={
          <LinkButton to={`/treino/exercicios/${ex.id}/editar`} size="sm" variant="secondary" icon={<Pencil className="size-4" />}>
            Editar
          </LinkButton>
        }
      />
      <PageContainer className="gap-4">
        {ex.archivedAt && <Card tone="elevated" className="text-caption text-muted">Exercício arquivado: não aparece na biblioteca, mas o histórico continua disponível.</Card>}
        {ex.imageDataUrl && <img src={ex.imageDataUrl} alt={ex.name} className="max-h-64 w-full rounded-card object-cover" />}
        <Card>
          <p className="text-caption text-muted">
            {MUSCLE_LABELS[ex.primaryMuscle]}
            {ex.secondaryMuscles.length > 0 && ` + ${ex.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(', ')}`}
          </p>
          <p className="text-caption text-muted">
            {EQUIPMENT_LABELS[ex.equipment]} · {MOVEMENT_LABELS[ex.movementType]}
          </p>
          <p className="mt-2 text-body font-medium">Padrão: {formatPrescription({ sets: ex.defaultSets, repMin: ex.repMin, repMax: ex.repMax, restSec: ex.restSec, cardio })}</p>
          {ex.instructions && <p className="mt-3 text-body text-muted">{ex.instructions}</p>}
          {ex.notes && <p className="mt-2 text-caption text-faint">Nota: {ex.notes}</p>}
        </Card>

        <Card>
          <SectionHeader icon={<Trophy className="size-4 text-accent" />} title="Desempenho" />
          {!last ? (
            <p className="text-body text-muted">Sem registros ainda. O histórico aparece depois do primeiro treino com este exercício.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-caption text-muted">Última sessão · {formatShortDay(last.session.day)}</p>
                <p className="text-body font-semibold">{formatSetsLine(last.sets, cardio)}</p>
              </div>
              {!cardio && (
                <div className="grid grid-cols-1 gap-3 xs:grid-cols-3">
                  <Record label="Maior carga" value={pr.heaviest ? `${formatNumber(pr.heaviest.weightKg, 2)} kg × ${pr.heaviest.reps}` : '—'} />
                  <Record label="Melhor 1RM est." value={pr.bestE1rm ? `${formatNumber(pr.bestE1rm.e1rm, 1)} kg` : '—'} note={pr.bestE1rm ? `${formatNumber(pr.bestE1rm.weightKg, 2)} kg × ${pr.bestE1rm.reps}` : undefined} />
                  <Record label="Mais reps" value={pr.mostReps ? `${pr.mostReps.reps} reps` : '—'} note={pr.mostReps ? `com ${formatNumber(pr.mostReps.weightKg, 2)} kg` : undefined} />
                </div>
              )}
              {!cardio && <p className="text-xs text-faint">1RM estimado pela fórmula de Epley: carga × (1 + reps ÷ 30). É uma estimativa, não um teste de carga máxima.</p>}
            </div>
          )}
        </Card>

        {history.length > 0 && (
          <Card>
            <SectionHeader title="Histórico" />
            <ul className="flex flex-col gap-3">
              {history.slice(0, 12).map((h) => {
                const best = !cardio ? h.sets.reduce((b, s) => Math.max(b, estimateOneRepMax(s.weightKg, s.reps)), 0) : 0;
                return (
                  <li key={h.session.id} className="flex justify-between gap-3 text-caption">
                    <span>
                      <span className="block text-body text-ink">{formatShortDay(h.session.day)}</span>
                      <span className="text-muted">{formatSetsLine(h.sets, cardio)}</span>
                    </span>
                    {best > 0 && <span className="tabular shrink-0 text-muted">1RM ~{formatNumber(best, 1)}</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        {alternatives.length > 0 && (
          <ListGroup title="Alternativas">
            {alternatives.map((a) => (
              <ListRow key={a.id} title={a.name} subtitle={EQUIPMENT_LABELS[a.equipment]} to={`/treino/exercicios/${a.id}`} />
            ))}
          </ListGroup>
        )}

        {!ex.archivedAt && (
          <Button variant="danger" block icon={<Trash2 className="size-5" />} onClick={() => setConfirmRemove(true)}>
            Remover exercício
          </Button>
        )}
      </PageContainer>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remover exercício?"
        description="Se ele estiver em rotinas ou no histórico, será apenas arquivado: some da biblioteca, mas os treinos antigos continuam intactos."
        confirmLabel="Remover"
        onConfirm={async () => {
          const result = await removeExercise(ex.id);
          toast.success(result === 'archived' ? 'Exercício arquivado (está em uso no histórico ou em rotinas).' : 'Exercício removido.');
          navigate('/treino/exercicios', { replace: true });
        }}
      />
    </>
  );
}

function Record({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-control bg-elevated/60 p-3">
      <p className="text-caption text-muted">{label}</p>
      <p className="tabular text-body font-semibold">{value}</p>
      {note && <p className="text-xs text-faint">{note}</p>}
    </div>
  );
}

const MUSCLE_OPTIONS = (Object.keys(MUSCLE_LABELS) as MuscleGroup[]).map((m) => ({ value: m, label: MUSCLE_LABELS[m] }));
const EQUIPMENT_OPTIONS = (Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((e) => ({ value: e, label: EQUIPMENT_LABELS[e] }));

/** Resizes an image file to a compact JPEG data URL (kept locally). */
async function imageToDataUrl(file: File, max = 640): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ExerciseFormPage() {
  const { id } = useParams();
  const library = useExerciseLibrary();
  if (library === undefined) return <LoadingScreen />;
  const existing = id ? library.find((e) => e.id === id) : undefined;
  if (id && !existing) {
    return (
      <>
        <AppHeader title="Exercício" back="/treino/exercicios" />
        <ErrorState title="Exercício não encontrado" />
      </>
    );
  }
  return <ExerciseForm key={id ?? 'new'} existing={existing} library={library} />;
}

function ExerciseForm({ existing, library }: { existing?: Exercise; library: Exercise[] }) {
  const toast = useToast();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(existing?.name ?? '');
  const [primary, setPrimary] = useState<MuscleGroup | undefined>(existing?.primaryMuscle);
  const [secondary, setSecondary] = useState<MuscleGroup[]>(existing?.secondaryMuscles ?? []);
  const [equipment, setEquipment] = useState<Equipment | undefined>(existing?.equipment);
  const [movement, setMovement] = useState<MovementType>(existing?.movementType ?? 'compound');
  const [sets, setSets] = useState(String(existing?.defaultSets ?? 3));
  const [repMin, setRepMin] = useState(String(existing?.repMin ?? 8));
  const [repMax, setRepMax] = useState(String(existing?.repMax ?? 12));
  const [rest, setRest] = useState(String(existing?.restSec ?? 90));
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [image, setImage] = useState(existing?.imageDataUrl);
  const [alternatives, setAlternatives] = useState<string[]>(existing?.alternativeIds ?? []);
  const [altPicker, setAltPicker] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const snapshot = JSON.stringify([name, primary, secondary, equipment, movement, sets, repMin, repMax, rest, instructions, notes, image?.length, alternatives]);
  const [saved, setSaved] = useState(snapshot);
  const guard = useUnsavedChangesGuard(snapshot !== saved && !saving);

  const n = { sets: parseDecimal(sets), repMin: parseDecimal(repMin), repMax: parseDecimal(repMax), rest: parseDecimal(rest) };
  const duplicate = library.some((e) => e.id !== existing?.id && !e.archivedAt && e.name.trim().toLowerCase() === name.trim().toLowerCase());
  const errors = {
    name: validateText(name, 'o nome', 50) ?? (duplicate ? 'Já existe um exercício com este nome.' : null),
    primary: primary ? null : 'Escolha o músculo principal.',
    equipment: equipment ? null : 'Escolha o equipamento.',
    sets: n.sets === null || !Number.isInteger(n.sets) || n.sets < 1 || n.sets > 12 ? 'Entre 1 e 12.' : null,
    repMin: n.repMin === null || n.repMin < 1 || n.repMin > 300 ? 'Inválido.' : null,
    repMax: n.repMax === null || n.repMin === null || n.repMax < n.repMin || n.repMax > 300 ? 'Deve ser ≥ mínimo.' : null,
    rest: n.rest === null || n.rest < 0 || n.rest > 900 ? 'Entre 0 e 900 s.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    if (!valid) {
      setShowErrors(true);
      toast.error('Revise os campos destacados.');
      return;
    }
    const input: ExerciseInput = {
      name,
      primaryMuscle: primary!,
      secondaryMuscles: secondary,
      equipment: equipment!,
      movementType: movement,
      instructions,
      notes,
      imageDataUrl: image,
      defaultSets: n.sets!,
      repMin: n.repMin!,
      repMax: n.repMax!,
      restSec: n.rest!,
      alternativeIds: alternatives,
    };
    setSaving(true);
    try {
      if (existing) await updateExercise(existing.id, input);
      const created = existing ? null : await createExercise(input);
      setSaved(snapshot);
      toast.success(existing ? 'Exercício atualizado. Treinos antigos mantêm o nome da época.' : 'Exercício criado.');
      navigate(`/treino/exercicios/${existing?.id ?? created!.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const altNames = alternatives.map((a) => library.find((e) => e.id === a)).filter((e): e is Exercise => Boolean(e));

  return (
    <>
      <AppHeader title={existing ? 'Editar exercício' : 'Novo exercício'} back={existing ? `/treino/exercicios/${existing.id}` : '/treino/exercicios'} />
      <PageContainer className="gap-4">
        <Card className="flex flex-col gap-4">
          <Input label="Nome" value={name} onChange={setName} maxLength={50} placeholder="Ex.: Supino inclinado na máquina" error={err('name')} />
          <ChipGroup label="Músculo principal" value={primary} onChange={setPrimary} options={MUSCLE_OPTIONS} error={err('primary')} />
          <MultiChipGroup label="Músculos secundários (opcional)" value={secondary} onChange={setSecondary} options={MUSCLE_OPTIONS.filter((o) => o.value !== primary)} />
          <ChipGroup label="Equipamento" value={equipment} onChange={setEquipment} options={EQUIPMENT_OPTIONS} error={err('equipment')} />
          <Segmented
            label="Tipo de movimento"
            value={movement}
            onChange={setMovement}
            options={(Object.keys(MOVEMENT_LABELS) as MovementType[]).map((m) => ({ value: m, label: MOVEMENT_LABELS[m] }))}
          />
        </Card>
        <Card className="flex flex-col gap-4">
          <SectionHeader title="Padrão ao adicionar em rotinas" className="mb-0" />
          <div className="grid grid-cols-3 gap-3">
            <NumberInput label="Séries" decimal={false} value={sets} onChange={setSets} error={err('sets')} />
            <NumberInput label={movement === 'cardio' ? 'Mín. (min)' : 'Reps mín.'} decimal={false} value={repMin} onChange={setRepMin} error={err('repMin')} />
            <NumberInput label={movement === 'cardio' ? 'Máx. (min)' : 'Reps máx.'} decimal={false} value={repMax} onChange={setRepMax} error={err('repMax')} />
          </div>
          <NumberInput label="Descanso" suffix="s" decimal={false} value={rest} onChange={setRest} error={err('rest')} />
        </Card>
        <Card className="flex flex-col gap-4">
          <TextArea label="Instruções (opcional)" value={instructions} onChange={setInstructions} maxLength={400} />
          <Input label="Notas (opcional)" value={notes} onChange={setNotes} maxLength={120} />
          <div className="flex flex-col gap-2">
            <span className="text-caption font-medium text-muted">Imagem (opcional, fica só no aparelho)</span>
            {image ? (
              <div className="relative">
                <img src={image} alt="" className="max-h-48 w-full rounded-control object-cover" />
                <IconButton label="Remover imagem" className="absolute right-2 top-2 bg-bg/80 text-ink" onClick={() => setImage(undefined)}>
                  <X className="size-5" />
                </IconButton>
              </div>
            ) : (
              <Button variant="secondary" icon={<ImagePlus className="size-5" />} onClick={() => fileRef.current?.click()}>
                Escolher imagem
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                try {
                  setImage(await imageToDataUrl(f));
                } catch {
                  toast.error('Não foi possível ler a imagem.');
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-caption font-medium text-muted">Exercícios alternativos (sugeridos ao substituir)</span>
            <div className="flex flex-wrap gap-2">
              {altNames.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAlternatives((prev) => prev.filter((x) => x !== a.id))}
                  className="flex min-h-10 items-center gap-1 rounded-full border border-line bg-elevated pl-4 pr-2 text-sm"
                  aria-label={`Remover alternativa ${a.name}`}
                >
                  {a.name} <X className="size-4 text-muted" />
                </button>
              ))}
              <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setAltPicker(true)}>
                Adicionar
              </Button>
            </div>
          </div>
        </Card>
        <Button size="lg" block loading={saving} onClick={save}>
          {existing ? 'Salvar exercício' : 'Criar exercício'}
        </Button>
      </PageContainer>
      <ExercisePicker
        open={altPicker}
        onClose={() => setAltPicker(false)}
        title="Escolher alternativa"
        excludeIds={[...(existing ? [existing.id] : []), ...alternatives]}
        onPick={(e) => {
          setAlternatives((prev) => [...prev, e.id]);
          setAltPicker(false);
        }}
      />
      {guard}
    </>
  );
}
