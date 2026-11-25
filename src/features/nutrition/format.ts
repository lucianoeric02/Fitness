import type { FoodUnit, Nutrients } from '@/domain/models';
import { formatNumber } from '@/lib/numbers';

export function formatQty(qty: number, unit: FoodUnit = 'g'): string {
  return `${formatNumber(qty, 1)} ${unit}`;
}

/** "P 32 · C 0 · G 2,5" */
export function formatMacros(n: Pick<Nutrients, 'proteinG' | 'carbsG' | 'fatG'>): string {
  return `P ${formatNumber(n.proteinG, 1)} · C ${formatNumber(n.carbsG, 1)} · G ${formatNumber(n.fatG, 1)}`;
}

export function formatKcal(kcal: number): string {
  return `${formatNumber(kcal)} kcal`;
}
