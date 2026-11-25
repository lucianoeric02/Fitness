import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { ChipGroup, Input, NumberInput } from '@/components/ui/Field';
import { scaleNutrients } from '@/domain/calc/nutrition';
import type { Food, MealDefinition } from '@/domain/models';
import { cn } from '@/lib/cn';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';
import { formatMacros } from './format';

export interface QuantityResult {
  quantity: number;
  servingLabel?: string;
  slot: string;
  note?: string;
}

/**
 * Pick a quantity (grams/ml or a serving multiple), the meal, and see the
 * nutrients before saving. Values are proportional to the per-100 reference.
 */
export function FoodQuantitySheet({
  food,
  meals,
  defaultSlot,
  initialQuantity,
  confirmLabel = 'Adicionar',
  showMeal = true,
  showNote = true,
  onClose,
  onConfirm,
}: {
  food: Food | null;
  meals: MealDefinition[];
  defaultSlot?: string;
  initialQuantity?: number;
  confirmLabel?: string;
  showMeal?: boolean;
  showNote?: boolean;
  onClose: () => void;
  onConfirm: (r: QuantityResult) => Promise<void>;
}) {
  const [qty, setQty] = useState('');
  const [serving, setServing] = useState<{ id: string; count: string } | null>(null);
  const [slot, setSlot] = useState<string | undefined>(defaultSlot);
  const [note, setNote] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!food) return;
    const first = food.servings[0];
    if (initialQuantity !== undefined) {
      setQty(toInputValue(initialQuantity, 1));
      setServing(null);
    } else if (first) {
      setServing({ id: first.id, count: '1' });
      setQty(toInputValue(first.grams, 1));
    } else {
      setServing(null);
      setQty('100');
    }
    setSlot(defaultSlot ?? meals[0]?.id);
    setNote('');
    setShowErrors(false);
  }, [food, defaultSlot, initialQuantity, meals]);

  if (!food) return null;

  const unit = food.unit;
  const activeServing = serving ? food.servings.find((s) => s.id === serving.id) : undefined;
  const servingCount = serving ? parseDecimal(serving.count) : null;
  const quantity = activeServing ? (servingCount !== null ? servingCount * activeServing.grams : null) : parseDecimal(qty);
  const qtyError = quantity === null || !(quantity > 0) ? 'Informe uma quantidade maior que zero.' : quantity > 5000 ? 'Quantidade alta demais.' : null;
  const preview = quantity && quantity > 0 ? scaleNutrients(food.per100g, quantity) : null;
  const servingLabel = activeServing && servingCount !== null ? (servingCount === 1 ? activeServing.label : `${formatNumber(servingCount, 2)} × ${activeServing.label}`) : undefined;

  const confirm = async () => {
    if (qtyError || !slot) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm({ quantity: quantity!, servingLabel, slot, note });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={food.name}
      footer={
        <Button block size="lg" loading={busy} onClick={confirm}>
          {confirmLabel}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-4 pt-1"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        <p className="text-caption text-muted">
          Por 100 {unit}: {formatNumber(food.per100g.kcal)} kcal · {formatMacros(food.per100g)}
          {food.brand && ` · ${food.brand}`}
        </p>

        {food.servings.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Porções">
            <button
              type="button"
              aria-pressed={!serving}
              onClick={() => {
                setServing(null);
                if (quantity) setQty(toInputValue(quantity, 1));
              }}
              className={cn('pressable min-h-10 rounded-full border px-4 text-sm font-medium', !serving ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line bg-elevated text-muted')}
            >
              {unit === 'ml' ? 'Mililitros' : 'Gramas'}
            </button>
            {food.servings.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={serving?.id === s.id}
                onClick={() => setServing({ id: s.id, count: serving?.count ?? '1' })}
                className={cn('pressable min-h-10 rounded-full border px-4 text-sm font-medium', serving?.id === s.id ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line bg-elevated text-muted')}
              >
                {s.label} ({formatNumber(s.grams, 1)} {unit})
              </button>
            ))}
          </div>
        )}

        {activeServing ? (
          <NumberInput
            label={`Quantidade de "${activeServing.label}"`}
            value={serving!.count}
            onChange={(v) => setServing({ id: activeServing.id, count: v })}
            error={showErrors ? qtyError : null}
            hint={quantity ? `= ${formatNumber(quantity, 1)} ${unit}` : undefined}
            autoFocus
          />
        ) : (
          <NumberInput label="Quantidade" suffix={unit} value={qty} onChange={setQty} error={showErrors ? qtyError : null} autoFocus />
        )}

        <div className="grid grid-cols-4 gap-2 rounded-control bg-elevated/60 p-3 text-center" aria-live="polite">
          <PreviewStat label="kcal" value={preview ? formatNumber(preview.kcal) : '—'} strong />
          <PreviewStat label="Prot." value={preview ? `${formatNumber(preview.proteinG, 1)} g` : '—'} />
          <PreviewStat label="Carbo" value={preview ? `${formatNumber(preview.carbsG, 1)} g` : '—'} />
          <PreviewStat label="Gord." value={preview ? `${formatNumber(preview.fatG, 1)} g` : '—'} />
        </div>

        {showMeal && meals.length > 0 && (
          <ChipGroup label="Refeição" value={slot} onChange={setSlot} options={meals.map((m) => ({ value: m.id, label: m.name }))} error={showErrors && !slot ? 'Escolha a refeição.' : null} />
        )}
        {showNote && <Input label="Observação (opcional)" value={note} onChange={setNote} maxLength={80} />}
        <button type="submit" hidden />
      </form>
    </BottomSheet>
  );
}

function PreviewStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className={cn('tabular font-semibold', strong ? 'text-lg text-ink' : 'text-sm text-ink')}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
