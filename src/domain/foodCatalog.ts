import type { FoodCategory, FoodUnit, Nutrients } from './models';

/**
 * Starter food catalog (seed data, removable). Values per 100 g (or 100 ml),
 * rounded to one decimal at most. Reference: TACO – Tabela Brasileira de
 * Composição de Alimentos (NEPA/Unicamp, 4ª ed.) and, where TACO has no
 * entry, USDA FoodData Central. Real values vary by brand, cut and
 * preparation: every item can be edited, and custom foods can be created.
 */
export interface CatalogFood {
  key: string;
  name: string;
  category: FoodCategory;
  unit: FoodUnit;
  preparation?: string;
  per100: Nutrients;
  servings: Array<[label: string, amount: number]>;
  source: 'TACO' | 'USDA' | 'Rótulo médio';
}

type Row = [key: string, name: string, category: FoodCategory, prep: string | undefined, kcal: number, p: number, c: number, f: number, fiber: number | undefined, servings: Array<[string, number]>, source: CatalogFood['source'], unit?: FoodUnit];

const ROWS: Row[] = [
  // Grãos e cereais
  ['arroz_branco', 'Arroz branco cozido', 'grains', 'Cozido', 128, 2.5, 28.1, 0.2, 1.6, [['1 colher de servir', 45], ['1 escumadeira', 90]], 'TACO'],
  ['arroz_integral', 'Arroz integral cozido', 'grains', 'Cozido', 124, 2.6, 25.8, 1.0, 2.7, [['1 colher de servir', 45], ['1 escumadeira', 90]], 'TACO'],
  ['aveia', 'Aveia em flocos', 'grains', undefined, 394, 13.9, 66.6, 8.5, 9.1, [['1 colher de sopa', 15], ['1/2 xícara', 40]], 'TACO'],
  ['cuscuz', 'Cuscuz de milho cozido', 'grains', 'Cozido', 113, 2.2, 25.3, 0.7, 2.1, [['1 fatia média', 100]], 'TACO'],
  ['tapioca', 'Tapioca (goma hidratada)', 'grains', undefined, 240, 0, 60, 0, 0, [['1 tapioca média', 70]], 'Rótulo médio'],
  ['granola', 'Granola tradicional', 'grains', undefined, 421, 9.0, 66.0, 13.0, 7.0, [['2 colheres de sopa', 25]], 'Rótulo médio'],
  // Leguminosas
  ['feijao_carioca', 'Feijão carioca cozido', 'legumes', 'Cozido', 76, 4.8, 13.6, 0.5, 8.5, [['1 concha média', 140]], 'TACO'],
  ['feijao_preto', 'Feijão preto cozido', 'legumes', 'Cozido', 77, 4.5, 14.0, 0.5, 8.4, [['1 concha média', 140]], 'TACO'],
  ['lentilha', 'Lentilha cozida', 'legumes', 'Cozida', 93, 6.3, 16.3, 0.5, 7.9, [['1 concha média', 140]], 'TACO'],
  // Carnes
  ['frango_grelhado', 'Peito de frango grelhado', 'meat', 'Grelhado, sem pele', 159, 32.0, 0, 2.5, undefined, [['1 filé médio', 120]], 'TACO'],
  ['frango_cru', 'Peito de frango cru', 'meat', 'Cru, sem pele', 119, 21.5, 0, 3.0, undefined, [['1 filé médio cru', 150]], 'TACO'],
  ['patinho_grelhado', 'Patinho grelhado', 'meat', 'Grelhado', 219, 35.9, 0, 7.3, undefined, [['1 bife médio', 100]], 'TACO'],
  ['patinho_cru', 'Patinho cru', 'meat', 'Cru', 133, 21.7, 0, 4.5, undefined, [['1 bife médio cru', 130]], 'TACO'],
  ['contrafile', 'Contrafilé grelhado (sem gordura)', 'meat', 'Grelhado', 194, 35.9, 0, 4.5, undefined, [['1 bife médio', 100]], 'TACO'],
  ['carne_moida', 'Carne moída (acém) cozida', 'meat', 'Cozida', 212, 26.7, 0, 10.9, undefined, [['1 colher de servir', 60]], 'TACO'],
  // Peixes
  ['tilapia', 'Tilápia (filé) grelhada', 'fish', 'Grelhada', 128, 26.2, 0, 2.7, undefined, [['1 filé médio', 120]], 'USDA'],
  ['atum_agua', 'Atum em conserva em água', 'fish', 'Escorrido', 116, 25.5, 0, 0.8, undefined, [['1 lata escorrida', 120]], 'USDA'],
  ['sardinha', 'Sardinha em conserva em óleo', 'fish', 'Escorrida', 208, 24.6, 0, 11.5, undefined, [['1 lata escorrida', 84]], 'USDA'],
  // Ovos e laticínios
  ['ovo_cozido', 'Ovo inteiro cozido', 'eggs_dairy', 'Cozido', 146, 13.3, 0.6, 9.5, undefined, [['1 ovo (50 g)', 50]], 'TACO'],
  ['ovo_mexido', 'Ovo mexido', 'eggs_dairy', 'Mexido, com óleo', 240, 15.6, 0.6, 19.5, undefined, [['1 ovo (55 g)', 55]], 'TACO'],
  ['clara', 'Clara de ovo', 'eggs_dairy', 'Cozida', 52, 10.9, 0.7, 0.2, undefined, [['1 clara', 33]], 'USDA'],
  ['leite_integral', 'Leite integral', 'eggs_dairy', undefined, 61, 3.2, 4.6, 3.3, undefined, [['1 copo (200 ml)', 200]], 'TACO', 'ml'],
  ['leite_desnatado', 'Leite desnatado', 'eggs_dairy', undefined, 35, 3.4, 5.0, 0.1, undefined, [['1 copo (200 ml)', 200]], 'TACO', 'ml'],
  ['iogurte_natural', 'Iogurte natural integral', 'eggs_dairy', undefined, 51, 4.1, 1.9, 3.0, undefined, [['1 pote (170 g)', 170]], 'TACO'],
  ['iogurte_grego', 'Iogurte grego tradicional', 'eggs_dairy', undefined, 120, 4.5, 14.0, 5.0, undefined, [['1 pote (100 g)', 100]], 'Rótulo médio'],
  ['mucarela', 'Queijo muçarela', 'eggs_dairy', undefined, 330, 22.6, 3.0, 25.2, undefined, [['1 fatia (15 g)', 15]], 'TACO'],
  ['minas_frescal', 'Queijo minas frescal', 'eggs_dairy', undefined, 264, 17.4, 3.2, 20.2, undefined, [['1 fatia (30 g)', 30]], 'TACO'],
  ['requeijao', 'Requeijão cremoso', 'eggs_dairy', undefined, 257, 9.6, 2.4, 23.4, undefined, [['1 colher de sopa', 30]], 'TACO'],
  // Frutas
  ['banana', 'Banana prata', 'fruits', undefined, 98, 1.3, 26.0, 0.1, 2.0, [['1 unidade média', 70]], 'TACO'],
  ['maca', 'Maçã fuji', 'fruits', undefined, 56, 0.3, 15.2, 0, 1.3, [['1 unidade média', 130]], 'TACO'],
  ['laranja', 'Laranja pera', 'fruits', undefined, 37, 1.0, 8.9, 0.1, 0.8, [['1 unidade média', 140]], 'TACO'],
  ['mamao', 'Mamão papaia', 'fruits', undefined, 40, 0.5, 10.4, 0.1, 1.0, [['1/2 unidade', 150]], 'TACO'],
  ['abacate', 'Abacate', 'fruits', undefined, 96, 1.2, 6.0, 8.4, 6.3, [['1 colher de sopa', 45]], 'TACO'],
  ['morango', 'Morango', 'fruits', undefined, 30, 0.9, 6.8, 0.3, 1.7, [['10 unidades', 120]], 'TACO'],
  ['uva', 'Uva', 'fruits', undefined, 53, 0.7, 13.6, 0.2, 0.9, [['1 cacho pequeno', 100]], 'TACO'],
  // Pães e massas
  ['pao_frances', 'Pão francês', 'breads_pasta', undefined, 300, 8.0, 58.6, 3.1, 2.3, [['1 unidade (50 g)', 50]], 'TACO'],
  ['pao_forma', 'Pão de forma tradicional', 'breads_pasta', undefined, 265, 8.0, 49.0, 3.5, 2.5, [['1 fatia (25 g)', 25]], 'Rótulo médio'],
  ['pao_integral', 'Pão de forma integral', 'breads_pasta', undefined, 253, 9.4, 49.9, 3.7, 6.9, [['1 fatia (25 g)', 25]], 'TACO'],
  ['macarrao', 'Macarrão cozido', 'breads_pasta', 'Cozido', 158, 5.8, 30.9, 0.9, 1.8, [['1 pegador', 110]], 'USDA'],
  ['wrap', 'Wrap / pão folha tradicional', 'breads_pasta', undefined, 300, 8.0, 52.0, 6.5, 2.0, [['1 unidade (40 g)', 40]], 'Rótulo médio'],
  // Tubérculos
  ['batata', 'Batata inglesa cozida', 'tubers', 'Cozida', 52, 1.2, 11.9, 0, 1.3, [['1 unidade média', 140]], 'TACO'],
  ['batata_doce', 'Batata-doce cozida', 'tubers', 'Cozida', 77, 0.6, 18.4, 0.1, 2.2, [['1 unidade média', 150]], 'TACO'],
  ['mandioca', 'Mandioca cozida', 'tubers', 'Cozida', 125, 0.6, 30.1, 0.3, 1.6, [['1 pedaço médio', 100]], 'TACO'],
  // Verduras e legumes
  ['brocolis', 'Brócolis cozido', 'vegetables', 'Cozido', 25, 2.1, 4.4, 0.5, 3.4, [['1 xícara', 90]], 'TACO'],
  ['tomate', 'Tomate', 'vegetables', undefined, 15, 1.1, 3.1, 0.2, 1.2, [['1 unidade média', 100]], 'TACO'],
  ['alface', 'Alface', 'vegetables', undefined, 11, 1.3, 1.7, 0.2, 1.8, [['1 prato raso', 40]], 'TACO'],
  ['cenoura', 'Cenoura crua', 'vegetables', undefined, 34, 1.3, 7.7, 0.2, 3.2, [['1 unidade média', 80]], 'TACO'],
  // Gorduras e oleaginosas
  ['azeite', 'Azeite de oliva', 'fats_nuts', undefined, 884, 0, 0, 100, undefined, [['1 colher de sopa', 13]], 'TACO'],
  ['manteiga', 'Manteiga com sal', 'fats_nuts', undefined, 726, 0.4, 0.1, 82.4, undefined, [['1 ponta de faca', 5]], 'TACO'],
  ['pasta_amendoim', 'Pasta de amendoim integral', 'fats_nuts', undefined, 597, 25.0, 20.0, 48.0, 7.0, [['1 colher de sopa', 15]], 'Rótulo médio'],
  ['castanha_para', 'Castanha-do-pará', 'fats_nuts', undefined, 643, 14.5, 15.1, 63.5, 7.9, [['1 unidade', 4]], 'TACO'],
  // Suplementos e outros
  ['whey', 'Whey protein concentrado', 'supplements', undefined, 400, 78.0, 8.0, 6.0, undefined, [['1 scoop (30 g)', 30]], 'Rótulo médio'],
  ['creatina', 'Creatina monohidratada', 'supplements', undefined, 0, 0, 0, 0, undefined, [['1 dose (5 g)', 5]], 'Rótulo médio'],
  ['mel', 'Mel', 'other', undefined, 309, 0, 84.0, 0, undefined, [['1 colher de sopa', 20]], 'TACO'],
  ['achocolatado', 'Achocolatado em pó', 'other', undefined, 401, 4.2, 91.2, 2.2, 3.9, [['1 colher de sopa', 15]], 'TACO'],
];

export const FOOD_CATALOG: CatalogFood[] = ROWS.map(([key, name, category, preparation, kcal, p, c, f, fiber, servings, source, unit]) => ({
  key,
  name,
  category,
  unit: unit ?? 'g',
  preparation,
  per100: { kcal, proteinG: p, carbsG: c, fatG: f, ...(fiber !== undefined ? { fiberG: fiber } : {}) },
  servings,
  source,
}));

export function foodCatalogId(key: string): string {
  return `seed-food-${key}`;
}

export const FOOD_CATEGORY_LABELS: Record<FoodCategory, string> = {
  grains: 'Grãos e cereais',
  legumes: 'Leguminosas',
  meat: 'Carnes',
  fish: 'Peixes',
  eggs_dairy: 'Ovos e laticínios',
  fruits: 'Frutas',
  breads_pasta: 'Pães e massas',
  tubers: 'Tubérculos',
  vegetables: 'Verduras e legumes',
  fats_nuts: 'Gorduras e oleaginosas',
  supplements: 'Suplementos',
  other: 'Outros',
};

/** Default meals; ids match the v1 slot values so existing entries keep working. */
export const DEFAULT_MEALS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'breakfast', name: 'Café da manhã' },
  { id: 'lunch', name: 'Almoço' },
  { id: 'afternoon', name: 'Lanche' },
  { id: 'pre_workout', name: 'Pré-treino' },
  { id: 'post_workout', name: 'Pós-treino' },
  { id: 'dinner', name: 'Jantar' },
  { id: 'supper', name: 'Ceia' },
];
