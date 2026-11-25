import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle } from '@/components/ui/Card';
import { DateField, NumberField, Segmented, TextField } from '@/components/ui/Field';
import { PageBody, PageHeader } from '@/components/ui/Page';
import { LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { savePrimaryWeightGoal } from '@/data/repos/body';
import { saveProfile } from '@/data/repos/profile';
import { RULES, validateBirthDate, validateName, validateNumber } from '@/domain/validation';
import type { Goal, Profile, Sex } from '@/domain/models';
import { usePrimaryGoal, useProfile, useWeightSummary } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { ageOn } from '@/lib/dates';
import { formatNumber, parseDecimal, toInputValue } from '@/lib/numbers';

export function ProfilePage() {
  const profile = useProfile();
  const goal = usePrimaryGoal();
  const weight = useWeightSummary();
  if (profile === undefined || goal === undefined || weight === undefined) return <LoadingScreen />;
  return <ProfileForm profile={profile} goal={goal} currentWeight={weight.latest?.weightKg ?? null} />;
}

function ProfileForm({ profile, goal, currentWeight }: { profile: Profile | null; goal: Goal | null; currentWeight: number | null }) {
  const today = useToday();
  const toast = useToast();
  const [name, setName] = useState(profile?.name ?? '');
  const [sex, setSex] = useState<Sex | undefined>(profile?.sex);
  const [height, setHeight] = useState(toInputValue(profile?.heightCm, 0));
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [targetWeight, setTargetWeight] = useState(toInputValue(goal?.targetValue));
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const snapshot = JSON.stringify([name.trim(), sex, height, birthDate, targetWeight, targetDate]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  const heightN = parseDecimal(height);
  const targetN = parseDecimal(targetWeight);
  const errors = {
    name: validateName(name),
    height: validateNumber(heightN, RULES.heightCm),
    birthDate: validateBirthDate(birthDate || undefined, today),
    targetWeight: validateNumber(targetN, { ...RULES.weightKg, label: 'Peso-meta' }),
    targetDate: targetDate && targetDate <= today ? 'A data-alvo deve estar no futuro.' : null,
  };
  const valid = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = async () => {
    if (!valid || targetN === null) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await saveProfile({ name, sex, heightCm: heightN ?? undefined, birthDate: birthDate || undefined });
      // Changing the target keeps the original starting point.
      await savePrimaryWeightGoal({
        startValue: goal?.startValue ?? currentWeight ?? targetN,
        startDate: goal?.startDate ?? today,
        targetValue: targetN,
        targetDate: targetDate || undefined,
      });
      setSavedSnapshot(snapshot);
      toast.success('Perfil atualizado.');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const age = birthDate && !errors.birthDate ? ageOn(birthDate, today) : null;

  return (
    <>
      <PageHeader title="Perfil" back="/mais" />
      <PageBody className="gap-4">
        <Card className="flex flex-col gap-4">
          <TextField label="Nome" value={name} onChange={setName} maxLength={40} error={err('name')} />
          <Segmented
            label="Sexo"
            value={sex}
            onChange={setSex}
            options={[
              { value: 'male', label: 'Masculino' },
              { value: 'female', label: 'Feminino' },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Altura" suffix="cm" decimal={false} value={height} onChange={setHeight} error={err('height')} />
            <DateField
              label="Nascimento"
              value={birthDate}
              onChange={setBirthDate}
              max={today}
              error={err('birthDate')}
              hint={age !== null ? `${age} anos` : undefined}
            />
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <CardTitle>Meta de peso</CardTitle>
          {goal && (
            <p className="-mt-2 text-[13px] text-muted">
              Ponto de partida: <b className="tabular text-ink">{formatNumber(goal.startValue, 1)} kg</b>
              {currentWeight !== null && (
                <>
                  {' '}· atual <b className="tabular text-ink">{formatNumber(currentWeight, 1)} kg</b>
                </>
              )}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Peso-meta" suffix="kg" value={targetWeight} onChange={setTargetWeight} error={err('targetWeight')} />
            <DateField label="Data-alvo" value={targetDate} onChange={setTargetDate} min={today} error={err('targetDate')} />
          </div>
        </Card>

        <Button size="lg" block loading={saving} disabled={!dirty} onClick={save}>
          {dirty ? 'Salvar alterações' : 'Tudo salvo'}
        </Button>
      </PageBody>
    </>
  );
}
