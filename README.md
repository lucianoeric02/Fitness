# Iron Track

Aplicativo pessoal de treino, nutrição e evolução corporal. Android primeiro, offline primeiro, custo zero.

## Stack

| Camada | Tecnologia |
| --- | --- |
| UI | React 19 + TypeScript + Tailwind CSS 4 |
| Build | Vite |
| Dados locais | IndexedDB via Dexie (fonte da verdade, funciona offline) |
| Android | Capacitor 8 (APK assinado gerado no GitHub Actions) |
| Testes | Vitest + Testing Library + fake-indexeddb |
| Nuvem (futuro, opcional) | Supabase plano gratuito, só para backup/sincronização |

Fontes e ícones são empacotados no app. Nenhum script de terceiros, analytics ou API paga.

## Estrutura

```
src/
  app/            roteador e guarda de onboarding
  components/
    layout/       AppShell, BottomNav
    ui/           design system (Button, Card, Field, BottomSheet, ProgressRing, Toast…)
  data/
    db.ts         esquema IndexedDB (Dexie)
    repos/        acesso a dados por domínio (perfil, metas, corpo, onboarding)
    backup.ts     exportar / validar / restaurar / apagar
  domain/
    models.ts     tipos de domínio
    calc/         cálculos puros e testados (nutrição, água, peso, metas, treino)
    validation.ts validação de entrada
  features/       telas por módulo (home, onboarding, more, workout, nutrition, progress)
  hooks/          hooks reativos (useLiveQuery) e useToday
  lib/            datas locais (DayKey), números pt-BR, IDs
  services/       integrações de plataforma (salvar arquivo / compartilhar)
android/          projeto nativo Capacitor
```

## Design system

Tokens em `src/styles/index.css` (`@theme`), usados como utilitários Tailwind. Componentes não usam valores arbitrários.

| Grupo | Tokens |
| --- | --- |
| Cores | `bg`, `surface`, `elevated`, `line`, `ink`, `muted`, `faint`, `accent`, macros e estados |
| Tipografia | `text-micro` 11, `text-xs` 12, `text-caption` 13, `text-sm` 14, `text-body` 15, `text-title` 28, `text-metric` 34; `font-display` para números |
| Espaçamento | escala de 4 px do Tailwind; `nav`, `touch` (44 px) |
| Raios | `rounded-control`, `rounded-card`, `rounded-sheet` |
| Elevação | nível 0 `bg` → 1 `surface` → 2 `elevated`; sombras `raised`, `overlay`, `accent` |
| Movimento | `duration-fast/base/slow`, `ease-out-expo`, `pressable`, `animate-page-in`; respeita *reduced motion* |
| Layout | `max-w-app`, breakpoint `xs` (360 px), `pt-safe-*`, `pb-safe-*`, `pb-nav-safe` |

Componentes (`src/components`): `AppHeader`, `BottomNavigation`, `PageContainer`, `TileGrid`, `SectionHeader`, `Card`, `MetricCard`, `ProgressBar`, `ProgressRing`, `Button`/`PrimaryButton`/`SecondaryButton`, `IconButton`, `Input`, `NumberInput`, `DateInput`, `Segmented`, `Modal`, `BottomSheet`, `ConfirmSheet`, `Toast`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, `ListGroup`/`ListRow`.

Proteções de navegação: a barra inferior se esconde enquanto o teclado está aberto, e formulários com alterações pedem confirmação antes de sair (`useUnsavedChangesGuard`).

## Treino

- **Rotinas em sequência rotativa** (A → B → C → A…): o próximo treino é a rotina ativa seguinte à do último treino concluído.
- **Sessão só começa com toque explícito** em "Iniciar treino". As séries vêm pré-preenchidas com o desempenho anterior; nada aumenta carga sozinho.
- **Timer de descanso por timestamps** (`src/domain/calc/restTimer.ts`): o restante é sempre `fim − agora`, então continua correto com tela apagada, app em segundo plano ou reiniciado. No APK, uma notificação local é agendada para o fim do descanso.
- **Substituições** valem só para a sessão; atualizar a rotina é uma escolha explícita. Ficam registradas no histórico.
- **Histórico protegido**: sessões copiam nomes e prescrições; editar/excluir rotinas ou exercícios não altera treinos concluídos.
- **Recordes**: maior carga, melhor 1RM estimado (Epley) e mais repetições, comparados apenas com sessões anteriores.
- Catálogo inicial com ~80 exercícios (seed removível em Dados e backup).

## Princípios de dados

- **IDs UUID** e `createdAt`/`updatedAt` em todo registro, prontos para sincronização futura.
- **Datas locais**: registros diários usam `day` (`AAAA-MM-DD`) no fuso do aparelho, com horário configurável de virada do dia.
- **Histórico protegido**: sessões copiam o nome do treino e dos exercícios; registros de alimento guardam um snapshot dos nutrientes. Editar um modelo ou alimento nunca altera o passado.
- **Metas versionadas**: mudar a meta calórica hoje não muda o progresso de dias anteriores.
- **Separação**: modelos de treino × sessões × exercícios × séries; catálogo de alimentos × refeições salvas × registros; metas × medições.

## Comandos

```bash
npm install
npm run dev        # servidor local
npm test           # testes
npm run typecheck  # checagem de tipos
npm run build      # build de produção (dist/)
npm run cap:sync   # build + copia para o projeto Android
```

## Android

Veja [docs/ANDROID.md](docs/ANDROID.md).
