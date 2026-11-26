import { useState } from 'react';
import { Bell, Check, ChevronLeft, ChevronRight, ClipboardList, Dumbbell, Moon, Play } from 'lucide-react';
import { Link } from 'react-router';
import { RangePicker } from '@/components/charts/BarChart';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Field';
import { ListGroup, ListRow } from '@/components/ui/List';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { moveTraining, setDayKind, setDayNote, setTrainingDays, toggleTrainingDay } from '@/data/repos/planning';
import { weekPlanStats, type DayStatus } from '@/domain/calc/planning';
import { useStartWorkout } from '@/features/workout/useStartWorkout';
import { usePlan } from '@/hooks/planning';
import { useSettings } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { addDays, formatDayKey, formatLongDay, formatRelativeDay, formatShortDay, parseDayKey, startOfWeek, type DayKey } from '@/lib/dates';

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function PlanningPage() {
  const today = useToday();
  const settings = useSettings();
  const [view, setView] = useState<'semana' | 'mes'>('semana');
  const [selected, setSelected] = useState<DayKey>(today);
  if (!settings) return <LoadingScreen />;
  const weekStart = startOfWeek(selected, settings.weekStartsOn);

  return (
    <>
      <AppHeader title="Planejamento" back="/mais" description="Dias de treino e descanso. O plano orienta, não obriga: treinar em outro dia também vale." />
      <PageContainer className="gap-4">
        <PatternCard trainingDays={settings.trainingDays} weekStartsOn={settings.weekStartsOn} />
        <RangePicker
          label="Visualização"
          value={view}
          onChange={setView}
          options={[
            { value: 'semana', label: 'Semana' },
            { value: 'mes', label: 'Mês' },
          ]}
        />
        {view === 'semana' ? <WeekView weekStart={weekStart} today={today} selected={selected} onSelect={setSelected} /> : <MonthView anchor={selected} today={today} weekStartsOn={settings.weekStartsOn} selected={selected} onSelect={(d) => { setSelected(d); setView('semana'); }} />}
        <ListGroup>
          <ListRow icon={<Bell className="size-5" />} title="Lembretes" subtitle="Água, treino, pesagem, refeições e revisão" to="/mais/lembretes" />
          <ListRow icon={<ClipboardList className="size-5" />} title="Revisão semanal" subtitle="Planejado × realizado, peso, nutrição e água" to="/mais/planejamento/revisao" />
        </ListGroup>
      </PageContainer>
    </>
  );
}

function PatternCard({ trainingDays, weekStartsOn }: { trainingDays?: number[]; weekStartsOn: 0 | 1 }) {
  const toast = useToast();
  const order = weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const set = new Set(trainingDays ?? []);
  return (
    <Card>
      <SectionHeader title="Semana padrão" />
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="Dias de treino">
        {order.map((d) => {
          const on = set.has(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              aria-label={`${WEEKDAY_SHORT[d]}: ${on ? 'treino' : 'descanso'}`}
              onClick={() => void toggleTrainingDay(d)}
              className={cn('pressable flex min-h-14 flex-col items-center justify-center gap-1 rounded-control border text-xs font-semibold', on ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line bg-elevated text-muted')}
            >
              {WEEKDAY_SHORT[d]}
              {on ? <Dumbbell className="size-4 text-accent" /> : <Moon className="size-4" />}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-caption text-faint">
        {trainingDays === undefined ? 'Sem plano: toque nos dias em que você costuma treinar.' : `${set.size} dia${set.size === 1 ? '' : 's'} de treino por semana. As rotinas seguem a sua sequência (A → B → C).`}
      </p>
      {trainingDays !== undefined && (
        <button type="button" className="mt-1 flex min-h-touch items-center text-caption text-muted" onClick={() => void setTrainingDays(undefined).then(() => toast.info('Plano semanal removido.'))}>
          Remover plano semanal
        </button>
      )}
    </Card>
  );
}

function DayIcon({ s }: { s: DayStatus }) {
  if (s.completed.length) return <Check className="size-4 text-accent" />;
  if (s.planned === 'training') return <Dumbbell className="size-4 text-ink" />;
  if (s.planned === 'rest') return <Moon className="size-4 text-faint" />;
  return <span className="size-4" />;
}

function WeekView({ weekStart, today, selected, onSelect }: { weekStart: DayKey; today: DayKey; selected: DayKey; onSelect: (d: DayKey) => void }) {
  const plan = usePlan(weekStart, addDays(weekStart, 6), today);
  if (!plan) return <LoadingScreen />;
  const stats = weekPlanStats(plan.days, today);
  const day = plan.days.find((d) => d.day === selected) ?? plan.days[0]!;

  return (
    <>
      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <IconButton label="Semana anterior" onClick={() => onSelect(addDays(weekStart, -7))}>
            <ChevronLeft className="size-6" />
          </IconButton>
          <div className="text-center">
            <p className="text-body font-semibold">
              {formatShortDay(weekStart)} – {formatShortDay(addDays(weekStart, 6))}
            </p>
            {plan.trainingDays !== undefined && (
              <p className="text-caption text-muted">
                {stats.completedSessions} treino{stats.completedSessions === 1 ? '' : 's'} · {stats.plannedTotal} planejado{stats.plannedTotal === 1 ? '' : 's'}
              </p>
            )}
          </div>
          <IconButton label="Próxima semana" onClick={() => onSelect(addDays(weekStart, 7))}>
            <ChevronRight className="size-6" />
          </IconButton>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {plan.days.map((s) => (
            <button
              key={s.day}
              type="button"
              aria-pressed={s.day === selected}
              aria-label={`${formatLongDay(s.day)}: ${statusLabel(s)}`}
              onClick={() => onSelect(s.day)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-control border text-xs',
                s.day === selected ? 'border-ink bg-elevated' : 'border-transparent',
                s.day === today && 'font-bold text-accent',
              )}
            >
              <span className="text-micro text-muted">{WEEKDAY_SHORT[parseDayKey(s.day).getDay()]}</span>
              <span className="tabular">{parseDayKey(s.day).getDate()}</span>
              <DayIcon s={s} />
            </button>
          ))}
        </div>
      </Card>
      <DayDetail s={day} today={today} weekDays={plan.days} />
    </>
  );
}

function statusLabel(s: DayStatus): string {
  if (s.completed.length) return s.offPlan ? 'treino fora do plano concluído' : 'treino concluído';
  if (s.planned === 'training') return s.routine ? `treino planejado: ${s.routine.name}` : 'treino planejado';
  if (s.planned === 'rest') return 'descanso';
  return 'sem plano';
}

function DayDetail({ s, today, weekDays }: { s: DayStatus; today: DayKey; weekDays: DayStatus[] }) {
  const toast = useToast();
  const { start, starting } = useStartWorkout();
  const [note, setNote] = useState(s.note ?? '');
  const [moving, setMoving] = useState(false);
  const [prevDay, setPrevDay] = useState(s.day);
  if (prevDay !== s.day) {
    setPrevDay(s.day);
    setNote(s.note ?? '');
    setMoving(false);
  }
  const future = s.day >= today;
  const targets = weekDays.filter((d) => d.day !== s.day && d.day >= today && d.planned !== 'training' && !d.completed.length);

  return (
    <Card>
      <SectionHeader title={formatRelativeDay(s.day, today)} action={<span className="text-caption text-muted">{formatLongDay(s.day)}</span>} />
      <div className="flex flex-col gap-3">
        {s.completed.length > 0 ? (
          s.completed.map((c) => (
            <Link key={c.id} to={`/treino/historico/${c.id}`} className="flex min-h-touch items-center gap-2 text-body">
              <Check className="size-5 text-accent" /> <b>{c.name}</b> <span className="text-muted">concluído{s.offPlan ? ' (fora do plano)' : ''}</span>
            </Link>
          ))
        ) : s.planned === 'training' ? (
          <p className="text-body">
            <Dumbbell className="mr-1 inline size-5 text-accent" /> Treino planejado{s.routine && <>: <b>{s.routine.name}</b></>}
            {s.missed && <span className="block text-caption text-muted">Nenhum treino registrado neste dia.</span>}
          </p>
        ) : s.planned === 'rest' ? (
          <p className="text-body text-muted">
            <Moon className="mr-1 inline size-5" /> Dia de descanso.
          </p>
        ) : (
          <p className="text-body text-muted">Sem plano para este dia.</p>
        )}

        {s.day === today && s.planned === 'training' && !s.completed.length && s.routine && (
          <Button icon={<Play className="size-5" />} loading={starting} onClick={() => void start(s.routine!.id)}>
            Iniciar {s.routine.name}
          </Button>
        )}

        {future && !s.completed.length && (
          <div className="grid grid-cols-2 gap-2">
            {s.planned === 'training' ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => void setDayKind(s.day, 'rest').then(() => toast.info('Marcado como descanso.'))}>
                  Marcar descanso
                </Button>
                <Button variant="secondary" size="sm" disabled={!targets.length} onClick={() => setMoving(!moving)}>
                  Mover treino
                </Button>
              </>
            ) : (
              <Button variant="secondary" size="sm" className="col-span-2" onClick={() => void setDayKind(s.day, 'training').then(() => toast.info('Marcado como dia de treino.'))}>
                Marcar como treino
              </Button>
            )}
          </div>
        )}
        {moving && (
          <div className="flex flex-wrap gap-2">
            {targets.map((t) => (
              <Button
                key={t.day}
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await moveTraining(s.day, t.day);
                  setMoving(false);
                  toast.success(`Treino movido para ${formatRelativeDay(t.day, today).toLowerCase()}.`);
                }}
              >
                {WEEKDAY_SHORT[parseDayKey(t.day).getDay()]} {parseDayKey(t.day).getDate()}
              </Button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input label="Nota do dia" value={note} onChange={setNote} maxLength={80} placeholder="Ex.: treino cedo, viagem" />
          </div>
          {note !== (s.note ?? '') && (
            <Button size="md" onClick={() => void setDayNote(s.day, note).then(() => toast.success('Nota salva.'))}>
              Salvar
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function MonthView({ anchor, today, weekStartsOn, selected, onSelect }: { anchor: DayKey; today: DayKey; weekStartsOn: 0 | 1; selected: DayKey; onSelect: (d: DayKey) => void }) {
  const [month, setMonth] = useState(() => {
    const d = parseDayKey(anchor);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const first = formatDayKey(month);
  const last = formatDayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const gridStart = startOfWeek(first, weekStartsOn);
  const gridEnd = addDays(startOfWeek(last, weekStartsOn), 6);
  const plan = usePlan(gridStart, gridEnd, today);
  if (!plan) return <LoadingScreen />;
  const order = weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month);
  const inMonth = plan.days.filter((d) => d.day >= first && d.day <= last);
  const done = inMonth.filter((d) => d.completed.length).length;
  const planned = inMonth.filter((d) => d.planned === 'training').length;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <IconButton label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft className="size-6" />
        </IconButton>
        <div className="text-center">
          <p className="text-body font-semibold capitalize">{label}</p>
          <p className="text-caption text-muted">
            {done} dia{done === 1 ? '' : 's'} com treino{plan.trainingDays !== undefined && ` · ${planned} planejado${planned === 1 ? '' : 's'}`}
          </p>
        </div>
        <IconButton label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight className="size-6" />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {order.map((d) => (
          <span key={d} className="text-micro text-faint">
            {WEEKDAY_SHORT[d]}
          </span>
        ))}
        {plan.days.map((s) => {
          const outside = s.day < first || s.day > last;
          return (
            <button
              key={s.day}
              type="button"
              aria-label={`${formatLongDay(s.day)}: ${statusLabel(s)}`}
              onClick={() => onSelect(s.day)}
              className={cn('flex min-h-11 flex-col items-center justify-center rounded-lg text-xs', outside && 'opacity-30', s.day === selected && 'bg-elevated', s.day === today && 'font-bold text-accent')}
            >
              <span className="tabular">{parseDayKey(s.day).getDate()}</span>
              <span className={cn('mt-0.5 size-1.5 rounded-full', s.completed.length ? 'bg-accent' : s.planned === 'training' ? 'bg-ink/60' : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-accent" /> treino feito
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ink/60" /> planejado
        </span>
      </p>
      <LinkButton to="/treino" variant="ghost" size="sm" block className="mt-1">
        Ver rotinas e sequência
      </LinkButton>
    </Card>
  );
}
