import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/Field';
import { RULES, validateNumber } from '@/domain/validation';
import { parseDecimal } from '@/lib/numbers';
import { QUICK_WATER_ML, useWaterActions } from './useWaterActions';

/** Quick amounts plus a custom amount. */
export function WaterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { add } = useWaterActions();
  const [custom, setCustom] = useState('');
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (open) {
      setCustom('');
      setShowError(false);
    }
  }, [open]);

  const customN = parseDecimal(custom);
  const error = validateNumber(customN, RULES.waterQuickMl);

  const addAndClose = async (ml: number) => {
    if (await add(ml)) onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Adicionar água">
      <div className="grid grid-cols-3 gap-2 pt-2">
        {QUICK_WATER_ML.map((ml) => (
          <Button key={ml} variant="secondary" size="lg" onClick={() => void addAndClose(ml)}>
            +{ml} ml
          </Button>
        ))}
      </div>
      <form
        className="mt-5 flex items-end gap-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (error || customN === null) setShowError(true);
          else void addAndClose(customN);
        }}
      >
        <div className="flex-1">
          <NumberInput label="Outra quantidade" suffix="ml" decimal={false} value={custom} onChange={setCustom} error={showError ? error : null} />
        </div>
        <Button type="submit" size="lg" className={showError && error ? 'mb-6' : undefined}>
          Adicionar
        </Button>
      </form>
    </BottomSheet>
  );
}
