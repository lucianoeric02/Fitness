import { useEffect, useState } from 'react';
import { Ellipsis, ChevronLeft, ChevronRight, Copy, History, LayoutList, Plus, Settings2, Trash2, UtensilsCrossed } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChipGroup, Input, NumberInput } from '@/components/ui/Field';
import { ProgressBar, ProgressRing } from '@/components/ui/Progress';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { applyMealTemplate, copyMeal, deleteFoodEntry, duplicateFoodEntry, restoreFoodEntry, saveMealAsTemplate, updateFoodEntry } from '@/data/repos/foodLog';
import { dailyNutritionProgress, metricProgress } from '@/domain/calc/nutrition';
import type { FoodEntry, MealDefinition, Nutrients } from '@/domain/models';
import { useTargetForDay } from '@/hooks/data';
import { useDayLog, useMeals, useMealTemplates } from '@/hooks/nutrition';
import { useToday } from '@/hooks/useToday';
import { addDays, formatLongDay, formatRelativeDay, isDayKey, type DayKey } from '@/lib/dates';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';
import { formatKcal, formatMacros, formatQty } from './format';

export function NutritionPage() {
  const today = useToday();
  const [params, setParams] = useSearchParams();
  const raw = params.get('dia');
  const day: DayKey = raw && isDayKey(raw) && raw <= today ? raw : today;
  const setDay = (d: DayKey) => setParams(d === today ? {} : { dia: d }, { replace: true });

  const target = useTargetForDay(day);
  const log = useDayLog(day);
  const meals = useMeals();
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [mealMenu, setMealMenu] = useState<MealDefinition | null>(null);

  if (target === undefined || log === undefined || meals === undefined) return <LoadingScreen />;
  const progress = target ? dailyNutritionProgress(log.totals, target) : null;
  const hiddenWithEntries = [...new Set(log.entries.map((e) => e.slot))].filter((id) => !meals.some((m) => m.id === id));

  return (
    <>
      <AppHeader
        title="Nutrição"
        description="Refeições do dia, calorias e macros em relação às suas metas."
        action={
          <LinkButton to={`/nutricao/adicionar${day === today ? '' : `?dia=${day}`}`} size="sm" icon={<Plus className="size-4" />}>
            Alimento
          </LinkButton>
        }
      />
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

        {progress ? (
          <Card tone="accent" className="flex flex-col gap-4 p-5">
            <div className="flex items-center gap-5">
              <ProgressRing ratio={progress.kcal.ratio} over={progress.kcal.over} size={112} stroke={10} label={`${Math.round(progress.kcal.rawRatio * 100)}% da meta calórica`}>
                <span className="tabular font-display text-3xl font-bold">{formatNumber(Math.abs(progress.kcal.remaining))}</span>
                <span className="text-xs text-muted">{progress.kcal.over ? 'kcal acima' : 'restantes'}</span>
              </ProgressRing>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 text-caption">
                <Row label="Meta" value={formatKcal(progress.kcal.target)} />
                <Row label="Consumidas" value={formatKcal(progress.kcal.consumed)} />
                <Row label={progress.kcal.over ? 'Acima' : 'Restantes'} value={formatKcal(Math.abs(progress.kcal.remaining))} />
              </div>
            </div>
            {[
              { label: 'Proteína', p: progress.protein, color: 'var(--color-protein)' },
              { label: 'Carboidratos', p: progress.carbs, color: 'var(--color-carbs)' },
              { label: 'Gordura', p: progress.fat, color: 'var(--color-fat)' },
            ].map(({ label, p, color }) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-caption">
                  <span className="font-medium">{label}</span>
                  <span className="tabular text-muted">
                    <b className="text-ink">{formatNumber(p.consumed, 1)}</b> / {formatNumber(p.target)} g · {p.over ? `+${formatNumber(-p.remaining, 1)}` : `faltam ${formatNumber(p.remaining, 1)}`} g
                  </span>
                </div>
                <ProgressBar ratio={p.ratio} over={p.over} color={color} label={`${label}: ${Math.round(p.rawRatio * 100)}%`} />
              </div>
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState icon={<UtensilsCrossed className="size-6" />} title="Metas diárias não configuradas" description="Defina calorias e macros para acompanhar o progresso do dia." action={<LinkButton to="/mais/metas">Definir metas</LinkButton>} className="py-6" />
          </Card>
        )}

        {log.entries.length === 0 && (
          <Card>
            <EmptyState
              icon={<UtensilsCrossed className="size-6" />}
              title="Nenhuma refeição registrada"
              description={day === today ? 'Adicione sua primeira refeição do dia, ou aplique um modelo salvo.' : 'Nada registrado neste dia.'}
              action={
                <LinkButton to={`/nutricao/adicionar${day === today ? '' : `?dia=${day}`}`} icon={<Plus className="size-5" />}>
                  Adicionar alimento
                </LinkButton>
              }
              className="py-6"
            />
          </Card>
        )}

        {meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            day={day}
            today={today}
            entries={log.entries.filter((e) => e.slot === meal.id)}
            totals={log.byMeal.get(meal.id)}
            onEdit={setEditing}
            onMenu={() => setMealMenu(meal)}
          />
        ))}
        {hiddenWithEntries.map((id) => (
          <MealCard key={id} meal={{ id, name: 'Refeição oculta', sortOrder: 99, hidden: true, createdAt: '', updatedAt: '' }} day={day} today={today} entries={log.entries.filter((e) => e.slot === id)} totals={log.byMeal.get(id)} onEdit={setEditing} onMenu={() => undefined} />
        ))}

        <div className="grid grid-cols-1 gap-2 xs:grid-cols-3">
          <LinkButton to="/nutricao/modelos" variant="secondary" size="sm" icon={<LayoutList className="size-4" />}>
            Modelos
          </LinkButton>
          <LinkButton to="/nutricao/alimentos" variant="secondary" size="sm" icon={<UtensilsCrossed className="size-4" />}>
            Alimentos
          </LinkButton>
          <LinkButton to="/nutricao/refeicoes" variant="secondary" size="sm" icon={<Settings2 className="size-4" />}>
            Refeições
          </LinkButton>
        </div>
      </PageContainer>

      <EntrySheet entry={editing} meals={meals} onClose={() => setEditing(null)} />
      <MealActionsSheet meal={mealMenu} day={day} hasEntries={log.entries.some((e) => e.slot === mealMenu?.id)} onClose={() => setMealMenu(null)} />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="tabular font-semibold text-ink">{value}</span>
    </div>
  );
}

function MealCard({
  meal,
  day,
  today,
  entries,
  totals,
  onEdit,
  onMenu,
}: {
  meal: MealDefinition;
  day: DayKey;
  today: DayKey;
  entries: FoodEntry[];
  totals?: Nutrients;
  onEdit: (e: FoodEntry) => void;
  onMenu: () => void;
}) {
  const kcalTarget = meal.target?.kcal;
  const p = kcalTarget ? metricProgress(totals?.kcal ?? 0, kcalTarget) : null;
  return (
    <Card className="p-0">
      <div className="flex items-center gap-2 py-2 pl-4 pr-1">
        <div className="min-w-0 flex-1">
          <h2 className="text-body font-semibold">{meal.name}</h2>
          <p className="tabular text-caption text-muted">
            {totals ? `${formatKcal(totals.kcal)} · ${formatMacros(totals)}` : 'Vazio'}
            {kcalTarget ? ` · meta ${formatNumber(kcalTarget)}` : ''}
          </p>
        </div>
        {!meal.hidden && (
          <>
            <IconButton label={`Mais opções de ${meal.name}`} onClick={onMenu}>
              <Ellipsis className="size-5" />
            </IconButton>
            <Link
              to={`/nutricao/adicionar?refeicao=${meal.id}${day === today ? '' : `&dia=${day}`}`}
              aria-label={`Adicionar em ${meal.name}`}
              className="pressable flex size-touch items-center justify-center rounded-full text-accent active:bg-elevated"
            >
              <Plus className="size-6" />
            </Link>
          </>
        )}
      </div>
      {p && <ProgressBar ratio={p.ratio} over={p.over} label={`Meta de ${meal.name}`} className="mx-4 mb-2 h-1" />}
      {entries.length > 0 && (
        <ul className="divide-y divide-line/60 border-t border-line/60">
          {entries.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => onEdit(e)} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-2 text-left active:bg-elevated">
                <span className="min-w-0">
                  <span className="block truncate text-body">{e.foodName}</span>
                  <span className="block truncate text-caption text-muted">
                    {e.servingLabel ? `${e.servingLabel} · ` : ''}
                    {formatQty(e.grams, e.unit)}
                    {e.note ? ` · ${e.note}` : ''}
                  </span>
                </span>
                <span className="tabular shrink-0 text-sm font-semibold">{formatNumber(e.nutrients.kcal)} kcal</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EntrySheet({ entry, meals, onClose }: { entry: FoodEntry | null; meals: MealDefinition[]; onClose: () => void }) {
  const toast = useToast();
  const [qty, setQty] = useState('');
  const [slot, setSlot] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setQty(toInputValue(entry.grams, 1));
    setSlot(entry.slot);
    setNote(entry.note ?? '');
    setShowErrors(false);
  }, [entry]);

  if (!entry) return null;
  const q = parseDecimal(qty);
  const qtyError = q === null || q <= 0 ? 'Informe uma quantidade maior que zero.' : q > 5000 ? 'Quantidade alta demais.' : null;
  const perUnit = entry.grams > 0 ? entry.nutrients.kcal / entry.grams : 0;

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={entry.foodName}
      footer={
        <div className="flex gap-2">
          <IconButton
            label="Excluir registro"
            className="size-12 shrink-0 rounded-control border border-danger/30 bg-danger/12 text-danger"
            onClick={async () => {
              const removed = await deleteFoodEntry(entry.id);
              onClose();
              toast.success('Registro excluído.', removed ? { label: 'Desfazer', onClick: () => void restoreFoodEntry(removed) } : undefined);
            }}
          >
            <Trash2 className="size-5" />
          </IconButton>
          <IconButton
            label="Duplicar registro"
            className="size-12 shrink-0 rounded-control border border-line bg-elevated text-ink"
            onClick={async () => {
              await duplicateFoodEntry(entry.id);
              onClose();
              toast.success('Registro duplicado.');
            }}
          >
            <Copy className="size-5" />
          </IconButton>
          <Button
            block
            onClick={async () => {
              if (qtyError || !slot) {
                setShowErrors(true);
                return;
              }
              await updateFoodEntry(entry.id, { quantity: q!, slot, note, servingLabel: q === entry.grams ? undefined : null });
              const moved = slot !== entry.slot;
              toast.success(moved ? `Movido para ${meals.find((m) => m.id === slot)?.name ?? 'outra refeição'}.` : 'Registro atualizado.');
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <NumberInput label="Quantidade" suffix={entry.unit ?? 'g'} value={qty} onChange={setQty} error={showErrors ? qtyError : null} hint={q && q > 0 ? `≈ ${formatNumber(perUnit * q)} kcal` : undefined} />
        <ChipGroup label="Refeição" value={slot} onChange={setSlot} options={meals.map((m) => ({ value: m.id, label: m.name }))} />
        <Input label="Observação" value={note} onChange={setNote} maxLength={80} />
        <p className="text-caption text-faint">Valores calculados no momento do registro; editar o alimento no catálogo não altera este registro.</p>
      </div>
    </BottomSheet>
  );
}

function MealActionsSheet({ meal, day, hasEntries, onClose }: { meal: MealDefinition | null; day: DayKey; hasEntries: boolean; onClose: () => void }) {
  const toast = useToast();
  const templates = useMealTemplates();
  const [name, setName] = useState('');
  useEffect(() => {
    if (meal) setName(meal.name);
  }, [meal]);
  if (!meal) return null;

  return (
    <BottomSheet open onClose={onClose} title={meal.name}>
      <div className="flex flex-col gap-5 pt-1">
        <Button
          variant="secondary"
          block
          icon={<History className="size-5" />}
          onClick={async () => {
            const n = await copyMeal({ day: addDays(day, -1), slot: meal.id }, { day, slot: meal.id });
            onClose();
            if (n) toast.success(`${n} alimento${n > 1 ? 's' : ''} copiado${n > 1 ? 's' : ''} do dia anterior.`);
            else toast.info(`Nenhum alimento em ${meal.name} no dia anterior.`);
          }}
        >
          Repetir do dia anterior
        </Button>

        {hasEntries && (
          <div className="flex flex-col gap-2">
            <SectionHeader title="Salvar como modelo" className="mb-0" />
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Nome do modelo" value={name} onChange={setName} maxLength={40} />
              </div>
              <Button
                onClick={async () => {
                  if (!name.trim()) return;
                  try {
                    await saveMealAsTemplate(day, meal.id, name);
                    toast.success('Modelo salvo.');
                    onClose();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.');
                  }
                }}
              >
                Salvar
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <SectionHeader title="Aplicar modelo" className="mb-0" />
          {templates === undefined ? null : templates.length === 0 ? (
            <p className="text-caption text-muted">Nenhum modelo salvo ainda. Salve uma refeição como modelo para repetir com um toque.</p>
          ) : (
            <ul className="-mx-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full flex-col justify-center rounded-xl px-3 py-2 text-left active:bg-elevated"
                    onClick={async () => {
                      const r = await applyMealTemplate(t.id, day, meal.id);
                      onClose();
                      toast.success(`${t.name}: ${r.added} alimento${r.added === 1 ? '' : 's'} adicionado${r.added === 1 ? '' : 's'}.${r.skipped.length ? ` ${r.skipped.length} removido${r.skipped.length > 1 ? 's' : ''} do catálogo foi ignorado.` : ''}`);
                    }}
                  >
                    <span className="text-body font-medium">{t.name}</span>
                    <span className="truncate text-caption text-muted">{t.items.map((i) => i.foodName).join(', ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
