import { useEffect, useState } from 'react';
import { Check, ChevronDown, Dumbbell, NotebookPen, Pause, Play, Plus, Repeat, SkipForward, Trash2, Undo2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ChipGroup, Input, NumberInput, TextArea } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import {
  addSessionExercise,
  addSet,
  cancelSession,
  completeSet,
  deleteSet,
  finishSession,
  lastPerformance,
  pauseSession,
  resumeSession,
  setExerciseNotes,
  setExerciseSkipped,
  substituteExercise,
  uncompleteSet,
  updateSet,
} from '@/data/repos/sessions';
import { swapTemplateExercise } from '@/data/repos/templates';
import { activeDurationMs, sessionStats } from '@/domain/calc/workout';
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from '@/domain/exerciseCatalog';
import type { Exercise, SessionExercise, SetRecord, WorkoutSession } from '@/domain/models';
import { useActiveSession, useSessionDetail } from '@/hooks/workout';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';
import { formatShortDay } from '@/lib/dates';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';
import { ExercisePicker } from './ExercisePicker';
import { formatElapsed, formatPrescription, formatSetsLine } from './format';

export function ActiveSessionPage() {
  const active = useActiveSession();
  const detail = useSessionDetail(active?.id);
  if (active === undefined || (active && detail === undefined)) return <LoadingScreen />;
  if (!active || !detail) {
    return (
      <>
        <AppHeader title="Treino" back="/treino" />
        <PageContainer>
          <Card>
            <EmptyState
              icon={<Dumbbell className="size-6" />}
              title="Nenhum treino em andamento"
              description="Escolha uma rotina e toque em Iniciar treino."
              action={<LinkButton to="/treino">Ver rotinas</LinkButton>}
            />
          </Card>
        </PageContainer>
      </>
    );
  }
  return <ActiveSession detail={detail} />;
}

type Detail = NonNullable<ReturnType<typeof useSessionDetail>>;

function ActiveSession({ detail }: { detail: Detail }) {
  const { session, items, sets, exercises } = detail;
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow(true, 1000);
  const stats = sessionStats(items, sets);
  const paused = Boolean(session.pausedAt);

  const current = items.find((e) => !e.skipped && sets.some((s) => s.sessionExerciseId === e.id && !s.completedAt));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isOpen = (id: string) => expanded.has(id) || (current?.id === id && !expanded.has(`closed:${id}`));
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (isOpen(id)) {
        next.delete(id);
        if (current?.id === id) next.add(`closed:${id}`);
      } else {
        next.add(id);
        next.delete(`closed:${id}`);
      }
      return next;
    });

  const [picker, setPicker] = useState<{ mode: 'add' } | { mode: 'replace'; item: SessionExercise } | null>(null);
  const [askTemplate, setAskTemplate] = useState<{ from: string; to: string; name: string } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const done = items.filter((e) => !e.skipped && sets.filter((s) => s.sessionExerciseId === e.id).every((s) => s.completedAt) && sets.some((s) => s.sessionExerciseId === e.id)).length;

  return (
    <>
      <AppHeader
        eyebrow="Treino em andamento"
        title={session.name}
        action={
          <IconButton
            label={paused ? 'Retomar treino' : 'Pausar treino'}
            className="text-ink"
            onClick={() => void (paused ? resumeSession(session.id) : pauseSession(session.id)).then(() => toast.info(paused ? 'Treino retomado.' : 'Treino pausado.'))}
          >
            {paused ? <Play className="size-6" /> : <Pause className="size-6" />}
          </IconButton>
        }
      />
      <PageContainer className="gap-3">
        <Card className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Duração" value={formatElapsed(activeDurationMs(session, now))} />
            <Metric label="Séries" value={`${stats.completedSets}/${stats.totalSets}`} />
            <Metric label="Exercícios" value={`${done}/${stats.exercisesTotal}`} />
          </div>
          <ProgressBar ratio={stats.totalSets ? stats.completedSets / stats.totalSets : 0} label="Progresso do treino" />
          {current && (
            <p className="text-caption text-muted">
              Agora: <b className="text-ink">{current.exerciseName}</b>
            </p>
          )}
        </Card>

        {paused && (
          <Card tone="elevated" className="flex items-center justify-between gap-3">
            <p className="text-body">Treino pausado. O tempo pausado não conta na duração.</p>
            <Button size="sm" icon={<Play className="size-4" />} onClick={() => void resumeSession(session.id)}>
              Retomar
            </Button>
          </Card>
        )}

        {items.length === 0 && (
          <Card>
            <EmptyState icon={<Dumbbell className="size-6" />} title="Treino livre" description="Adicione o primeiro exercício para começar a registrar." className="py-6" />
          </Card>
        )}

        {items.map((item) => (
          <ExerciseCard
            key={item.id}
            session={session}
            item={item}
            exercise={exercises.get(item.exerciseId)}
            sets={sets.filter((s) => s.sessionExerciseId === item.id)}
            open={isOpen(item.id)}
            isCurrent={current?.id === item.id}
            paused={paused}
            onToggle={() => toggle(item.id)}
            onReplace={() => setPicker({ mode: 'replace', item })}
          />
        ))}

        <Button variant="secondary" block icon={<Plus className="size-5" />} onClick={() => setPicker({ mode: 'add' })}>
          Adicionar exercício
        </Button>

        <Button size="lg" block className="mt-2" icon={<Check className="size-5" />} onClick={() => setFinishOpen(true)}>
          Finalizar treino
        </Button>
        <Button variant="ghost" block onClick={() => setCancelOpen(true)}>
          Cancelar treino
        </Button>
        {/* Room for the floating rest timer. */}
        <div className="h-20" aria-hidden />
      </PageContainer>

      <ExercisePicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker?.mode === 'replace' ? `Substituir ${picker.item.exerciseName}` : 'Adicionar exercício'}
        suggestedIds={picker?.mode === 'replace' ? (exercises.get(picker.item.exerciseId)?.alternativeIds ?? []) : []}
        excludeIds={picker?.mode === 'replace' ? [picker.item.exerciseId] : []}
        onPick={async (ex) => {
          const p = picker;
          setPicker(null);
          if (!p) return;
          if (p.mode === 'add') {
            await addSessionExercise(session.id, ex.id);
            toast.success(`${ex.name} adicionado ao treino.`);
          } else {
            await substituteExercise(p.item.id, ex.id);
            toast.success(`${p.item.exerciseName} substituído por ${ex.name} neste treino.`);
            if (session.templateId) setAskTemplate({ from: p.item.exerciseId, to: ex.id, name: ex.name });
          }
        }}
      />
      <ConfirmSheet
        open={askTemplate !== null}
        onClose={() => setAskTemplate(null)}
        destructive={false}
        title="Atualizar a rotina também?"
        description={`A troca vale para este treino. Quer que ${askTemplate?.name ?? ''} substitua o exercício na rotina para os próximos treinos?`}
        cancelLabel="Só neste treino"
        confirmLabel="Atualizar rotina"
        onConfirm={async () => {
          if (askTemplate && session.templateId) {
            const ok = await swapTemplateExercise(session.templateId, askTemplate.from, askTemplate.to);
            toast[ok ? 'success' : 'info'](ok ? 'Rotina atualizada.' : 'O exercício original não está mais na rotina.');
          }
          setAskTemplate(null);
        }}
      />
      <FinishSheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        session={session}
        pending={stats.totalSets - stats.completedSets}
        completed={stats.completedSets}
        onFinish={async (notes) => {
          await finishSession(session.id, notes);
          setFinishOpen(false);
          navigate(`/treino/historico/${session.id}?concluido=1`, { replace: true });
        }}
      />
      <ConfirmSheet
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title="Cancelar treino?"
        description={
          stats.completedSets > 0
            ? `As ${stats.completedSets} séries registradas serão descartadas. Para guardá-las, use Finalizar treino.`
            : 'O treino será descartado. Nenhuma série foi registrada.'
        }
        cancelLabel="Voltar"
        confirmLabel="Descartar treino"
        onConfirm={async () => {
          await cancelSession(session.id);
          setCancelOpen(false);
          toast.info('Treino descartado.');
          navigate('/treino', { replace: true });
        }}
      />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="tabular font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ExerciseCard({
  session,
  item,
  exercise,
  sets,
  open,
  isCurrent,
  paused,
  onToggle,
  onReplace,
}: {
  session: WorkoutSession;
  item: SessionExercise;
  exercise?: Exercise;
  sets: SetRecord[];
  open: boolean;
  isCurrent: boolean;
  paused: boolean;
  onToggle: () => void;
  onReplace: () => void;
}) {
  const toast = useToast();
  const prev = useLiveQuery(() => lastPerformance(item.exerciseId, session.id), [item.exerciseId, session.id]);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<SetRecord | null>(null);
  const cardio = exercise?.movementType === 'cardio';
  const completed = sets.filter((s) => s.completedAt).length;
  const allDone = sets.length > 0 && completed === sets.length;
  const status = item.skipped ? 'Pulado' : allDone ? 'Concluído' : `${completed}/${sets.length} séries`;

  return (
    <Card className={cn('p-0', isCurrent && 'border-accent/50', item.skipped && 'opacity-70')}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            allDone ? 'bg-accent text-accent-ink' : isCurrent ? 'bg-accent/15 text-accent' : 'bg-elevated text-muted',
          )}
        >
          {allDone ? <Check className="size-4" /> : item.sortOrder + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-semibold">{item.exerciseName}</span>
          <span className="block truncate text-caption text-muted">
            {status}
            {item.substitutedFromName && ` · substituiu ${item.substitutedFromName}`}
          </span>
        </span>
        <ChevronDown className={cn('size-5 shrink-0 text-faint transition-transform duration-fast', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-line/60 px-3 pb-3 pt-3">
          <div className="px-1">
            {exercise && (
              <p className="text-caption text-muted">
                {MUSCLE_LABELS[exercise.primaryMuscle]} · {EQUIPMENT_LABELS[exercise.equipment]}
                {item.targetSets && item.repMin !== undefined && item.repMax !== undefined && (
                  <> · {formatPrescription({ sets: item.targetSets, repMin: item.repMin, repMax: item.repMax, restSec: item.restSec, cardio })}</>
                )}
              </p>
            )}
            <p className="mt-0.5 text-caption text-faint">
              {prev ? (
                <>
                  Última vez ({formatShortDay(prev.session.day)}): <span className="text-muted">{formatSetsLine(prev.sets, cardio)}</span>
                </>
              ) : (
                'Primeira vez com este exercício.'
              )}
            </p>
            {item.notes && <p className="mt-1 text-caption text-muted">Nota: {item.notes}</p>}
          </div>

          <div className="mt-3 grid grid-cols-set-row items-end gap-2 px-1 text-xs font-medium text-faint">
            <span>Série</span>
            <span>{cardio ? '—' : 'Carga (kg)'}</span>
            <span>{cardio ? 'Minutos' : 'Reps'}</span>
            <span />
          </div>
          <div className="mt-1 flex flex-col gap-2">
            {sets.map((s, i) => (
              <SetRow key={s.id} set={s} index={i} cardio={cardio} bodyweight={exercise?.equipment === 'bodyweight'} disabled={paused} onEdit={() => setEditingSet(s)} />
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => void addSet(item.id)}>
              Série
            </Button>
            <Button variant="secondary" size="sm" icon={<Repeat className="size-4" />} onClick={onReplace}>
              Substituir
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={item.skipped ? <Undo2 className="size-4" /> : <SkipForward className="size-4" />}
              onClick={() => void setExerciseSkipped(item.id, !item.skipped).then(() => toast.info(item.skipped ? 'Exercício retomado.' : 'Exercício pulado.'))}
            >
              {item.skipped ? 'Retomar' : 'Pular'}
            </Button>
            <Button variant="secondary" size="sm" icon={<NotebookPen className="size-4" />} onClick={() => setNotesOpen(true)}>
              Nota
            </Button>
          </div>
        </div>
      )}

      <ExerciseNotesSheet open={notesOpen} item={item} onClose={() => setNotesOpen(false)} />
      <SetSheet set={editingSet} cardio={cardio} onClose={() => setEditingSet(null)} />
    </Card>
  );
}

/** One set: pre-filled values, numeric keyboard, one tap to complete. */
function SetRow({ set, index, cardio, bodyweight, disabled, onEdit }: { set: SetRecord; index: number; cardio: boolean; bodyweight: boolean; disabled: boolean; onEdit: () => void }) {
  const toast = useToast();
  // A 0 kg load on a loaded exercise means "not filled": show it empty so it isn't completed by accident.
  const loadText = (kg: number) => (kg === 0 && !bodyweight ? '' : toInputValue(kg, 2));
  const [weight, setWeight] = useState(loadText(set.weightKg));
  const [reps, setReps] = useState(String(set.reps || ''));
  const done = Boolean(set.completedAt);

  // Follow external changes (e.g. edit sheet) when not typing.
  useEffect(() => setWeight(loadText(set.weightKg)), [set.weightKg]);
  useEffect(() => setReps(String(set.reps || '')), [set.reps]);

  const w = cardio || (bodyweight && weight.trim() === '') ? 0 : parseDecimal(weight);
  const r = parseDecimal(reps);
  const valid = w !== null && w >= 0 && w <= 1000 && r !== null && Number.isInteger(r) && r > 0 && r <= 500;

  const persist = () => {
    if (w !== null && w >= 0 && w <= 1000 && w !== set.weightKg) void updateSet(set.id, { weightKg: w });
    if (r !== null && Number.isInteger(r) && r > 0 && r <= 500 && r !== set.reps) void updateSet(set.id, { reps: r });
  };

  const toggle = async () => {
    if (done) {
      await uncompleteSet(set.id);
      return;
    }
    if (!valid) {
      toast.error(cardio ? 'Informe os minutos.' : 'Informe carga (kg) e repetições.');
      return;
    }
    await completeSet(set.id, { weightKg: w!, reps: r! });
  };

  const field = 'h-12 w-full min-w-0 rounded-control border bg-elevated px-2 text-center text-lg font-semibold tabular focus:border-accent/70 focus:outline-none disabled:opacity-60';

  return (
    <div className={cn('grid grid-cols-set-row items-center gap-2 rounded-control px-1 py-0.5', done && 'bg-accent/8')}>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar série ${index + 1}`}
        className="flex h-12 items-center justify-center rounded-xl text-sm font-semibold text-muted active:bg-elevated"
      >
        {set.kind === 'warmup' ? 'A' : index + 1}
        {set.rir !== undefined && <span className="ml-0.5 text-xs text-faint">·{set.rir}</span>}
      </button>
      {cardio ? (
        <span className="text-center text-faint">—</span>
      ) : (
        <input
          aria-label={`Carga da série ${index + 1}`}
          inputMode="decimal"
          placeholder={bodyweight ? '0' : 'kg'}
          value={weight}
          disabled={done}
          onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ''))}
          onBlur={persist}
          className={cn(field, done ? 'border-transparent' : 'border-line')}
        />
      )}
      <input
        aria-label={`${cardio ? 'Minutos' : 'Repetições'} da série ${index + 1}`}
        inputMode="numeric"
        value={reps}
        disabled={done}
        onChange={(e) => setReps(e.target.value.replace(/\D/g, ''))}
        onBlur={persist}
        className={cn(field, done ? 'border-transparent' : 'border-line')}
      />
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={disabled}
        aria-label={done ? `Desfazer série ${index + 1}` : `Concluir série ${index + 1}`}
        aria-pressed={done}
        className={cn(
          'pressable flex size-12 items-center justify-center rounded-control disabled:opacity-40',
          done ? 'bg-accent text-accent-ink' : 'border border-line bg-elevated text-muted',
        )}
      >
        <Check className="size-6" strokeWidth={done ? 3 : 2} />
      </button>
    </div>
  );
}

function SetSheet({ set, cardio, onClose }: { set: SetRecord | null; cardio: boolean; onClose: () => void }) {
  const toast = useToast();
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rir, setRir] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<'working' | 'warmup'>('working');

  useEffect(() => {
    if (!set) return;
    setWeight(toInputValue(set.weightKg, 2));
    setReps(String(set.reps || ''));
    setRir(set.rir === undefined ? undefined : String(Math.min(set.rir, 3)));
    setNote(set.note ?? '');
    setKind(set.kind === 'warmup' ? 'warmup' : 'working');
  }, [set]);

  const w = cardio ? 0 : parseDecimal(weight);
  const r = parseDecimal(reps);
  const valid = w !== null && w >= 0 && w <= 1000 && r !== null && Number.isInteger(r) && r >= 0 && r <= 500;

  return (
    <BottomSheet
      open={set !== null}
      onClose={onClose}
      title="Editar série"
      footer={
        <div className="flex gap-3">
          <Button
            variant="danger"
            aria-label="Excluir série"
            icon={<Trash2 className="size-5" />}
            onClick={async () => {
              if (!set) return;
              await deleteSet(set.id);
              toast.info('Série excluída.');
              onClose();
            }}
          />
          <Button
            block
            onClick={async () => {
              if (!set) return;
              if (!valid) {
                toast.error('Revise carga e repetições.');
                return;
              }
              await updateSet(set.id, { weightKg: w!, reps: r!, rir: rir === undefined ? undefined : Number(rir), note, kind });
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="grid grid-cols-2 gap-3">
          {!cardio && <NumberInput label="Carga" suffix="kg" value={weight} onChange={setWeight} />}
          <NumberInput label={cardio ? 'Minutos' : 'Repetições'} decimal={false} value={reps} onChange={setReps} />
        </div>
        {!cardio && (
          <ChipGroup
            label="RIR (repetições na reserva, opcional)"
            value={rir}
            onChange={(v) => setRir(v === rir ? undefined : v)}
            options={[
              { value: '0', label: '0 · falha' },
              { value: '1', label: '1' },
              { value: '2', label: '2' },
              { value: '3', label: '3+' },
            ]}
          />
        )}
        <ChipGroup
          label="Tipo"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'working', label: 'Série válida' },
            { value: 'warmup', label: 'Aquecimento' },
          ]}
        />
        <Input label="Nota (opcional)" value={note} onChange={setNote} maxLength={80} placeholder="Ex.: pegada mais aberta" />
      </div>
    </BottomSheet>
  );
}

function ExerciseNotesSheet({ open, item, onClose }: { open: boolean; item: SessionExercise; onClose: () => void }) {
  const [notes, setNotes] = useState(item.notes ?? '');
  useEffect(() => {
    if (open) setNotes(item.notes ?? '');
  }, [open, item.notes]);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={`Nota · ${item.exerciseName}`}
      footer={
        <Button block onClick={() => void setExerciseNotes(item.id, notes).then(onClose)}>
          Salvar nota
        </Button>
      }
    >
      <div className="pt-2">
        <TextArea label="Nota deste exercício no treino" value={notes} onChange={setNotes} maxLength={200} />
      </div>
    </BottomSheet>
  );
}

function FinishSheet({
  open,
  onClose,
  session,
  pending,
  completed,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  session: WorkoutSession;
  pending: number;
  completed: number;
  onFinish: (notes: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(session.notes ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <BottomSheet
      open={open}
      onClose={() => !busy && onClose()}
      title="Finalizar treino?"
      footer={
        <Button
          block
          size="lg"
          loading={busy}
          disabled={completed === 0}
          onClick={async () => {
            setBusy(true);
            try {
              await onFinish(notes);
            } finally {
              setBusy(false);
            }
          }}
        >
          Salvar treino
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <p className="text-body text-muted">
          <b className="text-ink">{formatNumber(completed)}</b> série{completed === 1 ? '' : 's'} concluída{completed === 1 ? '' : 's'}.
          {pending > 0 && <> As {pending} séries não marcadas não serão salvas.</>}
        </p>
        {completed === 0 && <p className="text-caption text-warning">Conclua pelo menos uma série ou use Cancelar treino.</p>}
        <TextArea label="Notas do treino (opcional)" value={notes} onChange={setNotes} maxLength={300} rows={3} />
      </div>
    </BottomSheet>
  );
}
