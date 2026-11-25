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
