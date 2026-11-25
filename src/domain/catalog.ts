import type { ActivityLevel, GoalKind, MeasurementSite, TrainingExperience } from './models';

export const EXPERIENCE_LABELS: Record<TrainingExperience, string> = {
  beginner: 'Iniciante (< 1 ano)',
  intermediate: 'Intermediário (1–3 anos)',
  advanced: 'Avançado (3+ anos)',
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentário fora do treino',
  light: 'Levemente ativo',
  moderate: 'Moderadamente ativo',
  high: 'Muito ativo',
  very_high: 'Extremamente ativo',
};

/** Body regions in display order. Limbs are recorded on both sides. */
export const MEASUREMENT_REGIONS: ReadonlyArray<{ label: string; sites: ReadonlyArray<{ site: MeasurementSite; label: string }> }> = [
  { label: 'Pescoço', sites: [{ site: 'neck', label: 'Pescoço' }] },
  { label: 'Ombros', sites: [{ site: 'shoulders', label: 'Ombros' }] },
  { label: 'Peitoral', sites: [{ site: 'chest', label: 'Peitoral' }] },
  { label: 'Cintura', sites: [{ site: 'waist', label: 'Cintura' }] },
  { label: 'Abdômen', sites: [{ site: 'abdomen', label: 'Abdômen' }] },
  { label: 'Quadril', sites: [{ site: 'hips', label: 'Quadril' }] },
  { label: 'Braço', sites: [{ site: 'arm_left', label: 'Braço esq.' }, { site: 'arm_right', label: 'Braço dir.' }] },
  { label: 'Antebraço', sites: [{ site: 'forearm_left', label: 'Antebraço esq.' }, { site: 'forearm_right', label: 'Antebraço dir.' }] },
  { label: 'Coxa', sites: [{ site: 'thigh_left', label: 'Coxa esq.' }, { site: 'thigh_right', label: 'Coxa dir.' }] },
  { label: 'Panturrilha', sites: [{ site: 'calf_left', label: 'Panturrilha esq.' }, { site: 'calf_right', label: 'Panturrilha dir.' }] },
];

const SITE_LABELS = new Map<MeasurementSite, string>(MEASUREMENT_REGIONS.flatMap((r) => r.sites.map((s) => [s.site, s.label] as const)));

/** Stable key for a measurement series (custom sites are keyed by name). */
export function measurementKey(site: MeasurementSite, customName?: string): string {
  return site === 'custom' ? `custom:${(customName ?? '').trim().toLocaleLowerCase('pt-BR')}` : site;
}

export function parseMeasurementKey(key: string): { site: MeasurementSite; customName?: string } {
  return key.startsWith('custom:') ? { site: 'custom', customName: key.slice(7) } : { site: key as MeasurementSite };
}

export function measurementLabel(site: MeasurementSite, customName?: string): string {
  if (site === 'custom') return customName?.trim() || 'Medida personalizada';
  return SITE_LABELS.get(site) ?? site;
}

/**
 * Goal categories. `source` says where the current value comes from:
 * a record table (automatic) or the goal itself (manual).
 */
export const GOAL_KINDS: Record<
  GoalKind,
  { label: string; defaultUnit: string; source: 'weight' | 'body_fat' | 'muscle_mass' | 'measurement' | 'sessions' | 'manual'; unitEditable: boolean; example: string }
> = {
  body_weight: { label: 'Peso', defaultUnit: 'kg', source: 'weight', unitEditable: false, example: 'Chegar a 86 kg' },
  body_fat: { label: 'Gordura corporal', defaultUnit: '%', source: 'body_fat', unitEditable: false, example: 'Baixar para 12%' },
  muscle_mass: { label: 'Massa muscular', defaultUnit: 'kg', source: 'muscle_mass', unitEditable: false, example: 'Chegar a 40 kg de massa magra' },
  measurement: { label: 'Medida corporal', defaultUnit: 'cm', source: 'measurement', unitEditable: false, example: 'Braço com 42 cm' },
  performance: { label: 'Desempenho', defaultUnit: 'kg', source: 'manual', unitEditable: true, example: 'Supino 120 kg' },
  conditioning: { label: 'Condicionamento', defaultUnit: 'min', source: 'manual', unitEditable: true, example: '5 km em 25 min' },
  consistency: { label: 'Frequência de treino', defaultUnit: 'treinos/sem.', source: 'sessions', unitEditable: false, example: '4 treinos por semana' },
};

export const GOAL_KIND_ORDER: GoalKind[] = ['body_weight', 'body_fat', 'muscle_mass', 'measurement', 'performance', 'conditioning', 'consistency'];
