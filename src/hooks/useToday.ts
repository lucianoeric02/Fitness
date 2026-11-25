import { useEffect, useState } from 'react';
import { toDayKey, type DayKey } from '@/lib/dates';
import { useSettings } from './data';

/**
 * Current local DayKey, honoring the configured day-start hour. Re-evaluates
 * every minute and when the app returns to the foreground, so the app rolls
 * over to the new day without a restart.
 */
export function useToday(): DayKey {
  const settings = useSettings();
  const dayStartHour = settings?.dayStartHour ?? 0;
  const [today, setToday] = useState(() => toDayKey(new Date(), dayStartHour));

  useEffect(() => {
    const update = () => setToday(toDayKey(new Date(), dayStartHour));
    update();
    const timer = window.setInterval(update, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') update();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [dayStartHour]);

  return today;
}
