import { AlertTriangle } from 'lucide-react';
import { NumberInput } from '@/components/ui/Field';
import { caloriesFromMacros, macroCalorieSplit, macroTargetMismatch } from '@/domain/calc/nutrition';
import { RULES, validateNumber } from '@/domain/validation';
import type { TargetValues } from '@/data/repos/targets';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';

export interface TargetsDraft {
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  waterMl: string;
}

export function targetsToDraft(t: TargetValues): TargetsDraft {
  return {
    kcal: toInputValue(t.kcal, 0),
    proteinG: toInputValue(t.proteinG),
    carbsG: toInputValue(t.carbsG),
    fatG: toInputValue(t.fatG),
    waterMl: toInputValue(t.waterMl, 0),
  };
}

export function parseTargetsDraft(d: TargetsDraft) {
  const values = {
    kcal: parseDecimal(d.kcal),
    proteinG: parseDecimal(d.proteinG),
    carbsG: parseDecimal(d.carbsG),
    fatG: parseDecimal(d.fatG),
    waterMl: parseDecimal(d.waterMl),
  };
  const errors = {
    kcal: validateNumber(values.kcal, RULES.kcal),
    proteinG: validateNumber(values.proteinG, RULES.proteinG),
    carbsG: validateNumber(values.carbsG, RULES.carbsG),
    fatG: validateNumber(values.fatG, RULES.fatG),
    waterMl: validateNumber(values.waterMl, RULES.waterMl),
  };
  const valid = Object.values(errors).every((e) => e === null);
  return { values: valid ? (values as TargetValues) : null, errors };
}

export function TargetsForm({
  draft,
  onChange,
  showErrors,
  bodyWeightKg,
}: {
  draft: TargetsDraft;
  onChange: (d: TargetsDraft) => void;
  showErrors: boolean;
  bodyWeightKg?: number | null;
}) {
  const { errors } = parseTargetsDraft(draft);
  const set = (k: keyof TargetsDraft) => (v: string) => onChange({ ...draft, [k]: v });
  const err = (k: keyof TargetsDraft) => (showErrors ? errors[k] : null);

  const p = parseDecimal(draft.proteinG) ?? 0;
  const c = parseDecimal(draft.carbsG) ?? 0;
  const f = parseDecimal(draft.fatG) ?? 0;
  const kcal = parseDecimal(draft.kcal) ?? 0;
  const macroKcal = caloriesFromMacros({ proteinG: p, carbsG: c, fatG: f });
  const split = macroCalorieSplit({ proteinG: p, carbsG: c, fatG: f });
  const mismatch = macroTargetMismatch({ kcal, proteinG: p, carbsG: c, fatG: f });
  const perKg = bodyWeightKg && p > 0 ? p / bodyWeightKg : null;

  return (
    <div className="flex flex-col gap-4">
      <NumberInput label="Calorias por dia" suffix="kcal" decimal={false} value={draft.kcal} onChange={set('kcal')} error={err('kcal')} />

      <div className="grid grid-cols-3 gap-2.5">
        <NumberInput label="Proteína" suffix="g" value={draft.proteinG} onChange={set('proteinG')} error={err('proteinG')} />
        <NumberInput label="Carbo" suffix="g" value={draft.carbsG} onChange={set('carbsG')} error={err('carbsG')} />
        <NumberInput label="Gordura" suffix="g" value={draft.fatG} onChange={set('fatG')} error={err('fatG')} />
      </div>

      {macroKcal > 0 && (
        <div className="rounded-control border border-line/70 bg-bg/40 p-3.5">
          <div className="flex h-2 overflow-hidden rounded-full bg-elevated" aria-hidden>
            <div style={{ width: `${split.protein * 100}%`, background: 'var(--color-protein)' }} />
            <div style={{ width: `${split.carbs * 100}%`, background: 'var(--color-carbs)' }} />
            <div style={{ width: `${split.fat * 100}%`, background: 'var(--color-fat)' }} />
          </div>
          <div className="mt-2.5 flex justify-between text-caption text-muted">
            <span>
              <b className="text-protein">{Math.round(split.protein * 100)}%</b> prot.
            </span>
            <span>
              <b className="text-carbs">{Math.round(split.carbs * 100)}%</b> carbo
            </span>
            <span>
              <b className="text-fat">{Math.round(split.fat * 100)}%</b> gord.
            </span>
          </div>
          <p className="mt-2 text-caption text-muted">
            Os macros somam <b className="tabular text-ink">{formatNumber(macroKcal)} kcal</b>
            {perKg !== null && (
              <>
                {' '}· proteína de <b className="tabular text-ink">{formatNumber(perKg, 1)} g/kg</b>
              </>
            )}
          </p>
          {mismatch.significant && kcal > 0 && (
            <p className="mt-2 flex items-start gap-2 text-caption text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Diferença de {formatNumber(Math.abs(mismatch.diff))} kcal entre a meta calórica e a soma dos macros.
                Você pode salvar assim, mas os anéis de progresso podem não bater.
              </span>
            </p>
          )}
        </div>
      )}

      <NumberInput
        label="Água por dia"
        suffix="ml"
        decimal={false}
        value={draft.waterMl}
        onChange={set('waterMl')}
        error={err('waterMl')}
        hint={bodyWeightKg ? `Referência comum: ~35 ml/kg ≈ ${formatNumber(Math.round((bodyWeightKg * 35) / 50) * 50)} ml` : undefined}
      />
    </div>
  );
}
