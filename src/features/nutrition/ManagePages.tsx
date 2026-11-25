import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Star, Trash2, X } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button, IconButton, LinkButton } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSheet } from '@/components/ui/ConfirmSheet';
import { ChipGroup, Input, NumberInput, Segmented } from '@/components/ui/Field';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState, ErrorState, LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { applyMealTemplate, createMealTemplate, deleteMealTemplate, duplicateMealTemplate, updateMealTemplate } from '@/data/repos/foodLog';
import { addMeal, createFood, moveMeal, newServing, removeFood, removeMeal, toggleFavorite, updateFood, updateMeal, type FoodInput } from '@/data/repos/foods';
import { scaleNutrients, validateFoodNutrients } from '@/domain/calc/nutrition';
import { FOOD_CATEGORY_LABELS } from '@/domain/foodCatalog';
import type { Food, FoodCategory, FoodServing, FoodUnit, MealDefinition, MealTemplate, MealTemplateItem } from '@/domain/models';
import { validateText } from '@/domain/validation';
import { useFoods, useMeals, useMealTemplates } from '@/hooks/nutrition';
import { useToday } from '@/hooks/useToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';
import { FoodQuantitySheet } from './FoodQuantitySheet';
import { FoodSearch } from './FoodSearch';
import { formatKcal, formatMacros, formatQty } from './format';

// ---- Food catalog --------------------------------------------------------------

export function FoodsPage() {
  const navigate = useNavigate();
  return (
    <>
      <AppHeader
        title="Alimentos"
        back="/nutricao"
        action={
          <LinkButton to="/nutricao/alimentos/novo" size="sm" icon={<Plus className="size-4" />}>
            Novo
          </LinkButton>
        }
      />
      <PageContainer>
        <p className="px-1 text-caption text-faint">Valores de referência por 100 g/ml (base TACO/USDA). Marcas e preparos variam: ajuste conforme o rótulo.</p>
        <FoodSearch onPick={(f) => navigate(`/nutricao/alimentos/${f.id}`)} />
      </PageContainer>
    </>
  );
}

export function FoodFormPage() {
  const { id } = useParams();
  const foods = useFoods();
  if (foods === undefined) return <LoadingScreen />;
  const existing = id ? foods.find((f) => f.id === id) : undefined;
  if (id && !existing) {
    return (
      <>
        <AppHeader title="Alimento" back="/nutricao/alimentos" />
        <ErrorState title="Alimento não encontrado" />
      </>
    );
  }
  return <FoodForm key={id ?? 'new'} existing={existing} foods={foods} />;
}

interface ServingDraft {
  id: string;
  label: string;
  grams: string;
}

function FoodForm({ existing, foods }: { existing?: Food; foods: Food[] }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState<FoodCategory | undefined>(existing?.category);
  const [unit, setUnit] = useState<FoodUnit>(existing?.unit ?? 'g');
  const [brand, setBrand] = useState(existing?.brand ?? '');
  const [prep, setPrep] = useState(existing?.preparation ?? '');
  const [kcal, setKcal] = useState(toInputValue(existing?.per100g.kcal, 1));
  const [p, setP] = useState(toInputValue(existing?.per100g.proteinG, 1));
  const [c, setC] = useState(toInputValue(existing?.per100g.carbsG, 1));
  const [f, setF] = useState(toInputValue(existing?.per100g.fatG, 1));
  const [fiber, setFiber] = useState(toInputValue(existing?.per100g.fiberG, 1));
  const [servings, setServings] = useState<ServingDraft[]>((existing?.servings ?? []).map((s) => ({ id: s.id, label: s.label, grams: toInputValue(s.grams, 1) })));
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const snapshot = JSON.stringify([name, category, unit, brand, prep, kcal, p, c, f, fiber, servings]);
  const [saved, setSaved] = useState(snapshot);
  const guard = useUnsavedChangesGuard(snapshot !== saved && !saving && !confirmRemove);

  const n = { kcal: parseDecimal(kcal), p: parseDecimal(p), c: parseDecimal(c), f: parseDecimal(f), fiber: parseDecimal(fiber) };
  const duplicate = foods.some((x) => x.id !== existing?.id && !x.archivedAt && x.name.trim().toLowerCase() === name.trim().toLowerCase() && (x.brand ?? '') === brand.trim());
  const numErr = (v: number | null, label: string) => (v === null ? `Informe ${label}.` : null);
  const nutrients = { kcal: n.kcal ?? 0, proteinG: n.p ?? 0, carbsG: n.c ?? 0, fatG: n.f ?? 0, ...(n.fiber !== null ? { fiberG: n.fiber } : {}) };
  const servingErrors = servings.map((s) => {
    const g = parseDecimal(s.grams);
    return { label: validateText(s.label, 'a descrição', 30), grams: g === null || g <= 0 || g > 5000 ? 'Valor inválido.' : null };
  });
  const errors = {
    name: validateText(name, 'o nome', 60) ?? (duplicate ? 'Já existe um alimento com este nome.' : null),
    category: category ? null : 'Escolha a categoria.',
    kcal: numErr(n.kcal, 'as calorias'),
    p: numErr(n.p, 'a proteína'),
    c: numErr(n.c, 'os carboidratos'),
    f: numErr(n.f, 'a gordura'),
    values: n.kcal !== null && n.p !== null && n.c !== null && n.f !== null ? validateFoodNutrients(nutrients) : null,
    servings: servingErrors.some((e) => e.label || e.grams) ? 'Revise as porções.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    if (!valid) {
      setShowErrors(true);
      toast.error('Revise os campos destacados.');
      return;
    }
    const input: FoodInput = {
      name,
      category: category!,
      unit,
      brand,
      preparation: prep,
      per100g: nutrients,
      servings: servings.map<FoodServing>((s) => ({ id: s.id, label: s.label, grams: parseDecimal(s.grams)! })),
    };
    setSaving(true);
    try {
      if (existing) await updateFood(existing.id, input);
      else await createFood(input);
      setSaved(snapshot);
      toast.success(existing ? 'Alimento atualizado. Registros anteriores não mudam.' : 'Alimento criado.');
      navigate('/nutricao/alimentos', { replace: true });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  const example = n.kcal !== null && n.p !== null && n.c !== null && n.f !== null && !errors.values ? scaleNutrients(nutrients, 150) : null;

  return (
    <>
      <AppHeader
        title={existing ? existing.name : 'Novo alimento'}
        back="/nutricao/alimentos"
        action={
          existing && (
            <IconButton label={existing.favorite ? 'Remover dos favoritos' : 'Favoritar'} onClick={() => void toggleFavorite(existing.id)}>
              <Star className={existing.favorite ? 'size-6 fill-accent text-accent' : 'size-6'} />
            </IconButton>
          )
        }
      />
      <PageContainer className="gap-4">
        <Card className="flex flex-col gap-4">
          <Input label="Nome" value={name} onChange={setName} maxLength={60} error={err('name')} />
          <ChipGroup label="Categoria" value={category} onChange={setCategory} options={(Object.keys(FOOD_CATEGORY_LABELS) as FoodCategory[]).map((k) => ({ value: k, label: FOOD_CATEGORY_LABELS[k] }))} error={err('category')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Marca (opcional)" value={brand} onChange={setBrand} maxLength={40} />
            <Input label="Preparo (opcional)" value={prep} onChange={setPrep} maxLength={40} placeholder="Ex.: grelhado" />
          </div>
          <Segmented
            label="Medido em"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'g', label: 'Gramas (g)' },
              { value: 'ml', label: 'Mililitros (ml)' },
            ]}
          />
        </Card>

        <Card className="flex flex-col gap-4">
          <SectionHeader title={`Valores por 100 ${unit}`} className="mb-0" />
          <NumberInput label="Calorias" suffix="kcal" value={kcal} onChange={setKcal} error={err('kcal')} />
          <div className="grid grid-cols-3 gap-2.5">
            <NumberInput label="Proteína" suffix="g" value={p} onChange={setP} error={err('p')} />
            <NumberInput label="Carbo" suffix="g" value={c} onChange={setC} error={err('c')} />
            <NumberInput label="Gordura" suffix="g" value={f} onChange={setF} error={err('f')} />
          </div>
          <NumberInput label="Fibras (opcional)" suffix="g" value={fiber} onChange={setFiber} />
          {showErrors && errors.values && (
            <p role="alert" className="text-caption text-danger">
              {errors.values}
            </p>
          )}
          {example && (
            <p className="text-caption text-muted">
              Exemplo: 150 {unit} = <b className="text-ink">{formatNumber(example.kcal)} kcal</b> · {formatMacros(example)}
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionHeader title="Porções (opcional)" className="mb-0" />
          {servings.map((s, i) => (
            <div key={s.id} className="flex items-start gap-2">
              <div className="grid flex-1 grid-cols-2 gap-3">
                <Input label="Descrição" value={s.label} placeholder="Ex.: 1 unidade" maxLength={30} onChange={(v) => setServings((prev) => prev.map((x) => (x.id === s.id ? { ...x, label: v } : x)))} error={showErrors ? servingErrors[i]?.label : null} />
                <NumberInput label={`Peso (${unit})`} suffix={unit} value={s.grams} onChange={(v) => setServings((prev) => prev.map((x) => (x.id === s.id ? { ...x, grams: v } : x)))} error={showErrors ? servingErrors[i]?.grams : null} />
              </div>
              <IconButton label="Remover porção" className="mt-7" onClick={() => setServings((prev) => prev.filter((x) => x.id !== s.id))}>
                <X className="size-5" />
              </IconButton>
            </div>
          ))}
          <Button variant="secondary" size="sm" icon={<Plus className="size-4" />} onClick={() => setServings((prev) => [...prev, { ...newServing('', 0), grams: '' }])}>
            Adicionar porção
          </Button>
        </Card>

        <Button size="lg" block loading={saving} onClick={save}>
          {existing ? 'Salvar alimento' : 'Criar alimento'}
        </Button>
        {existing && (
          <Button variant="danger" block icon={<Trash2 className="size-5" />} onClick={() => setConfirmRemove(true)}>
            Remover alimento
          </Button>
        )}
      </PageContainer>
      {guard}
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Remover alimento?"
        description="Registros já feitos não mudam. Se o alimento estiver em um modelo de refeição, ele será arquivado em vez de excluído."
        confirmLabel="Remover"
        onConfirm={async () => {
          if (!existing) return;
          const r = await removeFood(existing.id);
          toast.success(r === 'archived' ? 'Alimento arquivado (usado em modelos).' : 'Alimento removido.');
          navigate('/nutricao/alimentos', { replace: true });
        }}
      />
    </>
  );
}

// ---- Meal templates ----------------------------------------------------------------

export function TemplatesPage() {
  const templates = useMealTemplates();
  const foods = useFoods();
  const toast = useToast();
  const navigate = useNavigate();
  if (templates === undefined || foods === undefined) return <LoadingScreen />;
  const kcalOf = (t: MealTemplate) =>
    t.items.reduce((acc, i) => {
      const f = foods.find((x) => x.id === i.foodId);
      return acc + (f ? scaleNutrients(f.per100g, i.grams).kcal : 0);
    }, 0);

  return (
    <>
      <AppHeader
        title="Modelos de refeição"
        back="/nutricao"
        action={
          <Button
            size="sm"
            icon={<Plus className="size-4" />}
            onClick={async () => {
              const t = await createMealTemplate('Novo modelo', []);
              navigate(`/nutricao/modelos/${t.id}`);
            }}
          >
            Novo
          </Button>
        }
      />
      <PageContainer>
        {templates.length === 0 ? (
          <Card>
            <EmptyState icon={<Copy className="size-6" />} title="Nenhum modelo salvo" description="Na tela de Nutrição, toque no ícone de uma refeição e escolha “Salvar como modelo”. Ou crie um modelo do zero." />
          </Card>
        ) : (
          templates.map((t) => (
            <Card key={t.id} className="flex items-center gap-2 py-2 pl-4 pr-1">
              <button type="button" onClick={() => navigate(`/nutricao/modelos/${t.id}`)} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center text-left">
                <span className="truncate text-body font-semibold">{t.name}</span>
                <span className="truncate text-caption text-muted">
                  {t.items.length} alimento{t.items.length === 1 ? '' : 's'} · ~{formatNumber(kcalOf(t))} kcal
                </span>
              </button>
              <IconButton
                label={`Duplicar ${t.name}`}
                onClick={async () => {
                  await duplicateMealTemplate(t.id);
                  toast.success('Modelo duplicado.');
                }}
              >
                <Copy className="size-5" />
              </IconButton>
            </Card>
          ))
        )}
      </PageContainer>
    </>
  );
}

export function TemplateEditPage() {
  const { id = '' } = useParams();
  const template = useLiveQuery(async () => (await db.mealTemplates.get(id)) ?? null, [id]);
  const foods = useFoods();
  const meals = useMeals();
  if (template === undefined || foods === undefined || meals === undefined) return <LoadingScreen />;
  if (!template) {
    return (
      <>
        <AppHeader title="Modelo" back="/nutricao/modelos" />
        <ErrorState title="Modelo não encontrado" />
      </>
    );
  }
  return <TemplateEditor key={template.id} template={template} foods={foods} meals={meals} />;
}

function TemplateEditor({ template, foods, meals }: { template: MealTemplate; foods: Food[]; meals: MealDefinition[] }) {
  const toast = useToast();
  const navigate = useNavigate();
  const today = useToday();
  const [params] = useSearchParams();
  const [name, setName] = useState(template.name);
  const [picker, setPicker] = useState(false);
  const [picked, setPicked] = useState<Food | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nameError = validateText(name, 'o nome', 40);

  const setItems = (items: MealTemplateItem[]) => updateMealTemplate(template.id, { items });
  const editingFood = editingIdx !== null ? foods.find((f) => f.id === template.items[editingIdx]?.foodId) ?? null : null;
  const total = template.items.reduce(
    (acc, i) => {
      const f = foods.find((x) => x.id === i.foodId);
      if (!f) return acc;
      const n = scaleNutrients(f.per100g, i.grams);
      return { kcal: acc.kcal + n.kcal, proteinG: acc.proteinG + n.proteinG, carbsG: acc.carbsG + n.carbsG, fatG: acc.fatG + n.fatG };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );

  return (
    <>
      <AppHeader title={template.name} back="/nutricao/modelos" />
      <PageContainer className="gap-4">
        <Card className="flex flex-col gap-3">
          <Input label="Nome" value={name} onChange={setName} maxLength={40} error={nameError} onBlur={() => !nameError && name.trim() !== template.name && void updateMealTemplate(template.id, { name })} />
          <p className="tabular text-caption text-muted">
            Total atual: <b className="text-ink">{formatKcal(total.kcal)}</b> · {formatMacros(total)}
          </p>
          <p className="text-caption text-faint">Salvo automaticamente. Os valores usam os dados atuais de cada alimento.</p>
        </Card>

        <Card className="p-0">
          {template.items.length === 0 ? (
            <p className="p-4 text-body text-muted">Nenhum alimento neste modelo.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {template.items.map((item, i) => {
                const f = foods.find((x) => x.id === item.foodId);
                return (
                  <li key={`${item.foodId}-${i}`} className="flex items-center gap-1 pl-4 pr-1">
                    <button type="button" className="flex min-h-14 min-w-0 flex-1 flex-col justify-center text-left" onClick={() => f && setEditingIdx(i)}>
                      <span className="truncate text-body">{item.foodName}</span>
                      <span className="text-caption text-muted">
                        {item.servingLabel ? `${item.servingLabel} · ` : ''}
                        {formatQty(item.grams, f?.unit)}
                        {f ? ` · ${formatNumber(scaleNutrients(f.per100g, item.grams).kcal)} kcal` : ' · alimento removido do catálogo'}
                      </span>
                    </button>
                    <IconButton label={`Remover ${item.foodName}`} onClick={() => void setItems(template.items.filter((_, j) => j !== i))}>
                      <X className="size-5" />
                    </IconButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Button variant="secondary" block icon={<Plus className="size-5" />} onClick={() => setPicker(true)}>
          Adicionar alimento
        </Button>
        {template.items.length > 0 && (
          <Button size="lg" block onClick={() => setApplyOpen(true)}>
            Adicionar a um dia
          </Button>
        )}
        <Button variant="danger" block icon={<Trash2 className="size-5" />} onClick={() => setConfirmDelete(true)}>
          Excluir modelo
        </Button>
      </PageContainer>

      <BottomSheet open={picker} onClose={() => setPicker(false)} title="Adicionar ao modelo">
        <div className="pt-1">
          <FoodSearch
            onPick={(f) => {
              setPicker(false);
              setPicked(f);
            }}
          />
        </div>
      </BottomSheet>
      <FoodQuantitySheet
        food={picked}
        meals={meals}
        showMeal={false}
        showNote={false}
        confirmLabel="Adicionar ao modelo"
        onClose={() => setPicked(null)}
        onConfirm={async (r) => {
          if (!picked) return;
          await setItems([...template.items, { foodId: picked.id, foodName: picked.name, grams: r.quantity, servingLabel: r.servingLabel }]);
          setPicked(null);
        }}
      />
      <FoodQuantitySheet
        food={editingFood}
        meals={meals}
        showMeal={false}
        showNote={false}
        initialQuantity={editingIdx !== null ? template.items[editingIdx]?.grams : undefined}
        confirmLabel="Salvar quantidade"
        onClose={() => setEditingIdx(null)}
        onConfirm={async (r) => {
          if (editingIdx === null) return;
          await setItems(template.items.map((it, j) => (j === editingIdx ? { ...it, grams: r.quantity, servingLabel: r.servingLabel } : it)));
          setEditingIdx(null);
        }}
      />
      <ApplyTemplateSheet
        open={applyOpen}
        meals={meals}
        defaultDay={params.get('dia') ?? today}
        defaultSlot={template.slot}
        onClose={() => setApplyOpen(false)}
        onApply={async (day, slot) => {
          const r = await applyMealTemplate(template.id, day, slot);
          setApplyOpen(false);
          toast.success(`${r.added} alimento${r.added === 1 ? '' : 's'} adicionado${r.added === 1 ? '' : 's'}.${r.skipped.length ? ` Ignorados: ${r.skipped.join(', ')}.` : ''}`);
          navigate(day === today ? '/nutricao' : `/nutricao?dia=${day}`);
        }}
      />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Excluir modelo?"
        description="O modelo é removido. Refeições já registradas com ele não mudam."
        confirmLabel="Excluir"
        onConfirm={async () => {
          await deleteMealTemplate(template.id);
          toast.success('Modelo excluído.');
          navigate('/nutricao/modelos', { replace: true });
        }}
      />
    </>
  );
}

function ApplyTemplateSheet({
  open,
  meals,
  defaultDay,
  defaultSlot,
  onClose,
  onApply,
}: {
  open: boolean;
  meals: MealDefinition[];
  defaultDay: string;
  defaultSlot?: string;
  onClose: () => void;
  onApply: (day: string, slot: string) => Promise<void>;
}) {
  const today = useToday();
  const [day, setDay] = useState(defaultDay);
  const [slot, setSlot] = useState<string | undefined>(defaultSlot ?? meals[0]?.id);
  const dayError = !day ? 'Informe a data.' : day > today ? 'Não é possível registrar em dias futuros.' : null;
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Adicionar a um dia"
      footer={
        <Button block disabled={Boolean(dayError) || !slot} onClick={() => slot && void onApply(day, slot)}>
          Adicionar
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-medium text-muted">Dia</span>
          <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className="h-13 rounded-control border border-line bg-elevated px-4 text-base text-ink scheme-dark" />
          {dayError && <span className="text-caption text-danger">{dayError}</span>}
        </label>
        <ChipGroup label="Refeição" value={slot} onChange={setSlot} options={meals.map((m) => ({ value: m.id, label: m.name }))} />
      </div>
    </BottomSheet>
  );
}

// ---- Meal categories ----------------------------------------------------------------

export function MealsSettingsPage() {
  const meals = useMeals(true);
  const toast = useToast();
  const [editing, setEditing] = useState<MealDefinition | 'new' | null>(null);
  if (meals === undefined) return <LoadingScreen />;
  return (
    <>
      <AppHeader
        title="Refeições"
        back="/nutricao"
        action={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
            Nova
          </Button>
        }
      />
      <PageContainer>
        <p className="px-1 text-caption text-faint">Renomeie, reordene ou oculte refeições. Metas por refeição são opcionais.</p>
        {meals.map((m, i) => (
          <Card key={m.id} className="flex items-center gap-1 py-2 pl-4 pr-1">
            <button type="button" onClick={() => setEditing(m)} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center text-left">
              <span className={m.hidden ? 'truncate text-body text-faint line-through' : 'truncate text-body font-semibold'}>{m.name}</span>
              <span className="text-caption text-muted">{m.target?.kcal ? `Meta: ${formatNumber(m.target.kcal)} kcal` : 'Sem meta'}</span>
            </button>
            <IconButton label={m.hidden ? `Mostrar ${m.name}` : `Ocultar ${m.name}`} onClick={() => void updateMeal(m.id, { hidden: !m.hidden })}>
              {m.hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </IconButton>
            <div className="flex flex-col">
              <IconButton label={`Mover ${m.name} para cima`} disabled={i === 0} onClick={() => void moveMeal(m.id, -1)}>
                <ArrowUp className="size-4" />
              </IconButton>
              <IconButton label={`Mover ${m.name} para baixo`} disabled={i === meals.length - 1} onClick={() => void moveMeal(m.id, 1)}>
                <ArrowDown className="size-4" />
              </IconButton>
            </div>
          </Card>
        ))}
      </PageContainer>
      <MealSheet
        meal={editing}
        onClose={() => setEditing(null)}
        onRemove={async (m) => {
          const r = await removeMeal(m.id);
          toast.success(r === 'hidden' ? 'Refeição ocultada (tem registros no histórico).' : 'Refeição removida.');
          setEditing(null);
        }}
      />
    </>
  );
}

function MealSheet({ meal, onClose, onRemove }: { meal: MealDefinition | 'new' | null; onClose: () => void; onRemove: (m: MealDefinition) => Promise<void> }) {
  const toast = useToast();
  const existing = meal && meal !== 'new' ? meal : null;
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [prevMeal, setPrevMeal] = useState<typeof meal>(null);
  if (meal !== prevMeal) {
    setPrevMeal(meal);
    setName(existing?.name ?? '');
    setKcal(toInputValue(existing?.target?.kcal, 0));
    setP(toInputValue(existing?.target?.proteinG, 0));
    setShowErrors(false);
  }
  if (!meal) return null;
  const nameError = validateText(name, 'o nome', 30);
  const kcalN = parseDecimal(kcal);
  const pN = parseDecimal(p);
  const targetError = (kcalN !== null && (kcalN <= 0 || kcalN > 5000)) || (pN !== null && (pN <= 0 || pN > 400)) ? 'Metas devem ser positivas e realistas.' : null;

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={existing ? 'Editar refeição' : 'Nova refeição'}
      footer={
        <div className="flex gap-2">
          {existing && (
            <IconButton label="Remover refeição" className="size-12 shrink-0 rounded-control border border-danger/30 bg-danger/12 text-danger" onClick={() => void onRemove(existing)}>
              <Trash2 className="size-5" />
            </IconButton>
          )}
          <Button
            block
            onClick={async () => {
              if (nameError || targetError) {
                setShowErrors(true);
                return;
              }
              const target = kcalN !== null || pN !== null ? { ...(kcalN !== null ? { kcal: kcalN } : {}), ...(pN !== null ? { proteinG: pN } : {}) } : undefined;
              if (existing) await updateMeal(existing.id, { name, target });
              else await updateMeal((await addMeal(name)).id, { target });
              toast.success('Refeição salva.');
              onClose();
            }}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-1">
        <Input label="Nome" value={name} onChange={setName} maxLength={30} placeholder="Ex.: Lanche da tarde" error={showErrors ? nameError : null} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Meta kcal (opcional)" suffix="kcal" decimal={false} value={kcal} onChange={setKcal} />
          <NumberInput label="Meta proteína (opcional)" suffix="g" decimal={false} value={p} onChange={setP} />
        </div>
        {showErrors && targetError && <p className="text-caption text-danger">{targetError}</p>}
      </div>
    </BottomSheet>
  );
}
