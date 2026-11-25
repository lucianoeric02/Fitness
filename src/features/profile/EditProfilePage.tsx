import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ChipGroup, DateInput, Input, NumberInput, Segmented, TextArea } from '@/components/ui/Field';
import { LoadingScreen } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { saveProfile } from '@/data/repos/profile';
import { ACTIVITY_LABELS, EXPERIENCE_LABELS } from '@/domain/catalog';
import { RULES, validateBirthDate, validateName, validateNumber } from '@/domain/validation';
import type { ActivityLevel, Profile, Sex, TrainingExperience } from '@/domain/models';
import { useProfile } from '@/hooks/data';
import { useToday } from '@/hooks/useToday';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { ageOn } from '@/lib/dates';
import { parseDecimal, toInputValue } from '@/lib/numbers';

const options = <T extends string>(labels: Record<T, string>) => (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));

export function EditProfilePage() {
  const profile = useProfile();
  if (profile === undefined) return <LoadingScreen />;
  return <ProfileForm profile={profile} />;
}

function ProfileForm({ profile }: { profile: Profile | null }) {
  const today = useToday();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.name ?? '');
  const [sex, setSex] = useState<Sex | undefined>(profile?.sex);
  const [height, setHeight] = useState(toInputValue(profile?.heightCm, 0));
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? '');
  const [experience, setExperience] = useState<TrainingExperience | undefined>(profile?.trainingExperience);
  const [activity, setActivity] = useState<ActivityLevel | undefined>(profile?.activityLevel);
  const [notes, setNotes] = useState(profile?.notes ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const snapshot = JSON.stringify([name.trim(), sex, height, birthDate, experience, activity, notes.trim()]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  const unsavedGuard = useUnsavedChangesGuard(dirty && !saving);

  const heightN = parseDecimal(height);
  const errors = {
    name: validateName(name),
    height: validateNumber(heightN, RULES.heightCm),
    birthDate: validateBirthDate(birthDate || undefined, today),
  };
  const valid = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);
  const age = birthDate && !errors.birthDate ? ageOn(birthDate, today) : null;

  const save = async () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    try {
      await saveProfile({
        name,
        sex,
        heightCm: heightN ?? undefined,
        birthDate: birthDate || undefined,
        trainingExperience: experience,
        activityLevel: activity,
        notes,
      });
      setSavedSnapshot(snapshot);
      toast.success('Perfil atualizado.');
      navigate('/mais/perfil');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppHeader title="Editar perfil" back="/mais/perfil" />
      <PageContainer className="gap-4">
        <Card className="flex flex-col gap-4">
          <Input label="Nome" value={name} onChange={setName} maxLength={40} error={err('name')} />
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
            <NumberInput label="Altura" suffix="cm" decimal={false} value={height} onChange={setHeight} error={err('height')} />
            <DateInput label="Nascimento" value={birthDate} onChange={setBirthDate} max={today} error={err('birthDate')} hint={age !== null ? `${age} anos` : undefined} />
          </div>
        </Card>
        <Card className="flex flex-col gap-4">
          <ChipGroup label="Experiência de treino" value={experience} onChange={setExperience} options={options(EXPERIENCE_LABELS)} />
          <ChipGroup label="Nível de atividade (fora do treino)" value={activity} onChange={setActivity} options={options(ACTIVITY_LABELS)} />
          <TextArea label="Notas pessoais" value={notes} onChange={setNotes} maxLength={500} hint="Lesões, preferências, observações." />
        </Card>
        <Button size="lg" block loading={saving} disabled={!dirty} onClick={save}>
          {dirty ? 'Salvar alterações' : 'Tudo salvo'}
        </Button>
      </PageContainer>
      {unsavedGuard}
    </>
  );
}
