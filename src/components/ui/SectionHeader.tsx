import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Uppercase label for a card or a group of content, with optional icon and trailing action. */
export function SectionHeader({
  icon,
  title,
  action,
  className,
  as: Tag = 'h2',
}: {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}) {
  return (
    <div className={cn('mb-3 flex min-h-5 items-center justify-between gap-2', className)}>
      <Tag className="flex items-center gap-2 text-caption font-semibold uppercase tracking-label text-muted">
        {icon}
        {title}
      </Tag>
      {action}
    </div>
  );
}
