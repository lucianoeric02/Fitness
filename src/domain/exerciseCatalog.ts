import type { Equipment, MovementType, MuscleGroup } from './models';

/**
 * Initial exercise catalog (seed data, marked isSeed and removable).
 * Bundled locally: no external API. Alternatives reference other keys.
 * For cardio, "reps" are minutes.
 */
export interface CatalogExercise {
  key: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  equipment: Equipment;
  movement: MovementType;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  instructions: string;
  alternatives: string[];
}

type Row = [key: string, name: string, primary: MuscleGroup, secondary: MuscleGroup[], equipment: Equipment, movement: MovementType, sets: number, repMin: number, repMax: number, restSec: number, instructions: string, alternatives: string[]];

const ROWS: Row[] = [
  // ---- Peito
  ['bench_bb', 'Supino reto com barra', 'chest', ['triceps', 'shoulders'], 'barbell', 'compound', 4, 6, 10, 150, 'Escápulas retraídas, pés firmes no chão. Desça a barra até a linha do peito e empurre sem tirar o quadril do banco.', ['bench_db', 'bench_machine', 'pushup']],
  ['incline_bb', 'Supino inclinado com barra', 'chest', ['shoulders', 'triceps'], 'barbell', 'compound', 4, 6, 10, 150, 'Banco a 30–45°. Desça a barra na parte alta do peito, cotovelos levemente abaixo da linha dos ombros.', ['incline_db', 'incline_smith']],
  ['bench_db', 'Supino reto com halteres', 'chest', ['triceps', 'shoulders'], 'dumbbell', 'compound', 3, 8, 12, 120, 'Halteres alinhados ao peito, desça com controle até sentir alongamento e suba aproximando levemente os halteres.', ['bench_bb', 'bench_machine']],
  ['incline_db', 'Supino inclinado com halteres', 'chest', ['shoulders', 'triceps'], 'dumbbell', 'compound', 3, 8, 12, 120, 'Banco a 30–45°. Controle a descida e mantenha os punhos sobre os cotovelos.', ['incline_bb', 'incline_smith']],
  ['incline_smith', 'Supino inclinado no Smith', 'chest', ['shoulders', 'triceps'], 'smith', 'compound', 3, 8, 12, 120, 'Ajuste o banco para a barra descer na parte alta do peito. Movimento guiado, foque na contração.', ['incline_bb', 'incline_db']],
  ['decline_bb', 'Supino declinado com barra', 'chest', ['triceps'], 'barbell', 'compound', 3, 8, 12, 120, 'Pernas presas, desça a barra na parte baixa do peito com controle.', ['dips', 'bench_bb']],
  ['bench_machine', 'Supino máquina', 'chest', ['triceps', 'shoulders'], 'machine', 'compound', 3, 8, 12, 90, 'Ajuste o banco para as pegadas ficarem na linha do peito. Empurre sem travar os cotovelos.', ['bench_db', 'bench_bb']],
  ['fly_db', 'Crucifixo com halteres', 'chest', [], 'dumbbell', 'isolation', 3, 10, 15, 90, 'Cotovelos levemente flexionados e fixos. Abra até sentir alongamento no peitoral e feche em arco.', ['pec_deck', 'crossover']],
  ['pec_deck', 'Crucifixo máquina (peck deck)', 'chest', [], 'machine', 'isolation', 3, 10, 15, 75, 'Peito estufado, feche os braços contraindo o peitoral e volte devagar.', ['fly_db', 'crossover']],
  ['crossover', 'Crossover na polia', 'chest', [], 'cable', 'isolation', 3, 12, 15, 75, 'Leve inclinação do tronco à frente. Traga as mãos à frente do corpo em arco, cotovelos semiflexionados.', ['pec_deck', 'fly_db']],
  ['pushup', 'Flexão de braço', 'chest', ['triceps', 'shoulders', 'abs'], 'bodyweight', 'compound', 3, 10, 20, 75, 'Corpo alinhado da cabeça aos pés, desça até o peito quase tocar o chão.', ['bench_db', 'bench_machine']],

  // ---- Costas
  ['pullup', 'Barra fixa', 'back', ['biceps'], 'bodyweight', 'compound', 4, 6, 10, 120, 'Pegada pronada um pouco mais aberta que os ombros. Puxe o peito em direção à barra sem balançar.', ['lat_pulldown', 'neutral_pulldown']],
  ['lat_pulldown', 'Puxada frontal', 'back', ['biceps'], 'cable', 'compound', 4, 8, 12, 90, 'Tronco levemente inclinado para trás, puxe a barra até a parte alta do peito levando os cotovelos para baixo.', ['pullup', 'neutral_pulldown']],
  ['neutral_pulldown', 'Puxada com triângulo', 'back', ['biceps'], 'cable', 'compound', 3, 8, 12, 90, 'Pegada neutra, puxe até o peito mantendo o tronco estável.', ['lat_pulldown', 'pullup']],
  ['bb_row', 'Remada curvada com barra', 'back', ['biceps', 'hamstrings'], 'barbell', 'compound', 4, 6, 10, 120, 'Tronco inclinado a ~45°, coluna neutra. Puxe a barra em direção ao umbigo.', ['tbar_row', 'machine_row']],
  ['db_row', 'Remada unilateral com halter', 'back', ['biceps'], 'dumbbell', 'compound', 3, 8, 12, 90, 'Apoio no banco, puxe o halter em direção ao quadril mantendo o cotovelo próximo ao corpo.', ['seated_row', 'machine_row']],
  ['seated_row', 'Remada baixa na polia', 'back', ['biceps'], 'cable', 'compound', 3, 8, 12, 90, 'Coluna neutra, puxe o triângulo até o abdômen e aproxime as escápulas.', ['db_row', 'machine_row']],
  ['tbar_row', 'Remada cavalinho', 'back', ['biceps'], 'barbell', 'compound', 3, 8, 12, 120, 'Peito para fora, puxe a carga em direção ao peito sem arredondar a lombar.', ['bb_row', 'machine_row']],
  ['machine_row', 'Remada máquina', 'back', ['biceps'], 'machine', 'compound', 3, 8, 12, 90, 'Peito apoiado, puxe as pegadas levando os cotovelos para trás.', ['seated_row', 'db_row']],
  ['straight_pulldown', 'Pulldown com braços estendidos', 'back', [], 'cable', 'isolation', 3, 12, 15, 75, 'Braços quase estendidos, leve a barra da altura dos olhos até as coxas contraindo o dorsal.', ['lat_pulldown']],
  ['deadlift', 'Levantamento terra', 'back', ['hamstrings', 'glutes', 'forearms'], 'barbell', 'compound', 3, 4, 6, 180, 'Barra próxima às canelas, coluna neutra. Empurre o chão com as pernas e estenda o quadril no topo.', ['rdl', 'tbar_row']],
  ['back_ext', 'Hiperextensão lombar', 'back', ['glutes', 'hamstrings'], 'bodyweight', 'isolation', 3, 12, 15, 60, 'Desça com a coluna neutra e suba até alinhar o tronco às pernas, sem hiperestender.', ['rdl']],

  // ---- Ombros
  ['ohp_bb', 'Desenvolvimento militar com barra', 'shoulders', ['triceps'], 'barbell', 'compound', 4, 6, 10, 120, 'Em pé, glúteos e abdômen contraídos. Empurre a barra acima da cabeça em linha reta.', ['ohp_db', 'ohp_machine']],
  ['ohp_db', 'Desenvolvimento com halteres', 'shoulders', ['triceps'], 'dumbbell', 'compound', 3, 8, 12, 90, 'Sentado com apoio, desça os halteres até a linha das orelhas e empurre sem bater um no outro.', ['ohp_bb', 'ohp_machine']],
  ['ohp_machine', 'Desenvolvimento máquina', 'shoulders', ['triceps'], 'machine', 'compound', 3, 8, 12, 90, 'Ajuste o banco para as pegadas ficarem na linha dos ombros.', ['ohp_db']],
  ['lateral_db', 'Elevação lateral com halteres', 'shoulders', [], 'dumbbell', 'isolation', 4, 12, 15, 60, 'Leve inclinação à frente, eleve os halteres até a altura dos ombros liderando com os cotovelos.', ['lateral_cable', 'lateral_machine']],
  ['lateral_cable', 'Elevação lateral na polia', 'shoulders', [], 'cable', 'isolation', 3, 12, 15, 60, 'Polia baixa, eleve o braço lateralmente até a linha do ombro com tensão constante.', ['lateral_db']],
  ['lateral_machine', 'Elevação lateral máquina', 'shoulders', [], 'machine', 'isolation', 3, 12, 15, 60, 'Cotovelos apoiados nas almofadas, eleve até a linha dos ombros.', ['lateral_db', 'lateral_cable']],
  ['front_raise', 'Elevação frontal', 'shoulders', [], 'dumbbell', 'isolation', 3, 10, 15, 60, 'Eleve os halteres à frente até a altura dos olhos sem balançar o tronco.', ['ohp_db']],
  ['rear_fly', 'Crucifixo inverso', 'shoulders', ['back'], 'dumbbell', 'isolation', 3, 12, 15, 60, 'Tronco inclinado, abra os braços lateralmente focando no deltoide posterior.', ['face_pull', 'rear_delt_machine']],
  ['rear_delt_machine', 'Crucifixo inverso máquina', 'shoulders', ['back'], 'machine', 'isolation', 3, 12, 15, 60, 'Peito apoiado, abra os braços até a linha do corpo.', ['rear_fly', 'face_pull']],
  ['face_pull', 'Face pull', 'shoulders', ['back'], 'cable', 'isolation', 3, 12, 15, 60, 'Corda na altura do rosto, puxe em direção aos olhos abrindo os cotovelos e rodando os ombros para fora.', ['rear_fly']],
  ['shrug', 'Encolhimento com halteres', 'shoulders', ['forearms'], 'dumbbell', 'isolation', 3, 10, 15, 60, 'Eleve os ombros em direção às orelhas, segure 1 s no topo e desça controlando.', []],

  // ---- Bíceps
  ['curl_bb', 'Rosca direta com barra', 'biceps', ['forearms'], 'barbell', 'isolation', 3, 8, 12, 75, 'Cotovelos fixos ao lado do corpo, suba a barra sem balançar o tronco.', ['curl_ez', 'curl_alt_db']],
  ['curl_ez', 'Rosca direta com barra W', 'biceps', ['forearms'], 'barbell', 'isolation', 3, 8, 12, 75, 'Pegada na parte angulada da barra, cotovelos fixos.', ['curl_bb', 'curl_cable']],
  ['curl_alt_db', 'Rosca alternada com halteres', 'biceps', ['forearms'], 'dumbbell', 'isolation', 3, 8, 12, 75, 'Supine o punho durante a subida, um braço de cada vez.', ['curl_bb', 'hammer']],
  ['hammer', 'Rosca martelo', 'biceps', ['forearms'], 'dumbbell', 'isolation', 3, 10, 12, 60, 'Pegada neutra, cotovelos fixos, suba até contrair o bíceps.', ['curl_alt_db']],
  ['preacher', 'Rosca Scott', 'biceps', [], 'machine', 'isolation', 3, 8, 12, 75, 'Braços apoiados no banco Scott, desça até quase estender e suba sem tirar o braço do apoio.', ['concentration', 'curl_ez']],
  ['concentration', 'Rosca concentrada', 'biceps', [], 'dumbbell', 'isolation', 3, 10, 12, 60, 'Cotovelo apoiado na parte interna da coxa, suba controlando e contraia no topo.', ['preacher']],
  ['curl_cable', 'Rosca na polia', 'biceps', [], 'cable', 'isolation', 3, 10, 15, 60, 'Polia baixa, cotovelos fixos, tensão constante durante todo o movimento.', ['curl_ez']],

  // ---- Tríceps
  ['pushdown_rope', 'Tríceps pulley com corda', 'triceps', [], 'cable', 'isolation', 3, 10, 15, 60, 'Cotovelos colados ao corpo, estenda e abra a corda no final.', ['pushdown_bar', 'overhead_db']],
  ['pushdown_bar', 'Tríceps pulley com barra', 'triceps', [], 'cable', 'isolation', 3, 10, 15, 60, 'Cotovelos fixos, estenda totalmente sem inclinar o tronco à frente.', ['pushdown_rope']],
  ['skullcrusher', 'Tríceps testa', 'triceps', [], 'barbell', 'isolation', 3, 8, 12, 75, 'Deitado, desça a barra W em direção à testa movendo só os antebraços.', ['overhead_db', 'pushdown_bar']],
  ['overhead_db', 'Tríceps francês com halter', 'triceps', [], 'dumbbell', 'isolation', 3, 10, 12, 75, 'Halter atrás da cabeça, cotovelos apontando para cima, estenda os braços.', ['skullcrusher', 'pushdown_rope']],
  ['dips', 'Mergulho nas paralelas', 'triceps', ['chest', 'shoulders'], 'bodyweight', 'compound', 3, 8, 12, 90, 'Tronco mais vertical para focar tríceps. Desça até os cotovelos formarem ~90°.', ['close_grip', 'decline_bb']],
  ['close_grip', 'Supino pegada fechada', 'triceps', ['chest'], 'barbell', 'compound', 3, 6, 10, 120, 'Mãos na largura dos ombros, cotovelos próximos ao corpo na descida.', ['dips']],
  ['kickback', 'Tríceps coice na polia', 'triceps', [], 'cable', 'isolation', 3, 12, 15, 60, 'Tronco inclinado, braço paralelo ao chão, estenda o antebraço para trás.', ['pushdown_rope']],

  // ---- Pernas
  ['squat', 'Agachamento livre', 'quads', ['glutes', 'hamstrings'], 'barbell', 'compound', 4, 6, 10, 180, 'Barra no trapézio, pés na largura dos ombros. Desça com o tronco firme até pelo menos a coxa paralela.', ['hack', 'leg_press', 'front_squat']],
  ['front_squat', 'Agachamento frontal', 'quads', ['glutes', 'abs'], 'barbell', 'compound', 3, 6, 10, 150, 'Barra apoiada na frente dos ombros, cotovelos altos, tronco bem vertical.', ['squat', 'hack']],
  ['leg_press', 'Leg press 45°', 'quads', ['glutes'], 'machine', 'compound', 4, 8, 12, 120, 'Pés na largura dos ombros, desça até ~90° sem tirar a lombar do encosto.', ['hack', 'squat']],
  ['hack', 'Agachamento hack', 'quads', ['glutes'], 'machine', 'compound', 3, 8, 12, 120, 'Costas apoiadas, desça controlando até a coxa paralela e empurre pela planta do pé.', ['leg_press', 'squat']],
  ['leg_ext', 'Cadeira extensora', 'quads', [], 'machine', 'isolation', 3, 10, 15, 60, 'Ajuste o encosto para o joelho alinhar ao eixo da máquina, estenda e segure 1 s no topo.', ['bulgarian']],
  ['lying_curl', 'Mesa flexora', 'hamstrings', [], 'machine', 'isolation', 3, 10, 12, 75, 'Quadril apoiado no banco, flexione os joelhos sem tirar o quadril.', ['seated_curl', 'rdl']],
  ['seated_curl', 'Cadeira flexora', 'hamstrings', [], 'machine', 'isolation', 3, 10, 12, 75, 'Coxas travadas, flexione os joelhos até o máximo e volte devagar.', ['lying_curl']],
  ['stiff', 'Stiff', 'hamstrings', ['glutes', 'back'], 'barbell', 'compound', 3, 8, 12, 120, 'Joelhos levemente flexionados e fixos, desça a barra rente às pernas levando o quadril para trás.', ['rdl', 'lying_curl']],
  ['rdl', 'Levantamento terra romeno', 'hamstrings', ['glutes', 'back'], 'barbell', 'compound', 3, 6, 10, 120, 'Desça a barra até abaixo dos joelhos com a coluna neutra e estenda o quadril.', ['stiff', 'deadlift']],
  ['lunge', 'Avanço com halteres', 'quads', ['glutes'], 'dumbbell', 'compound', 3, 10, 12, 90, 'Passo largo à frente, desça até o joelho de trás quase tocar o chão. Reps por perna.', ['bulgarian']],
  ['bulgarian', 'Agachamento búlgaro', 'quads', ['glutes'], 'dumbbell', 'compound', 3, 8, 12, 90, 'Pé de trás apoiado no banco, desça na vertical. Reps por perna.', ['lunge', 'leg_press']],

  // ---- Glúteos
  ['hip_thrust', 'Elevação pélvica com barra', 'glutes', ['hamstrings'], 'barbell', 'compound', 4, 8, 12, 120, 'Escápulas no banco, barra no quadril. Suba até alinhar tronco e coxas e contraia o glúteo.', ['glute_bridge', 'cable_kickback']],
  ['glute_bridge', 'Ponte de glúteo', 'glutes', ['hamstrings'], 'bodyweight', 'isolation', 3, 12, 15, 60, 'Deitado, pés próximos ao glúteo, eleve o quadril e segure 1 s no topo.', ['hip_thrust']],
  ['cable_kickback', 'Glúteo na polia', 'glutes', [], 'cable', 'isolation', 3, 12, 15, 60, 'Tornozeleira na polia baixa, estenda o quadril para trás sem arquear a lombar.', ['hip_thrust']],
  ['abductor', 'Cadeira abdutora', 'glutes', [], 'machine', 'isolation', 3, 12, 20, 60, 'Abra as pernas contra a resistência e volte controlando.', ['cable_kickback']],
  ['sumo_squat', 'Agachamento sumô', 'glutes', ['quads'], 'dumbbell', 'compound', 3, 10, 12, 90, 'Pés afastados e apontados para fora, desça com o tronco ereto segurando o halter.', ['squat', 'hip_thrust']],

  // ---- Panturrilhas
  ['calf_standing', 'Panturrilha em pé', 'calves', [], 'machine', 'isolation', 4, 10, 15, 60, 'Desça o calcanhar até alongar e suba na ponta dos pés, pausa de 1 s no topo.', ['calf_leg_press', 'calf_seated']],
  ['calf_seated', 'Panturrilha sentado', 'calves', [], 'machine', 'isolation', 4, 12, 20, 60, 'Joelhos a 90°, amplitude completa com pausa no alongamento.', ['calf_standing']],
  ['calf_leg_press', 'Panturrilha no leg press', 'calves', [], 'machine', 'isolation', 4, 12, 15, 60, 'Ponta dos pés na borda da plataforma, empurre só com os tornozelos.', ['calf_standing']],

  // ---- Core
  ['plank', 'Prancha', 'abs', [], 'bodyweight', 'isolation', 3, 30, 60, 60, 'Antebraços no chão, corpo alinhado e abdômen contraído. Reps = segundos.', ['side_plank', 'ab_wheel']],
  ['side_plank', 'Prancha lateral', 'abs', [], 'bodyweight', 'isolation', 3, 20, 45, 45, 'Apoio no antebraço, quadril elevado e alinhado. Reps = segundos por lado.', ['plank']],
  ['crunch', 'Abdominal supra', 'abs', [], 'bodyweight', 'isolation', 3, 15, 20, 45, 'Eleve as escápulas do chão contraindo o abdômen, sem puxar o pescoço.', ['cable_crunch']],
  ['cable_crunch', 'Abdominal na polia', 'abs', [], 'cable', 'isolation', 3, 12, 15, 60, 'Ajoelhado, flexione o tronco levando os cotovelos em direção aos joelhos.', ['crunch']],
  ['hanging_raise', 'Elevação de pernas na barra', 'abs', [], 'bodyweight', 'isolation', 3, 10, 15, 60, 'Pendurado, eleve as pernas sem balançar, controlando a descida.', ['crunch']],
  ['ab_wheel', 'Roda abdominal', 'abs', [], 'other', 'isolation', 3, 8, 12, 60, 'Ajoelhado, role à frente mantendo a lombar neutra e volte contraindo o abdômen.', ['plank']],

  // ---- Condicionamento (reps = minutos)
  ['treadmill', 'Esteira', 'cardio', [], 'machine', 'cardio', 1, 15, 30, 0, 'Caminhada inclinada ou corrida. Registre os minutos em "reps".', ['bike', 'elliptical']],
  ['bike', 'Bicicleta ergométrica', 'cardio', [], 'machine', 'cardio', 1, 15, 30, 0, 'Ajuste o banco na altura do quadril. Registre os minutos.', ['treadmill', 'elliptical']],
  ['elliptical', 'Transport (elíptico)', 'cardio', [], 'machine', 'cardio', 1, 15, 30, 0, 'Baixo impacto, mantenha o ritmo constante. Registre os minutos.', ['bike']],
  ['rower', 'Remo ergômetro', 'cardio', ['back'], 'machine', 'cardio', 1, 10, 20, 0, 'Pernas, tronco e braços, nessa ordem, na puxada. Registre os minutos.', ['bike']],
  ['stairs', 'Escada (simulador)', 'cardio', ['glutes'], 'machine', 'cardio', 1, 10, 20, 0, 'Postura ereta, sem apoiar o peso nos braços. Registre os minutos.', ['treadmill']],
  ['jump_rope', 'Pular corda', 'cardio', ['calves'], 'other', 'cardio', 3, 2, 5, 60, 'Saltos curtos na ponta dos pés. Registre os minutos por bloco.', ['burpee']],
  ['burpee', 'Burpee', 'full_body', [], 'bodyweight', 'cardio', 3, 10, 15, 60, 'Agache, apoie as mãos, estenda as pernas, volte e salte.', ['jump_rope']],
];

export const EXERCISE_CATALOG: CatalogExercise[] = ROWS.map(([key, name, primary, secondary, equipment, movement, sets, repMin, repMax, restSec, instructions, alternatives]) => ({
  key,
  name,
  primary,
  secondary,
  equipment,
  movement,
  sets,
  repMin,
  repMax,
  restSec,
  instructions,
  alternatives,
}));

/** Library sections and the muscle groups they contain. */
export const LIBRARY_SECTIONS: ReadonlyArray<{ key: string; label: string; muscles: MuscleGroup[] }> = [
  { key: 'chest', label: 'Peito', muscles: ['chest'] },
  { key: 'back', label: 'Costas', muscles: ['back'] },
  { key: 'shoulders', label: 'Ombros', muscles: ['shoulders'] },
  { key: 'biceps', label: 'Bíceps', muscles: ['biceps', 'forearms'] },
  { key: 'triceps', label: 'Tríceps', muscles: ['triceps'] },
  { key: 'legs', label: 'Pernas', muscles: ['quads', 'hamstrings'] },
  { key: 'glutes', label: 'Glúteos', muscles: ['glutes'] },
  { key: 'calves', label: 'Panturrilhas', muscles: ['calves'] },
  { key: 'core', label: 'Core', muscles: ['abs'] },
  { key: 'conditioning', label: 'Condicionamento', muscles: ['cardio', 'full_body'] },
];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Peito',
  back: 'Costas',
  shoulders: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebraços',
  quads: 'Quadríceps',
  hamstrings: 'Posteriores',
  glutes: 'Glúteos',
  calves: 'Panturrilhas',
  abs: 'Abdômen',
  full_body: 'Corpo todo',
  cardio: 'Cardio',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barra',
  dumbbell: 'Halteres',
  machine: 'Máquina',
  cable: 'Polia',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
  band: 'Elástico',
  smith: 'Smith',
  other: 'Outro',
};

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  compound: 'Multiarticular',
  isolation: 'Isolado',
  cardio: 'Cardio',
};

/** Deterministic id for a catalog entry, so alternatives resolve and reseeding is idempotent. */
export function catalogId(key: string): string {
  return `seed-ex-${key}`;
}
