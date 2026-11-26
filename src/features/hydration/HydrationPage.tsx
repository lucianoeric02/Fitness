import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Droplets, Pencil, Plus, Trash2, Undo2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, NumberInput } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { setTargetsFrom } from '@/data/repos/targets';
import { deleteWater, restoreWater, updateWater, waterBetween, waterEntriesForDay } from '@/data/repos/water';
import { dailyWaterTotals, daysOnTarget, waterProgress } from '@/domain/calc/water';
import type { NutritionTarget, WaterEntry } from '@/domain/models';
import { RULES, validateNumber } from '@/domain/validation';
import { useTargetForDay } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { addDays, formatLongDay, formatRelativeDay, formatShortDay, formatTime, isDayKey, parseDayKey, type DayKey } from '@/lib/dates';
import { clamp, formatNumber, formatVolumeMl, parseDecimal } from '@/lib/numbers';
import { QUICK_WATER_ML, useWaterActions } from './useWaterActions';

const HISTORY_DAYS = 14;

export function HydrationPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const raw = params.get('dia');
  const day: DayKey = raw && isDayKey(raw) && raw <= today ? raw : today;
  const setDay = (d: DayKey) => setParams(d === today ? {} : { dia: d }, { replace: true });

  const target = useTargetForDay(day);
  const todayTarget = useTargetForDay(today);
  const entries = useLiveQuery(() => waterEntriesForDay(day), [day]);
  const history = useLiveQuery(async () => {
    const from = addDays(today, -(HISTORY_DAYS - 1));
    return dailyWaterTotals(await waterBetween(from, today), from, today);
  }, [today]);
  const { add } = useWaterActions(day);
  const toast = useToast();
  const [customOpen, setCustomOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const [editing, setEditing] = useState<WaterEntry | null>(null);

  if (target === undefined || todayTarget === undefined || entries === undefined || history === undefined) return <LoadingScreen />;

  const goal = target?.waterMl ?? 0;
  const p = waterProgress(entries, goal);
  const pct = goal > 0 ? Math.round(p.rawRatio * 100) : 0;
  const last = entries[entries.length - 1];
  const last7 = history.slice(-7);
  const avg7 = Math.round(last7.reduce((a, d) => a + d.totalMl, 0) / last7.length);
  const loggedDays = history.filter((d) => d.entries > 0).length;

  return (
    <>
      <AppHeader title="Hidratação" back="/mais" description="Água do dia em relação à sua meta." />
      <PageContainer className="gap-4">
        <div className="flex items-center justify-between gap-2">
          <IconButton label="Dia anterior" onClick={() => setDay(addDays(day, -1))}>
            <ChevronLeft className="size-6" />
          </IconButton>
          <div className="text-center">
            <p className="text-body font-semibold">{formatRelativeDay(day, today)}</p>
            <p className="text-caption text-muted">{formatLongDay(day)}</p>
          </div>
          <IconButton label="Próximo dia" disabled={day >= today} onClick={() => setDay(addDays(day, 1))}>
            <ChevronRight className="size-6" />
          </IconButton>
        </div>

        <Card tone="accent" className="flex items-center gap-5 p-5">
          <WaterBottle ratio={goal > 0 ? p.ratio : 0} label={`${pct}% da meta de água`} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="tabular font-display text-5xl font-bold leading-none text-ink">
              {formatNumber(p.consumed / 1000, 2)}
              <span className="ml-1 font-sans text-base font-medium text-muted">L</span>
            </p>
            {goal > 0 ? (
              <>
                <p className="tabular text-caption text-muted">
                  de <b className="text-ink">{formatVolumeMl(goal)}</b> · <b className="text-water">{pct}%</b>
                </p>
                <p className="text-caption">{p.consumed >= goal ? <span className="text-accent">Meta batida</span> : <span className="text-muted">Faltam {formatVolumeMl(p.remaining)}</span>}</p>
              </>
            ) : (
              <p className="text-caption text-muted">Sem meta de água definida.</p>
            )}
            {day === today && (
              <button type="button" onClick={() => setTargetOpen(true)} className="flex min-h-touch items-center gap-1 self-start text-caption font-medium text-accent">
                <Pencil className="size-4" /> {goal > 0 ? 'Alterar meta' : 'Definir meta'}
              </button>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-4 gap-2">
          {QUICK_WATER_ML.map((ml) => (
            <Button key={ml} variant="secondary" size="lg" className="px-2" onClick={() => void add(ml)}>
              +{ml}
            </Button>
          ))}
          <Button variant="secondary" size="lg" className="px-2" aria-label="Outra quantidade" onClick={() => setCustomOpen(true)}>
            <Plus className="size-5" />
          </Button>
        </div>
        <p className="-mt-2 text-center text-xs text-faint">Valores em ml{day !== today && ` · registrando em ${formatShortDay(day)}`}</p>

        <Card className="p-0">
          <div className="flex items-center justify-between py-2 pl-4 pr-2">
            <SectionHeader title={`Registros (${entries.length})`} className="mb-0" />
            {last && (
              <button
                type="button"
                onClick={async () => {
                  const removed = await deleteWater(last.id);
                  if (removed) toast.info(`${formatVolumeMl(removed.amountMl)} removidos.`, { label: 'Refazer', onClick: () => void restoreWater(removed) });
                }}
                className="flex min-h-touch items-center gap-1 rounded-xl px-2 text-caption font-medium text-muted active:bg-elevated"
              >
                <Undo2 className="size-4" /> Desfazer último
              </button>
            )}
          </div>
          {entries.length === 0 ? (
            <EmptyState icon={<Droplets className="size-6" />} title="Nenhum registro" description={day === today ? 'Toque em +200, +300 ou +500 para registrar.' : 'Nada registrado neste dia.'} className="py-6" />
          ) : (
            <ul className="divide-y divide-line/60 border-t border-line/60">
              {[...entries].reverse().map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setEditing(e)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-elevated">
                    <span className="min-w-0">
                      <span className="tabular block text-body">{formatTime(e.loggedAt)}</span>
                      {e.note && <span className="block truncate text-caption text-muted">{e.note}</span>}
                    </span>
                    <span className="tabular shrink-0 text-body font-semibold text-water">+{formatNumber(e.amountMl)} ml</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader title={`Últimos ${HISTORY_DAYS} dias`} />
          {loggedDays === 0 ? (
            <p className="text-body text-muted">O histórico aparece conforme você registra água.</p>
          ) : (
            <>
              <HistoryBars days={history} goalMl={todayTarget?.waterMl ?? goal} selected={day} onSelect={setDay} />
              <div className="mt-4 grid grid-cols-2 gap-3 text-caption">
                <div className="rounded-control bg-elevated/60 p-3">
                  <p className="text-muted">Média 7 dias</p>
                  <p className="tabular text-body font-semibold">{formatVolumeMl(avg7)}</p>
                </div>
                <div className="rounded-control bg-elevated/60 p-3">
                  <p className="text-muted">Meta batida (7 dias)</p>
                  <p className="tabular text-body font-semibold">{daysOnTarget(last7, todayTarget?.waterMl ?? 0)} de 7</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-faint">Média inclui dias sem registro (0 ml). Toque em uma barra para ver o dia.</p>
            </>
          )}
        </Card>
      </PageContainer>

      <CustomWaterSheet open={customOpen} onClose={() => setCustomOpen(false)} onAdd={async (ml, note) => (await add(ml, note)) !== null} />
      <EditWaterSheet entry={editing} onClose={() => setEditing(null)} />
      <TargetSheet open={targetOpen} target={todayTarget} today={today} onClose={() => setTargetOpen(false)} />
    </>
  );
}

/** Bottle with a fill level; the fill animates with CSS (respects reduced motion). */
function WaterBottle({ ratio, label }: { ratio: number; label: string }) {
  const r = clamp(ratio, 0, 1);
  const top = 22;
  const bottom = 150;
  const fillY = bottom - (bottom - top) * r;
  return (
    <svg viewBox="0 0 84 160" className="h-36 w-20 shrink-0" role="img" aria-label={label}>
      <defs>
        <clipPath id="bottle">
          <path d="M30 4h24v12c0 4 4 6 8 9 8 6 12 14 12 26v92c0 8-6 13-14 13H24c-8 0-14-5-14-13V51c0-12 4-20 12-26 4-3 8-5 8-9z" />
        </clipPath>
        <linearGradient id="water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="1" stopColor="#0284c7" />
        </linearGradient>
      </defs>
      <g clipPath="url(#bottle)">
        <rect x="0" y="0" width="84" height="160" fill="var(--color-elevated)" />
        <rect x="0" y={fillY} width="84" height={160 - fillY} fill="url(#water)" className="transition-all duration-slow ease-out-expo" />
      </g>
      <path
        d="M30 4h24v12c0 4 4 6 8 9 8 6 12 14 12 26v92c0 8-6 13-14 13H24c-8 0-14-5-14-13V51c0-12 4-20 12-26 4-3 8-5 8-9z"
        fill="none"
        stroke="var(--color-line)"
        strokeWidth="2"
      />
    </svg>
  );
}

function HistoryBars({ days, goalMl, selected, onSelect }: { days: ReturnType<typeof dailyWaterTotals>; goalMl: number; selected: DayKey; onSelect: (d: DayKey) => void }) {
  // Scale so the tallest of (goal, best day) uses 90% of the plot height.
  const max = Math.max(goalMl, ...days.map((d) => d.totalMl), 1) / 0.9;
  return (
    <div role="list" aria-label="Água por dia">
      <div className="relative h-24">
        {goalMl > 0 && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/60" style={{ bottom: `${(goalMl / max) * 100}%` }} aria-hidden />}
        <div className="flex h-full items-end gap-1">
          {days.map((d) => {
            const hit = goalMl > 0 && d.totalMl >= goalMl;
            return (
              <button
                key={d.day}
                type="button"
                role="listitem"
                onClick={() => onSelect(d.day)}
                aria-label={`${formatShortDay(d.day)}: ${formatVolumeMl(d.totalMl)}`}
                aria-pressed={d.day === selected}
                className="flex h-full flex-1 items-end"
              >
                <span
                  className={cn('w-full rounded-t-md transition-all duration-base', hit ? 'bg-water' : 'bg-water/40', d.day === selected && 'ring-2 ring-ink')}
                  style={{ height: `${Math.max((d.totalMl / max) * 100, d.totalMl > 0 ? 4 : 1.5)}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex gap-1" aria-hidden>
        {days.map((d) => (
          <span key={d.day} className={cn('flex-1 text-center text-micro', d.day === selected ? 'font-semibold text-ink' : 'text-faint')}>
            {parseDayKey(d.day).getDate()}
          </span>
        ))}
      </div>
    </div>
  );
}

function CustomWaterSheet({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (ml: number, note?: string) => Promise<boolean> }) {
  const [ml, setMl] = useState('');
  const [note, setNote] = useState('');
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (open) {
      setMl('');
      setNote('');
      setShowError(false);
    }
  }, [open]);
  const n = parseDecimal(ml);
  const error = validateNumber(n, RULES.waterQuickMl);
  const submit = async () => {
    if (error || n === null) {
      setShowError(true);
      return;
    }
    if (await onAdd(n, note)) onClose();
  };
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Outra quantidade"
      footer={
        <Button block size="lg" onClick={submit}>
          Adicionar
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4 pt-1"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <NumberInput label="Quantidade" suffix="ml" decimal={false} value={ml} onChange={setMl} error={showError ? error : null} autoFocus />
        <Input label="Observação (opcional)" value={note} onChange={setNote} maxLength={60} placeholder="Ex.: garrafa do treino" />
        <button type="submit" hidden />
      </form>
    </BottomSheet>
  );
}

function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function EditWaterSheet({ entry, onClose }: { entry: WaterEntry | null; onClose: () => void }) {
  const toast = useToast();
  const [ml, setMl] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (!entry) return;
    setMl(String(entry.amountMl));
    setTime(toTimeInput(entry.loggedAt));
    setNote(entry.note ?? '');
    setShowError(false);
  }, [entry]);
  if (!entry) return null;
  const n = parseDecimal(ml);
  const error = validateNumber(n, RULES.waterQuickMl);
  const timeValid = /^\d{2}:\d{2}$/.test(time);

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="Editar registro"
      footer={
        <div className="flex gap-2">
          <IconButton
            label="Excluir registro"
            className="size-12 shrink-0 rounded-control border border-danger/30 bg-danger/12 text-danger"
            onClick={async () => {
              const removed = await deleteWater(entry.id);
              onClose();
              if (removed) toast.success('Registro excluído.', { label: 'Desfazer', onClick: () => void restoreWater(removed) });
            }}
          >
            <Trash2 className="size-5" />
          </IconButton>
          <Button
            block
            onClick={async () => {
              if (error || n === null || !timeValid) {
                setShowError(true);
                return;
              }
              // Keep the entry's calendar date; only the clock time changes.
              const d = new Date(entry.loggedAt);
              const [h, m] = time.split(':').map(Number) as [number, number];
              d.setHours(h, m, 0, 0);
              await updateWater(entry.id, { amountMl: n, note, loggedAt: d.toISOString() });
              toast.success('Registro atualizado.');
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Quantidade" suffix="ml" decimal={false} value={ml} onChange={setMl} error={showError ? error : null} />
          <label className="flex flex-col gap-1.5">
            <span className="text-caption font-medium text-muted">Horário</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-13 rounded-control border border-line bg-elevated px-4 text-base text-ink scheme-dark" />
          </label>
        </div>
        <Input label="Observação" value={note} onChange={setNote} maxLength={60} />
      </div>
    </BottomSheet>
  );
}

function TargetSheet({ open, target, today, onClose }: { open: boolean; target: NutritionTarget | null; today: DayKey; onClose: () => void }) {
  const toast = useToast();
  const [ml, setMl] = useState('');
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (open) {
      setMl(target ? String(target.waterMl) : '3500');
      setShowError(false);
    }
  }, [open, target]);
  const n = parseDecimal(ml);
  const error = validateNumber(n, RULES.waterMl);
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Meta diária de água"
      footer={
        target ? (
          <Button
            block
            onClick={async () => {
              if (error || n === null) {
                setShowError(true);
                return;
              }
              await setTargetsFrom(today, { kcal: target.kcal, proteinG: target.proteinG, carbsG: target.carbsG, fatG: target.fatG, waterMl: n });
              toast.success(`Meta de água: ${formatVolumeMl(n)} a partir de hoje.`);
              onClose();
            }}
          >
            Salvar meta
          </Button>
        ) : (
          <LinkButton to="/mais/metas" block>
            Configurar metas diárias
          </LinkButton>
        )
      }
    >
      <div className="flex flex-col gap-3 pt-1">
        {target ? (
          <>
            <NumberInput label="Meta" suffix="ml" decimal={false} value={ml} onChange={setMl} error={showError ? error : null} autoFocus />
            <div className="flex flex-wrap gap-2">
              {[3000, 3500, 4000, 4500].map((v) => (
                <Button key={v} variant="secondary" size="sm" onClick={() => setMl(String(v))}>
                  {formatVolumeMl(v)}
                </Button>
              ))}
            </div>
            <p className="text-caption text-faint">Vale a partir de hoje; dias anteriores mantêm a meta da época.</p>
          </>
        ) : (
          <p className="text-body text-muted">Defina suas metas diárias primeiro (calorias, macros e água).</p>
        )}
      </div>
    </BottomSheet>
  );
}
