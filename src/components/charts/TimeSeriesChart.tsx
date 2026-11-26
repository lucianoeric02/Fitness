import { daysBetween, formatShortDay, type DayKey } from '@/lib/dates';
import { formatNumber } from '@/lib/numbers';

export interface ChartPoint {
  day: DayKey;
  value: number;
}

const W = 320;
const H = 160;
const PAD = { l: 34, r: 8, t: 10, b: 20 };

/**
 * Time-proportional chart. Recorded values are drawn as dots only (never
 * joined, so gaps stay visible and nothing is interpolated). An optional
 * trend series is drawn as a line and labelled as a calculated average.
 */
export function TimeSeriesChart({
  points,
  trend,
  target,
  from,
  to,
  decimals = 1,
  label,
  color = 'var(--color-accent)',
}: {
  points: ChartPoint[];
  trend?: ChartPoint[];
  target?: number | null;
  /** X domain; defaults to first/last point. */
  from?: DayKey;
  to?: DayKey;
  decimals?: number;
  label: string;
  color?: string;
}) {
  if (points.length === 0) return null;
  const x0 = from ?? points[0]!.day;
  const x1 = to ?? points[points.length - 1]!.day;
  const span = Math.max(1, daysBetween(x0, x1));
  const values = [...points.map((p) => p.value), ...(trend ?? []).map((p) => p.value), ...(target ? [target] : [])];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 1) {
    min -= 0.5;
    max += 0.5;
  }
  const pad = (max - min) * 0.1;
  min -= pad;
  max += pad;
  const x = (d: DayKey) => PAD.l + (daysBetween(x0, d) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const ticks = [max - pad, (max + min) / 2, min + pad];

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end" fontSize="9" fill="var(--color-faint)">
              {formatNumber(t, decimals)}
            </text>
          </g>
        ))}
        {target != null && (
          <g>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(target)} y2={y(target)} stroke="var(--color-accent)" strokeOpacity="0.6" strokeDasharray="4 4" />
          </g>
        )}
        {trend && trend.length > 1 && (
          <polyline fill="none" stroke="var(--color-ink)" strokeOpacity="0.75" strokeWidth="1.5" points={trend.map((p) => `${x(p.day)},${y(p.value)}`).join(' ')} />
        )}
        {points.map((p) => (
          <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r="3.2" fill={color}>
            <title>{`${formatShortDay(p.day)}: ${formatNumber(p.value, decimals)}`}</title>
          </circle>
        ))}
        <text x={PAD.l} y={H - 4} fontSize="9" fill="var(--color-faint)">
          {formatShortDay(x0)}
        </text>
        <text x={W - PAD.r} y={H - 4} fontSize="9" textAnchor="end" fill="var(--color-faint)">
          {formatShortDay(x1)}
        </text>
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: color }} /> Registros
        </span>
        {trend && trend.length > 1 && (
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-ink/75" /> Média móvel 7 dias (calculada)
          </span>
        )}
        {target != null && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed border-accent" /> Meta
          </span>
        )}
      </figcaption>
    </figure>
  );
}
