import { formatNumber } from '@/lib/numbers';

export function formatRest(sec: number): string {
  if (sec <= 0) return 'sem descanso';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}min${String(s).padStart(2, '0')}` : `${m}min`;
}

export function formatRepRange(repMin: number, repMax: number): string {
  return repMin === repMax ? `${repMin}` : `${repMin}–${repMax}`;
}

/** "3 × 8–12 · 1min30" (cardio: "1 × 20–30 min") */
export function formatPrescription(p: { sets: number; repMin: number; repMax: number; restSec: number; cardio?: boolean }): string {
  const reps = formatRepRange(p.repMin, p.repMax) + (p.cardio ? ' min' : '');
  return `${p.sets} × ${reps}${p.restSec > 0 ? ` · ${formatRest(p.restSec)}` : ''}`;
}

export function formatKg(kg: number): string {
  return `${formatNumber(kg, 2)} kg`;
}

/** Compact list of sets: "80 kg × 10, 10, 9 · 85 kg × 8" (groups consecutive equal loads). */
export function formatSetsLine(sets: ReadonlyArray<{ weightKg: number; reps: number }>, cardio = false): string {
  if (cardio) return sets.map((s) => `${formatNumber(s.reps)} min`).join(', ');
  const groups: { w: number; reps: number[] }[] = [];
  for (const s of sets) {
    const g = groups[groups.length - 1];
    if (g && g.w === s.weightKg) g.reps.push(s.reps);
    else groups.push({ w: s.weightKg, reps: [s.reps] });
  }
  return groups.map((g) => `${g.w > 0 ? `${formatNumber(g.w, 2)} kg` : 'Peso corporal'} × ${g.reps.join(', ')}`).join(' · ');
}

/** "1 h 05 min", "42 min", "0:42" style for live clocks via formatElapsed. */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
