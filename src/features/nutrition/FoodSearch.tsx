import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';
import { Link } from 'react-router';
import { normalize, SearchField } from '@/features/workout/ExercisePicker';
import { FOOD_CATEGORY_LABELS } from '@/domain/foodCatalog';
import type { Food, FoodCategory } from '@/domain/models';
import { useFoods, useRecentFoodIds } from '@/hooks/nutrition';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/numbers';

type Tab = 'recent' | 'favorites' | 'custom' | 'all';

/** Local food search: name, category, favorites, recent and custom foods. Works offline. */
export function FoodSearch({ onPick, emptyActionTo = '/nutricao/alimentos/novo' }: { onPick: (food: Food) => void; emptyActionTo?: string }) {
  const foods = useFoods();
  const recent = useRecentFoodIds();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const effectiveTab: Tab = tab ?? ((recent?.length ?? 0) > 0 ? 'recent' : 'all');

  const results = useMemo(() => {
    const active = (foods ?? []).filter((f) => !f.archivedAt);
    const q = normalize(query.trim());
    if (q || category) {
      return active.filter((f) => (!category || f.category === category) && (!q || normalize(`${f.name} ${f.brand ?? ''}`).includes(q)));
    }
    if (effectiveTab === 'recent') return (recent ?? []).map((id) => active.find((f) => f.id === id)).filter((f): f is Food => Boolean(f));
    if (effectiveTab === 'favorites') return active.filter((f) => f.favorite);
    if (effectiveTab === 'custom') return active.filter((f) => !f.isSeed);
    return active;
  }, [foods, recent, query, category, effectiveTab]);

  const chip = (active: boolean, label: string, onClick: () => void) => (
    <button
      key={label}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('pressable min-h-10 shrink-0 rounded-full border px-4 text-sm font-medium', active ? 'border-accent/60 bg-accent/15 text-ink' : 'border-line bg-elevated text-muted')}
    >
      {label}
    </button>
  );

  const searching = Boolean(query.trim() || category);
  const emptyText = searching
    ? 'Nenhum alimento encontrado.'
    : effectiveTab === 'recent'
      ? 'Nenhum alimento registrado ainda.'
      : effectiveTab === 'favorites'
        ? 'Nenhum favorito. Toque na estrela de um alimento para favoritar.'
        : effectiveTab === 'custom'
          ? 'Você ainda não criou alimentos.'
          : 'Nenhum alimento cadastrado.';

  return (
    <div className="flex flex-col gap-3">
      <SearchField value={query} onChange={setQuery} placeholder="Buscar alimento" />
      {!searching && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Listas">
          {chip(effectiveTab === 'recent', 'Recentes', () => setTab('recent'))}
          {chip(effectiveTab === 'favorites', 'Favoritos', () => setTab('favorites'))}
          {chip(effectiveTab === 'custom', 'Meus alimentos', () => setTab('custom'))}
          {chip(effectiveTab === 'all', 'Todos', () => setTab('all'))}
        </div>
      )}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Categorias">
        {chip(category === null, 'Todas categorias', () => setCategory(null))}
        {(Object.keys(FOOD_CATEGORY_LABELS) as FoodCategory[]).map((c) => chip(category === c, FOOD_CATEGORY_LABELS[c], () => setCategory(category === c ? null : c)))}
      </div>
      {foods === undefined ? (
        <p className="py-6 text-center text-caption text-muted">Carregando…</p>
      ) : results.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-body text-muted">{emptyText}</p>
          <Link to={emptyActionTo} className="mt-2 inline-flex min-h-touch items-center text-caption font-medium text-accent">
            Cadastrar alimento
          </Link>
        </div>
      ) : (
        <ul className="-mx-2">
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => onPick(f)} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left active:bg-elevated">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-body font-medium">
                    {f.favorite && <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-label="Favorito" />}
                    <span className="truncate">{f.name}</span>
                  </span>
                  <span className="block truncate text-caption text-muted">
                    {[f.brand, f.preparation, f.isSeed ? null : 'personalizado'].filter(Boolean).join(' · ') || FOOD_CATEGORY_LABELS[f.category]}
                  </span>
                </span>
                <span className="tabular shrink-0 text-right text-caption text-muted">
                  <span className="block text-sm font-semibold text-ink">{formatNumber(f.per100g.kcal)} kcal</span>
                  por 100 {f.unit}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
