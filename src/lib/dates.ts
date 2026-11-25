/**
 * Date utilities. A "DayKey" is a local calendar day in the form YYYY-MM-DD.
 * All day-scoped records (food, water, weight, sessions) are keyed by DayKey
 * computed in the device's local timezone, never by UTC date.
 */

export type DayKey = string;

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isDayKey(value: unknown): value is DayKey {
  if (typeof value !== 'string' || !DAY_KEY_RE.test(value)) return false;
  const d = parseDayKey(value);
  return formatDayKey(d) === value;
}

/** Formats a Date as a local DayKey (no day-boundary shift). */
export function formatDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Returns the DayKey a moment belongs to. `dayStartHour` lets late-night
 * entries (e.g. a meal at 01:30 with dayStartHour = 3) count toward the
 * previous day.
 */
export function toDayKey(date: Date = new Date(), dayStartHour = 0): DayKey {
  if (dayStartHour <= 0) return formatDayKey(date);
  const shifted = new Date(date.getTime());
  shifted.setHours(shifted.getHours() - dayStartHour);
  return formatDayKey(shifted);
}

/** Parses a DayKey into a Date at local midnight. */
export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(key: DayKey, days: number): DayKey {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return formatDayKey(d);
}

/** Whole calendar days from `a` to `b` (positive when b is later). DST-safe. */
export function daysBetween(a: DayKey, b: DayKey): number {
  const da = parseDayKey(a);
  const db = parseDayKey(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(key: DayKey): number {
  return parseDayKey(key).getDay();
}

/** First day of the week containing `key`. weekStartsOn: 0 = Sunday, 1 = Monday. */
export function startOfWeek(key: DayKey, weekStartsOn: 0 | 1 = 1): DayKey {
  const diff = (weekdayOf(key) - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
}

/** Inclusive list of DayKeys from `from` to `to`. */
export function dayRange(from: DayKey, to: DayKey): DayKey[] {
  const n = daysBetween(from, to);
  if (n < 0) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i));
}

export function compareDayKeys(a: DayKey, b: DayKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Age in full years on a given day. */
export function ageOn(birthDate: DayKey, on: DayKey): number {
  const b = parseDayKey(birthDate);
  const o = parseDayKey(on);
  let age = o.getFullYear() - b.getFullYear();
  if (o.getMonth() < b.getMonth() || (o.getMonth() === b.getMonth() && o.getDate() < b.getDate())) {
    age -= 1;
  }
  return age;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ---- pt-BR display formatting ---------------------------------------------

const longDayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
const shortDayFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Quarta-feira, 25 de novembro" */
export function formatLongDay(key: DayKey): string {
  return capitalize(longDayFmt.format(parseDayKey(key)));
}

/** "25 de nov." */
export function formatShortDay(key: DayKey): string {
  return shortDayFmt.format(parseDayKey(key));
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "Hoje", "Ontem", or short date. */
export function formatRelativeDay(key: DayKey, today: DayKey): string {
  const diff = daysBetween(key, today);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff === -1) return 'Amanhã';
  return formatShortDay(key);
}

/** Greeting by local hour. */
export function greetingFor(date: Date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}
