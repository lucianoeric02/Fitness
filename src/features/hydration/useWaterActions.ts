import { useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import { addWater, deleteWater } from '@/data/repos/water';
import type { WaterEntry } from '@/domain/models';
import { useToday } from '@/hooks/useToday';
import { formatVolumeMl } from '@/lib/numbers';

export const QUICK_WATER_ML = [200, 300, 500] as const;

/** Add water for today with an undo action in the confirmation toast. */
export function useWaterActions() {
  const today = useToday();
  const toast = useToast();

  const undo = useCallback(
    async (entry: Pick<WaterEntry, 'id' | 'amountMl'>) => {
      try {
        await deleteWater(entry.id);
        toast.info(`${formatVolumeMl(entry.amountMl)} removidos.`);
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível desfazer.');
      }
    },
    [toast],
  );

  const add = useCallback(
    async (ml: number) => {
      try {
        const entry = await addWater(today, ml);
        toast.success(`+${formatVolumeMl(ml)} de água.`, { label: 'Desfazer', onClick: () => void undo(entry) });
        return entry;
      } catch (e) {
        console.error(e);
        toast.error('Não foi possível registrar a água.');
        return null;
      }
    },
    [today, toast, undo],
  );

  return { add, undo };
}
