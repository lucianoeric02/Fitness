import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { addWater, deleteWater, restoreWater } from '@/data/repos/water';
import type { DayKey } from '@/lib/dates';
import type { WaterEntry } from '@/domain/models';
import { useToday } from '@/hooks/useToday';
import { formatVolumeMl } from '@/lib/numbers';

export const QUICK_WATER_ML = [200, 300, 500] as const;

/** Add water for today with an undo action in the confirmation toast. */
export function useWaterActions(day?: DayKey) {
  const today = useToday();
  const target = day ?? today;
  const toast = useToast();

  const undo = useCallback(
    async (entry: Pick<WaterEntry, 'id' | 'amountMl'>) => {
      try {
        const removed = await deleteWater(entry.id);
        toast.info(`${formatVolumeMl(entry.amountMl)} removidos.`, removed ? { label: 'Refazer', onClick: () => void restoreWater(removed) } : undefined);
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível desfazer.');
      }
    },
    [toast],
  );

  const add = useCallback(
    async (ml: number, note?: string) => {
      try {
        const entry = await addWater(target, ml, note);
        toast.success(`+${formatVolumeMl(ml)} de água.`, { label: 'Desfazer', onClick: () => void undo(entry) });
        return entry;
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível registrar a água.');
        return null;
      }
    },
    [target, toast, undo],
  );

  return { add, undo };
}
