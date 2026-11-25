import { Star } from 'lucide-react';
import { Link } from 'react-router';
import { ProgressBar } from '@/components/ui/Progress';
import { GOAL_KINDS, measurementLabel } from '@/domain/catalog';
import { goalIssueMessage } from '@/domain/calc/goals';
import type { Goal } from '@/domain/models';
import type { GoalView } from '@/hooks/data';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/numbers';

export function formatGoalValue(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return '—';
  const decimals = unit === 'kg' || unit === 'cm' || unit === '%' ? 1 : 2;
  return unit === "%" ? `${formatNumber(value, decimals)}%` : `${formatNumber(value, decimals)} ${unit}`;
}

export function goalSubtitle(goal: Goal): string {
  const kind = GOAL_KINDS[goal.kind].label;
  if (goal.kind === 'measurement' && goal.ref) return `${kind} · ${measurementLabel(goal.ref, goal.refName)}`;
  return kind;
}

/** One goal with its progress. Never shows a percentage the data can't support. */
export function GoalRow({ view, to, prominent = false }: { view: GoalView; to?: string; prominent?: boolean }) {
  const { goal, current, evaluation } = view;
  const pct = evaluation.ok ? Math.round(evaluation.ratio * 100) : null;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('flex items-center gap-1.5 truncate font-semibold', prominent ? 'text-base' : 'text-body')}>
            {goal.isPrimary && <Star className="size-4 shrink-0 fill-accent text-accent" aria-label="Meta principal" />}
            {goal.title}
          </p>
          <p className="truncate text-caption text-muted">{goalSubtitle(goal)}</p>
        </div>
        {pct !== null && (
          <span className={cn('tabular shrink-0 font-semibold', evaluation.ok && evaluation.achieved ? 'text-accent' : 'text-ink', prominent ? 'text-base' : 'text-sm')}>
            {pct}%
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2 text-caption">
        <span className="tabular text-muted">
          Atual <b className="text-ink">{formatGoalValue(current.value, goal.unit)}</b>
        </span>
        <span className="tabular text-muted">
          Alvo <b className="text-ink">{formatGoalValue(goal.targetValue, goal.unit)}</b>
        </span>
      </div>
      {evaluation.ok ? (
        <>
          <ProgressBar ratio={evaluation.ratio} label={`Progresso: ${goal.title}`} className="mt-2" />
          {evaluation.achieved && <p className="mt-1.5 text-caption text-accent">Alvo alcançado</p>}
          {evaluation.regressing && <p className="mt-1.5 text-caption text-warning">Abaixo do ponto de partida</p>}
        </>
      ) : (
        <p className="mt-2 text-caption text-faint">{goalIssueMessage(evaluation.issue)}</p>
      )}
    </>
  );
  const cls = cn('block rounded-control', to && 'pressable -m-2 p-2 active:bg-elevated');
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
