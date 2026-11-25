import { describe, expect, it } from 'vitest';
import { RULES, validateBirthDate, validateName, validateNumber } from './validation';

describe('validation', () => {
  it('validates numbers against rules', () => {
    expect(validateNumber(82.5, RULES.weightKg)).toBeNull();
    expect(validateNumber(null, RULES.weightKg)).toBe('Informe peso.');
    expect(validateNumber(10, RULES.weightKg)).toMatch(/entre/);
    expect(validateNumber(null, RULES.heightCm)).toBeNull(); // optional
    expect(validateNumber(3400.5, RULES.kcal)).toMatch(/inteiro/);
  });

  it('validates names and birth dates', () => {
    expect(validateName('  ')).not.toBeNull();
    expect(validateName('Rafael')).toBeNull();
    expect(validateBirthDate(undefined, '2026-11-25')).toBeNull();
    expect(validateBirthDate('2030-01-01', '2026-11-25')).not.toBeNull();
    expect(validateBirthDate('1999-02-31', '2026-11-25')).toBe('Data inválida.');
  });
});
