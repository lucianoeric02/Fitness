/**
 * Input validation for user-entered values. Each validator returns an error
 * message in pt-BR, or null when the value is valid.
 */
import { isDayKey, type DayKey } from '@/lib/dates';

export type ValidationResult = string | null;

export interface NumberRule {
  label: string;
  min: number;
  max: number;
  required?: boolean;
  integer?: boolean;
}

export function validateNumber(value: number | null, rule: NumberRule): ValidationResult {
  if (value === null || Number.isNaN(value)) {
    return rule.required === false ? null : `Informe ${rule.label.toLowerCase()}.`;
  }
  if (rule.integer && !Number.isInteger(value)) return `${rule.label} deve ser um número inteiro.`;
  if (value < rule.min || value > rule.max) {
    return `${rule.label} deve estar entre ${rule.min.toLocaleString('pt-BR')} e ${rule.max.toLocaleString('pt-BR')}.`;
  }
  return null;
}

/** Realistic ranges for an adult athlete; wide enough to never block real data. */
export const RULES = {
  weightKg: { label: 'Peso', min: 30, max: 300 },
  heightCm: { label: 'Altura', min: 120, max: 230, required: false },
  kcal: { label: 'Calorias', min: 800, max: 10000, integer: true },
  proteinG: { label: 'Proteína', min: 0, max: 600 },
  carbsG: { label: 'Carboidratos', min: 0, max: 1500 },
  fatG: { label: 'Gordura', min: 0, max: 500 },
  waterMl: { label: 'Água', min: 500, max: 10000, integer: true },
} satisfies Record<string, NumberRule>;

export function validateName(name: string): ValidationResult {
  const t = name.trim();
  if (t.length === 0) return 'Informe seu nome.';
  if (t.length > 40) return 'Use no máximo 40 caracteres.';
  return null;
}

export function validateBirthDate(value: string | undefined, today: DayKey): ValidationResult {
  if (!value) return null;
  if (!isDayKey(value)) return 'Data inválida.';
  if (value >= today) return 'A data de nascimento deve estar no passado.';
  if (value < '1900-01-01') return 'Data inválida.';
  return null;
}

export function hasErrors(errors: Record<string, ValidationResult | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
