import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { PageBody, PageHeader } from '@/components/ui/Page';
import { EmptyState } from '@/components/ui/States';

/** Honest empty state for tabs whose module is scheduled for a later phase. */
export function ModuleComingSoon({
  title,
  icon,
  headline,
  description,
  features,
}: {
  title: string;
  icon: ReactNode;
  headline: string;
  description: string;
  features: string[];
}) {
  return (
    <>
      <PageHeader title={title} />
      <PageBody>
        <Card>
          <EmptyState icon={icon} title={headline} description={description} className="pb-4" />
          <ul className="mx-2 mb-2 flex flex-col gap-2 border-t border-line/60 pt-4">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-[15px] text-muted">
                <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>
        </Card>
      </PageBody>
    </>
  );
}
