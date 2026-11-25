import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Link } from 'react-router';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { EQUIPMENT_LABELS, LIBRARY_SECTIONS, MUSCLE_LABELS } from '@/domain/exerciseCatalog';
import type { Exercise } from '@/domain/models';
import { useExerciseLibrary } from '@/hooks/workout';
import { cn } from '@/lib/cn';

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function filterExercises(list: ReadonlyArray<Exercise>, query: string, section: string | null): Exercise[] {
  const q = normalize(query.trim());
  const muscles = section ? LIBRARY_SECTIONS.find((s) => s.key === section)?.muscles : null;
  return list.filter((e) => !e.archivedAt && (!muscles || muscles.includes(e.primaryMuscle)) && (!q || normalize(e.name).includes(q)));
}

export function SectionChips({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const chip = (key: string | null, label: string) => (
    <button
      key={key ?? 'all'}
      type="button"
      aria-pressed={value === key}
      onClick={() => onChange(key)}
      className={cn('pressable min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium', value === key ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line bg-elevated text-muted')}
    >
      {label}
    </button>
  );
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Grupo muscular">
      {chip(null, 'Todos')}
      {LIBRARY_SECTIONS.map((s) => chip(s.key, s.label))}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative block">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-control border border-line bg-elevated pl-12 pr-4 text-base text-ink placeholder:text-faint focus:border-accent/70 focus:outline-none"
      />
    </label>
  );
}

/** Pick an exercise from the library. `suggestedIds` are shown first (e.g. alternatives). */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Escolher exercício',
  suggestedIds = [],
  excludeIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  title?: string;
  suggestedIds?: string[];
  excludeIds?: string[];
}) {
  const library = useExerciseLibrary();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState<string | null>(null);
  const results = useMemo(() => filterExercises(library ?? [], query, section).filter((e) => !excludeIds.includes(e.id)), [library, query, section, excludeIds]);
  const suggested = !query && !section ? (library ?? []).filter((e) => suggestedIds.includes(e.id) && !e.archivedAt && !excludeIds.includes(e.id)) : [];

  const row = (e: Exercise) => (
    <li key={e.id}>
      <button
        type="button"
        onClick={() => onPick(e)}
        className="flex min-h-14 w-full flex-col justify-center rounded-xl px-3 py-2 text-left transition-colors duration-fast active:bg-elevated"
      >
        <span className="text-body font-medium">{e.name}</span>
        <span className="text-caption text-muted">
          {MUSCLE_LABELS[e.primaryMuscle]} · {EQUIPMENT_LABELS[e.equipment]}
        </span>
      </button>
    </li>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3 pt-1">
        <SearchField value={query} onChange={setQuery} placeholder="Buscar exercício" />
        <SectionChips value={section} onChange={setSection} />
        {suggested.length > 0 && (
          <>
            <p className="px-1 text-caption font-semibold uppercase tracking-label text-muted">Alternativas sugeridas</p>
            <ul>{suggested.map(row)}</ul>
            <p className="px-1 text-caption font-semibold uppercase tracking-label text-muted">Todos</p>
          </>
        )}
        {library === undefined ? (
          <p className="py-6 text-center text-caption text-muted">Carregando…</p>
        ) : results.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-body text-muted">Nenhum exercício encontrado.</p>
            <Link to="/treino/exercicios/novo" className="mt-2 inline-flex min-h-touch items-center text-caption font-medium text-accent">
              Criar exercício personalizado
            </Link>
          </div>
        ) : (
          <ul className="-mx-2">{results.map(row)}</ul>
        )}
      </div>
    </BottomSheet>
  );
}
