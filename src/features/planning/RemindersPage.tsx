import { useEffect, useState } from 'react';
import { Bell, BellOff, Plus, Trash2 } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, IconButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ChipGroup, Input, MultiChipGroup } from '@/components/ui/Field';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { createReminder, deleteReminder, updateReminder, type ReminderInput } from '@/data/repos/planning';
import { parseTime, reminderTimes } from '@/domain/calc/planning';
import type { Reminder, ReminderType } from '@/domain/models';
import { useReminders } from '@/hooks/planning';
import { cn } from '@/lib/cn';
import { notificationPermission, requestNotificationPermission, type PermissionState } from '@/services/reminderNotifications';

const TYPE_LABELS: Record<ReminderType, string> = {
  water: 'Água',
  workout: 'Treino',
  weigh_in: 'Pesagem',
  nutrition: 'Refeições',
  weekly_review: 'Revisão semanal',
  custom: 'Personalizado',
};
const DAY_OPTIONS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((label, i) => ({ value: String(i), label }));

function describe(r: Reminder): string {
  const times = reminderTimes(r);
  const when = r.intervalMin && times.length > 1 ? `a cada ${r.intervalMin / 60 >= 1 && r.intervalMin % 60 === 0 ? `${r.intervalMin / 60} h` : `${r.intervalMin} min`}, ${r.time}–${r.endTime}` : r.time;
  const days = r.days.length === 7 ? 'todos os dias' : r.days.map((d) => DAY_OPTIONS[d]!.label).join(', ');
  return `${when} · ${r.type === 'workout' && r.trainingDaysOnly ? 'dias de treino' : days}`;
}

export function RemindersPage() {
  const reminders = useReminders();
  const toast = useToast();
  const [permission, setPermission] = useState<PermissionState | null>(null);
  const [explain, setExplain] = useState<Reminder | null>(null);
  const [editing, setEditing] = useState<Reminder | 'new' | null>(null);

  useEffect(() => {
    void notificationPermission().then(setPermission);
  }, []);
  if (reminders === undefined || permission === null) return <LoadingScreen />;

  const toggle = async (r: Reminder) => {
    if (!r.enabled && permission === 'prompt') {
      // Explain first; the OS prompt is shown only after the user agrees.
      setExplain(r);
      return;
    }
    await updateReminder(r.id, { enabled: !r.enabled });
    toast.info(r.enabled ? `${r.title}: desativado.` : `${r.title}: ativado.`);
  };

  return (
    <>
      <AppHeader
        title="Lembretes"
        back="/mais/planejamento"
        action={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Novo
          </Button>
        }
      />
      <PageContainer className="gap-3">
        <PermissionBanner state={permission} />
        {reminders.length === 0 ? (
          <Card>
            <EmptyState icon={<Bell className="size-6" />} title="Nenhum lembrete" description="Crie lembretes para água, treino, pesagem, refeições ou revisão semanal." action={<Button onClick={() => setEditing('new')}>Criar lembrete</Button>} />
          </Card>
        ) : (
          reminders.map((r) => (
            <Card key={r.id} className="flex items-center gap-3 py-2 pl-4 pr-2">
              <button type="button" onClick={() => setEditing(r)} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center text-left">
                <span className={cn('truncate text-body font-semibold', !r.enabled && 'text-muted')}>{r.title}</span>
                <span className="truncate text-caption text-muted">{describe(r)}</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={r.enabled}
                aria-label={`${r.enabled ? 'Desativar' : 'Ativar'} ${r.title}`}
                onClick={() => void toggle(r)}
                className="flex min-h-touch shrink-0 items-center px-1"
              >
                <span className={cn('flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-fast', r.enabled ? 'bg-accent' : 'bg-line')}>
                  <span className={cn('size-6 rounded-full bg-ink transition-transform duration-fast', r.enabled && 'translate-x-5')} />
                </span>
              </button>
            </Card>
          ))
        )}
        <p className="px-1 text-caption text-faint">Lembretes são notificações locais do próprio aparelho: sem servidor, sem internet e sem custo.</p>
      </PageContainer>

      <ConfirmSheet
        open={explain !== null}
        onClose={() => setExplain(null)}
        destructive={false}
        title="Permitir notificações?"
        description={
          <>
            <p>Para avisar na hora certa, o Android precisa da sua permissão para o Iron Track mostrar notificações.</p>
            <p className="mt-2">Usamos só para os lembretes que você ativar e para o fim do descanso no treino. Nada é enviado para a internet.</p>
          </>
        }
        cancelLabel="Agora não"
        confirmLabel="Continuar"
        onConfirm={async () => {
          const r = explain;
          setExplain(null);
          const state = await requestNotificationPermission();
          setPermission(state);
          if (r) await updateReminder(r.id, { enabled: true });
          if (state === 'granted') toast.success(`${r?.title}: ativado.`);
          else toast.info('Lembrete salvo, mas as notificações estão bloqueadas no Android.');
        }}
      />
      <ReminderSheet reminder={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function PermissionBanner({ state }: { state: PermissionState }) {
  if (state === 'granted' || state === 'prompt') return null;
  return (
    <Card tone="elevated" className="flex items-start gap-3">
      <BellOff className="mt-0.5 size-5 shrink-0 text-warning" />
      <p className="text-caption text-muted">
        {state === 'denied' ? (
          <>
            Notificações bloqueadas. Para receber lembretes, ative em <b className="text-ink">Configurações do Android → Apps → Iron Track → Notificações</b>. O app não vai pedir de novo.
          </>
        ) : (
          <>Lembretes funcionam no app instalado (APK). Neste navegador eles ficam salvos, mas não disparam.</>
        )}
      </p>
    </Card>
  );
}

function ReminderSheet({ reminder, onClose }: { reminder: Reminder | 'new' | null; onClose: () => void }) {
  const toast = useToast();
  const existing = reminder && reminder !== 'new' ? reminder : null;
  const [type, setType] = useState<ReminderType>('custom');
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00');
  const [days, setDays] = useState<string[]>([]);
  const [repeat, setRepeat] = useState(false);
  const [interval, setIntervalMin] = useState('120');
  const [endTime, setEndTime] = useState('20:00');
  const [trainingOnly, setTrainingOnly] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!reminder) return;
    const r = reminder === 'new' ? null : reminder;
    setType(r?.type ?? 'custom');
    setTitle(r?.title ?? '');
    setTime(r?.time ?? '08:00');
    setDays((r?.days ?? [0, 1, 2, 3, 4, 5, 6]).map(String));
    setRepeat(Boolean(r?.intervalMin));
    setIntervalMin(String(r?.intervalMin ?? 120));
    setEndTime(r?.endTime ?? '20:00');
    setTrainingOnly(Boolean(r?.trainingDaysOnly));
    setShowErrors(false);
  }, [reminder]);

  if (!reminder) return null;
  const errors = {
    title: title.trim() ? null : 'Informe o título.',
    time: parseTime(time) ? null : 'Horário inválido.',
    days: days.length || (type === 'workout' && trainingOnly) ? null : 'Escolha pelo menos um dia.',
    repeat: repeat && (!parseTime(endTime) || endTime <= time) ? 'O fim deve ser depois do início.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const input: ReminderInput = {
    type,
    title,
    time,
    days: type === 'workout' && trainingOnly ? [0, 1, 2, 3, 4, 5, 6] : days.map(Number).sort(),
    intervalMin: type === 'water' && repeat ? Number(interval) : undefined,
    endTime: type === 'water' && repeat ? endTime : undefined,
    trainingDaysOnly: type === 'workout' ? trainingOnly : undefined,
  };

  return (
    <>
      <BottomSheet
        open
        onClose={onClose}
        title={existing ? 'Editar lembrete' : 'Novo lembrete'}
        footer={
          <div className="flex gap-2">
            {existing && (
              <IconButton label="Excluir lembrete" className="size-12 rounded-control border border-danger/30 bg-danger/12 text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-5" />
              </IconButton>
            )}
            <Button
              block
              onClick={async () => {
                if (!valid) {
                  setShowErrors(true);
                  return;
                }
                if (existing) await updateReminder(existing.id, input);
                else await createReminder(input);
                toast.success('Lembrete salvo.');
                onClose();
              }}
            >
              Salvar
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 pt-1">
          {!existing && <ChipGroup label="Tipo" value={type} onChange={(t) => { setType(t); if (!title) setTitle(TYPE_LABELS[t]); }} options={(Object.keys(TYPE_LABELS) as ReminderType[]).map((t) => ({ value: t, label: TYPE_LABELS[t] }))} />}
          <Input label="Título" value={title} onChange={setTitle} maxLength={40} error={showErrors ? errors.title : null} />
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-muted">{type === 'water' && repeat ? 'Primeiro horário' : 'Horário'}</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-13 rounded-control border border-line bg-elevated px-4 text-base text-ink scheme-dark" />
            {showErrors && errors.time && <span className="text-caption text-danger">{errors.time}</span>}
          </label>
          {type === 'water' && (
            <>
              <ChipGroup
                label="Repetição"
                value={repeat ? interval : 'once'}
                onChange={(v) => {
                  setRepeat(v !== 'once');
                  if (v !== 'once') setIntervalMin(v);
                }}
                options={[
                  { value: 'once', label: '1 vez' },
                  { value: '60', label: 'A cada 1 h' },
                  { value: '90', label: 'A cada 1h30' },
                  { value: '120', label: 'A cada 2 h' },
                  { value: '180', label: 'A cada 3 h' },
                ]}
              />
              {repeat && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-caption font-medium text-muted">Até</span>
                  <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-13 rounded-control border border-line bg-elevated px-4 text-base text-ink scheme-dark" />
                  {showErrors && errors.repeat && <span className="text-caption text-danger">{errors.repeat}</span>}
                </label>
              )}
            </>
          )}
          {type === 'workout' && (
            <ChipGroup
              label="Quando"
              value={trainingOnly ? 'plan' : 'days'}
              onChange={(v) => setTrainingOnly(v === 'plan')}
              options={[
                { value: 'plan', label: 'Dias de treino do plano' },
                { value: 'days', label: 'Dias escolhidos' },
              ]}
            />
          )}
          {!(type === 'workout' && trainingOnly) && <MultiChipGroup label="Dias" value={days} onChange={setDays} options={DAY_OPTIONS} />}
          {showErrors && errors.days && <p className="text-caption text-danger">{errors.days}</p>}
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir lembrete?"
        description="O lembrete e suas notificações agendadas serão removidos."
        confirmLabel="Excluir"
        onConfirm={async () => {
          if (existing) await deleteReminder(existing.id);
          setConfirmDelete(false);
          toast.success('Lembrete excluído.');
          onClose();
        }}
      />
    </>
  );
}
