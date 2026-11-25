import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Vertical stack for a screen's content with standard gutters and spacing. */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-3 px-4 pb-6', className)}>{children}</div>;
}

/** Responsive grid for metric tiles: one column on very narrow screens, two from 360px. */
export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">{children}</div>;
}
