import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button, IconButton } from '@/components/ui/Button';
import { DateInput, NumberInput, Segmented, Input } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import { completeOnboarding } from '@/data/repos/onboarding';
import { DEFAULT_TARGETS } from '@/data/repos/targets';
import { RULES, validateBirthDate, validateName, validateNumber } from '@/domain/validation';
import type { Sex } from '@/domain/models';
import { useToday } from '@/hooks/useToday';
import { cn } from '@/lib/cn';
import { formatSigned, parseDecimal } from '@/lib/numbers';
import { parseTargetsDraft, TargetsForm, targetsToDraft, type TargetsDraft } from '@/features/more/TargetsForm';

const STEPS = ['Perfil', 'Peso', 'Metas'] as const;

export function OnboardingPage() {
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | undefined>();
  const [height, setHeight] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [weight, setWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targets, setTargets] = useState<TargetsDraft>(() => targetsToDraft(DEFAULT_TARGETS));

  const heightN = parseDecimal(height);
  const weightN = parseDecimal(weight);
  const targetWeightN = parseDecimal(targetWeight);

  const stepErrors = [
    {
      name: validateName(name),
      height: validateNumber(heightN, RULES.heightCm),
      birthDate: validateBirthDate(birthDate || undefined, today),
    },
    {
      weight: validateNumber(weightN, RULES.weightKg),
      targetWeight: validateNumber(targetWeightN, { ...RULES.weightKg, label: 'Peso-meta' }),
      targetDate: targetDate && targetDate <= today ? 'A data-alvo deve estar no futuro.' : null,
    },
    parseTargetsDraft(targets).errors,
  ];
  const currentErrors = stepErrors[step]!;
  const stepValid = Object.values(currentErrors).every((e) => !e);
  const err = (k: string) => (showErrors ? ((currentErrors as Record<string, string | null>)[k] ?? null) : null);

  const next = async () => {
    if (!stepValid) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    const parsed = parseTargetsDraft(targets).values;
    if (!parsed || weightN === null || targetWeightN === null) return;
    setSaving(true);
    try {
      await completeOnboarding({
        today,
        profile: { name, sex, heightCm: heightN ?? undefined, birthDate: birthDate || undefined },
        currentWeightKg: weightN,
        targetWeightKg: targetWeightN,
        targetDate: targetDate || undefined,
        targets: parsed,
      });
      toast.success(`Tudo pronto, ${name.trim().split(' ')[0]}. Bora treinar.`);
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const delta = weightN !== null && targetWeightN !== null ? targetWeightN - weightN : null;

  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col px-5 pb-safe-5 pt-safe-4">
      <div className="flex h-11 items-center justify-between">
        {step > 0 ? (
          <IconButton label="Voltar" className="-ml-3 text-ink" onClick={() => setStep(step - 1)}>
            <ArrowLeft className="size-5" />
          </IconButton>
        ) : (
          <span className="font-display text-lg font-bold uppercase tracking-brand text-accent">Iron Track</span>
        )}
        <span className="text-caption font-medium text-muted">
          {step + 1} de {STEPS.length}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <div key={s} className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-accent' : 'bg-elevated')} />
        ))}
      </div>

      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          void next();
        }}
        noValidate
      >
        {step === 0 && (
          <section className="mt-8 flex flex-col gap-5">
            <div>
              <h1 className="text-title font-semibold leading-tight tracking-tight">Vamos montar seu painel</h1>
              <p className="mt-2 text-body text-muted">Seus dados ficam só neste aparelho. Nada é enviado para a internet.</p>
            </div>
            <Input label="Como quer ser chamado?" value={name} onChange={setName} autoComplete="given-name" maxLength={40} error={err('name')} />
            <Segmented
              label="Sexo (opcional)"
              value={sex}
              onChange={setSex}
              options={[
                { value: 'male', label: 'Masculino' },
                { value: 'female', label: 'Feminino' },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Altura (opcional)" suffix="cm" decimal={false} value={height} onChange={setHeight} error={err('height')} />
              <DateInput label="Nascimento (opcional)" value={birthDate} onChange={setBirthDate} max={today} error={err('birthDate')} />
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="mt-8 flex flex-col gap-5">
            <div>
              <h1 className="text-title font-semibold leading-tight tracking-tight">Peso corporal</h1>
              <p className="mt-2 text-body text-muted">É a sua métrica principal de progresso. O peso de hoje vira o ponto de partida.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Peso atual" suffix="kg" value={weight} onChange={setWeight} error={err('weight')} autoFocus />
              <NumberInput label="Peso-meta" suffix="kg" value={targetWeight} onChange={setTargetWeight} error={err('targetWeight')} />
            </div>
            {delta !== null && Math.abs(delta) > 0 && (
              <p className="rounded-control border border-accent/20 bg-accent/8 px-4 py-3 text-body">
                Objetivo: <b className="tabular text-accent">{formatSigned(delta)} kg</b>{' '}
                <span className="text-muted">{delta > 0 ? 'de ganho' : 'de redução'}</span>
              </p>
            )}
            <DateInput
              label="Data-alvo (opcional)"
              value={targetDate}
              onChange={setTargetDate}
              min={today}
              error={err('targetDate')}
              hint="Usada para calcular o ritmo semanal necessário."
            />
          </section>
        )}

        {step === 2 && (
          <section className="mt-8 flex flex-col gap-5">
            <div>
              <h1 className="text-title font-semibold leading-tight tracking-tight">Metas diárias</h1>
              <p className="mt-2 text-body text-muted">Você define os números. Dá para ajustar a qualquer momento em Mais → Metas diárias.</p>
            </div>
            <TargetsForm draft={targets} onChange={setTargets} showErrors={showErrors} bodyWeightKg={weightN} />
          </section>
        )}

        <div className="mt-auto pt-8">
          <Button
            type="submit"
            size="lg"
            block
            loading={saving}
            icon={step === STEPS.length - 1 ? <Check className="size-5" /> : undefined}
          >
            {step === STEPS.length - 1 ? 'Começar' : 'Continuar'}
            {step < STEPS.length - 1 && <ArrowRight className="size-5" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
