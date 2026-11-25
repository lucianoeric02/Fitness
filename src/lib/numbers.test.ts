import { describe, expect, it } from 'vitest';
import { formatNumber, formatSigned, formatVolumeMl, parseDecimal, toInputValue } from './numbers';

describe('numbers', () => {
  it('parses pt-BR and dot decimals', () => {
    expect(parseDecimal('82,5')).toBe(82.5);
    expect(parseDecimal('82.5')).toBe(82.5);
    expect(parseDecimal(' 3400 ')).toBe(3400);
  });

  it('rejects invalid input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1.234,5')).toBeNull();
    expect(parseDecimal('82,')).toBeNull();
  });

  it('formats for display', () => {
    expect(formatNumber(3400)).toBe('3.400');
    expect(formatNumber(82.46, 1)).toBe('82,5');
    expect(formatVolumeMl(750)).toBe('750 ml');
    expect(formatVolumeMl(2500)).toBe('2,5 L');
    expect(formatSigned(0.4)).toBe('+0,4');
    expect(formatSigned(-1.25, 2)).toBe('−1,25');
    expect(formatSigned(0)).toBe('0');
  });

  it('round-trips input values', () => {
    expect(toInputValue(82.5)).toBe('82,5');
    expect(parseDecimal(toInputValue(82.5))).toBe(82.5);
    expect(toInputValue(null)).toBe('');
  });
});
