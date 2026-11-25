import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { Input, NumberInput, TextArea } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ErrorState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { lastPerformance } from '@/data/repos/sessions';
import {
  addTemplateExercise,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  moveTemplateExercise,
  removeTemplateExercise,
  updateTemplate,
  updateTemplateExercise,
} from '@/data/repos/templates';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/domain/exerciseCatalog';
import type { Exercise, TemplateExercise } from '@/domain/models';
import { validateText } from '@/domain/validation';
import { useActiveSession, useRoutines } from '@/hooks/workout';
import { formatShortDay } from '@/lib/dates';
import { parseDecimal } from '@/lib/numbers';
import { ExercisePicker } from './ExercisePicker';
import { formatPrescription, formatSetsLine } from './format';
import { useStartWorkout } from './useStartWorkout';

export function NewRoutinePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const error = validateText(name, 'o nome da rotina', 40);

  const create = async () => {
    if (error) {
      setShowErrors(true);
      return;
    }
    try {
      const t = await createTemplate({ name, description });
      navigate(`/treino/rotinas/${t.id}`, { replace: true });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível criar a rotina.');
    }
  };

  return (
    <>
      <AppHeader title="Nova rotina" back="/treino" />
      <PageContainer className="gap-4">
        <Card className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input label="Nome" value={name} onChange={setName} maxLength={40} placeholder="Ex.: Treino A, Push, Superiores" error={showErrors ? error : null} autoFocus />
            <Input label="Descrição (opcional)" value={description} onChange={setDescription} maxLength={80} placeholder="Ex.: Peito, ombros e tríceps" />
            <p className="text-caption text-faint">A rotina entra no fim da sequência. Você adiciona os exercícios na próxima tela.</p>
            <Button type="submit" size="lg" block>
              Criar e adicionar exercícios
            </Button>
          </form>
        </Card>
      </PageContainer>
    </>
  );
}

export function RoutineEditorPage() {
  const { id = '' } = useParams();
  const routines = useRoutines();
  const exercises = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  if (routines === undefined || exercises === undefined) return <LoadingScreen />;
  const summary = routines.summaries.find((s) => s.template.id === id);
  if (!summary) {
    return (
      <>
        <AppHeader title="Rotina" back="/treino" />
        <ErrorState title="Rotina não encontrada" description="Ela pode ter sido excluída." />
      </>
    );
  }
  return <RoutineEditor key={id} summary={summary} exercises={exercises} />;
}

function RoutineEditor({ summary, exercises }: { summary: NonNullable<ReturnType<typeof useRoutines>>['summaries'][number]; exercises: Map<string, Exercise> }) {
  const { template, items } = summary;
  const toast = useToast();
  const navigate = useNavigate();
  const active = useActiveSession();
  const { start, starting } = useStartWorkout();
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [notes, setNotes] = useState(template.notes ?? '');
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<TemplateExercise | null>(null);
  const [removing, setRemoving] = useState<TemplateExercise | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const nameError = validateText(name, 'o nome da rotina', 40);

  // Header fields save on blur ("salvo automaticamente").
  const saveField = async (patch: Parameters<typeof updateTemplate>[1]) => {
    try {
      await updateTemplate(template.id, patch);
    } catch {
      toast.error('Não foi possível salvar.');
    }
  };

  return (
    <>
      <AppHeader title={template.name} back="/treino" />
      <PageContainer className="gap-4">
        <Card className="flex flex-col gap-4">
          <Input label="Nome" value={name} onChange={setName} maxLength={40} error={nameError} onBlur={() => !nameError && name.trim() !== template.name && void saveField({ name })} />
          <Input label="Descrição" value={description} onChange={setDescription} maxLength={80} placeholder="Ex.: Peito, ombros e tríceps" onBlur={() => void saveField({ description })} />
          <TextArea label="Notas" value={notes} onChange={(v) => setNotes(v)} maxLength={300} rows={2} />
          {notes !== (template.notes ?? '') && (
            <Button variant="secondary" size="sm" onClick={() => void saveField({ notes }).then(() => toast.success('Notas salvas.'))}>
              Salvar notas
            </Button>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={template.active}
            onClick={() => void saveField({ active: !template.active }).then(() => toast.success(template.active ? 'Rotina fora da sequência.' : 'Rotina de volta à sequência.'))}
            className="flex min-h-touch items-center justify-between gap-3 text-left text-body"
          >
            <span>
              Ativa na sequência
              <span className="block text-caption text-muted">Inativas não são sugeridas como próximo treino.</span>
            </span>
            <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors duration-fast ${template.active ? 'bg-accent' : 'bg-line'}`}>
              <span className={`size-6 rounded-full bg-ink transition-transform duration-fast ${template.active ? 'translate-x-5' : ''}`} />
            </span>
          </button>
          <p className="text-caption text-faint">Alterações são salvas automaticamente e não mudam treinos já concluídos.</p>
        </Card>

        <section>
          <SectionHeader title={`Exercícios (${items.length})`} className="px-1" action={items.length > 0 && <span className="text-caption text-muted">~{summary.estimatedMin} min</span>} />
          <div className="flex flex-col gap-2">
            {items.map((item, i) => {
              const ex = exercises.get(item.exerciseId);
              return (
                <TemplateExerciseCard
                  key={item.id}
                  item={item}
                  exercise={ex}
                  first={i === 0}
                  last={i === items.length - 1}
                  onEdit={() => setEditing(item)}
                  onRemove={() => setRemoving(item)}
                />
              );
            })}
          </div>
          <Button variant="secondary" block className="mt-3" icon={<Plus className="size-5" />} onClick={() => setPicker(true)}>
            Adicionar exercício
          </Button>
        </section>

        {items.length > 0 && !active && (
          <Button size="lg" block loading={starting} icon={<Play className="size-5" />} onClick={() => void start(template.id)}>
            Iniciar esta rotina
          </Button>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            icon={<Copy className="size-5" />}
            onClick={async () => {
              const copy = await duplicateTemplate(template.id);
              toast.success('Rotina duplicada.');
              navigate(`/treino/rotinas/${copy.id}`);
            }}
          >
            Duplicar
          </Button>
          <Button variant="danger" icon={<Trash2 className="size-5" />} onClick={() => setConfirmDelete(true)}>
            Excluir
          </Button>
        </div>
      </PageContainer>

      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        title="Adicionar à rotina"
        onPick={async (ex) => {
          await addTemplateExercise(template.id, ex.id);
          setPicker(false);
          toast.success(`${ex.name} adicionado.`);
        }}
      />
      <PrescriptionSheet item={editing} exercise={editing ? exercises.get(editing.exerciseId) : undefined} onClose={() => setEditing(null)} />
      <ConfirmSheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Remover da rotina?"
        description={`${removing ? exercises.get(removing.exerciseId)?.name ?? 'Exercício' : ''} sai desta rotina. O histórico de treinos continua intacto.`}
        confirmLabel="Remover"
        onConfirm={async () => {
          if (removing) await removeTemplateExercise(removing.id);
          setRemoving(null);
        }}
      />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir rotina?"
        description="A rotina sai da sequência. Treinos já concluídos com ela continuam no histórico."
        confirmLabel="Excluir rotina"
        onConfirm={async () => {
          await deleteTemplate(template.id);
          toast.success('Rotina excluída.');
          navigate('/treino', { replace: true });
        }}
      />
    </>
  );
}

function TemplateExerciseCard({
  item,
  exercise,
  first,
  last,
  onEdit,
  onRemove,
}: {
  item: TemplateExercise;
  exercise?: Exercise;
  first: boolean;
  last: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const prev = useLiveQuery(() => lastPerformance(item.exerciseId), [item.exerciseId]);
  const cardio = exercise?.movementType === 'cardio';
  return (
    <Card className="py-3 pl-4 pr-1">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link to={`/treino/exercicios/${item.exerciseId}`} className="block text-body font-semibold">
            {exercise?.name ?? 'Exercício removido'}
          </Link>
          {exercise && (
            <p className="text-caption text-muted">
              {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
            </p>
          )}
          <p className="mt-1 text-sm font-medium text-ink">{formatPrescription({ sets: item.targetSets, repMin: item.repMin, repMax: item.repMax, restSec: item.restSec, cardio })}</p>
          <p className="text-caption text-faint">{prev ? `Última: ${formatSetsLine(prev.sets, cardio)} (${formatShortDay(prev.session.day)})` : 'Sem registro anterior'}</p>
          {item.notes && <p className="mt-1 text-caption text-muted">“{item.notes}”</p>}
        </div>
        <div className="flex shrink-0 flex-col">
          <IconButton label="Mover para cima" disabled={first} onClick={() => void moveTemplateExercise(item.id, -1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="Mover para baixo" disabled={last} onClick={() => void moveTemplateExercise(item.id, 1)}>
            <ArrowDown className="size-4" />
          </IconButton>
        </div>
        <div className="flex shrink-0 flex-col">
          <IconButton label="Editar séries e descanso" onClick={onEdit}>
            <Pencil className="size-4" />
          </IconButton>
          <IconButton label="Remover da rotina" onClick={onRemove}>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>
    </Card>
  );
}

function PrescriptionSheet({ item, exercise, onClose }: { item: TemplateExercise | null; exercise?: Exercise; onClose: () => void }) {
  const toast = useToast();
  const [sets, setSets] = useState('');
  const [repMin, setRepMin] = useState('');
  const [repMax, setRepMax] = useState('');
  const [rest, setRest] = useState('');
  const [notes, setNotes] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const cardio = exercise?.movementType === 'cardio';

  useEffect(() => {
    if (!item) return;
    setSets(String(item.targetSets));
    setRepMin(String(item.repMin));
    setRepMax(String(item.repMax));
    setRest(String(item.restSec));
    setNotes(item.notes ?? '');
    setShowErrors(false);
  }, [item]);

  const n = { sets: parseDecimal(sets), repMin: parseDecimal(repMin), repMax: parseDecimal(repMax), rest: parseDecimal(rest) };
  const errors = {
    sets: n.sets === null || n.sets < 1 || n.sets > 12 ? 'Entre 1 e 12.' : null,
    repMin: n.repMin === null || n.repMin < 1 || n.repMin > 300 ? 'Inválido.' : null,
    repMax: n.repMax === null || n.repMin === null || n.repMax < n.repMin || n.repMax > 300 ? 'Deve ser ≥ mínimo.' : null,
    rest: n.rest === null || n.rest < 0 || n.rest > 900 ? 'Entre 0 e 900 s.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);

  return (
    <BottomSheet
      open={item !== null}
      onClose={onClose}
      title={exercise?.name ?? 'Exercício'}
      footer={
        <Button
          block
          onClick={async () => {
            if (!item || !valid) {
              setShowErrors(true);
              return;
            }
            await updateTemplateExercise(item.id, { targetSets: n.sets!, repMin: n.repMin!, repMax: n.repMax!, restSec: n.rest!, notes });
            toast.success('Parâmetros atualizados.');
            onClose();
          }}
        >
          Salvar
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="grid grid-cols-3 gap-3">
          <NumberInput label="Séries" decimal={false} value={sets} onChange={setSets} error={showErrors ? errors.sets : null} />
          <NumberInput label={cardio ? 'Mín. (min)' : 'Reps mín.'} decimal={false} value={repMin} onChange={setRepMin} error={showErrors ? errors.repMin : null} />
          <NumberInput label={cardio ? 'Máx. (min)' : 'Reps máx.'} decimal={false} value={repMax} onChange={setRepMax} error={showErrors ? errors.repMax : null} />
        </div>
        <NumberInput label="Descanso" suffix="s" decimal={false} value={rest} onChange={setRest} error={showErrors ? errors.rest : null} hint="Usado pelo timer após cada série." />
        <Input label="Notas para esta rotina" value={notes} onChange={setNotes} maxLength={80} placeholder="Ex.: banco no 3º furo" />
      </div>
    </BottomSheet>
  );
}
