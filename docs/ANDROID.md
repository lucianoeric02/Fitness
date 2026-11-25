# Instalando o Iron Track no Android

O APK é gerado e assinado automaticamente pelo **GitHub Actions** (gratuito e ilimitado em repositório público). Nada roda em servidor depois disso: o app funciona 100% no celular.

## 1. Configuração única: secrets de assinatura

Todo APK precisa ser assinado com **a mesma chave** para instalar atualizações por cima, sem perder dados.

1. GitHub → repositório → **Settings → Secrets and variables → Actions → New repository secret**.
2. Crie os 4 secrets com os valores do arquivo `signing/GITHUB_SECRETS.txt` (gerado localmente, **nunca** commitado):
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_PASSWORD`
   - `ANDROID_KEY_ALIAS`
3. Guarde uma cópia desse arquivo num lugar seguro (gerenciador de senhas). O GitHub não deixa ler secrets de volta.

Sem os secrets, o workflow ainda compila e testa o projeto, mas não gera um APK instalável.

## 2. Gerar o APK

- **Automático**: todo push na `main` publica o APK na release `apk-latest`.
- **Manual (qualquer branch)**: GitHub → **Actions → Android APK → Run workflow** → escolha a branch.

Link fixo de download (abra no navegador do celular):

```
https://github.com/lucianoeric02/Fitness/releases/download/apk-latest/iron-track.apk
```

Cada build também fica disponível como artefato do workflow por 30 dias.

## 3. Instalar no Xiaomi (HyperOS)

1. Baixe `iron-track.apk` pelo link acima.
2. Abra o arquivo. Na primeira vez, permita **"Instalar apps desconhecidos"** para o navegador/gerenciador de arquivos.
3. Se o HyperOS mostrar o aviso de segurança, toque em **"Instalar mesmo assim"**.
4. Para atualizar: baixe o novo APK e instale por cima. **Os dados são mantidos.**

### Recomendado no HyperOS

- **Configurações → Apps → Iron Track → Economia de bateria → Sem restrições** (garante timer de descanso e lembretes nas próximas fases).
- **Autoinício**: ativado.

## Segurança dos dados

- Os dados ficam no armazenamento interno do app. **Desinstalar ou "Limpar dados" apaga tudo.**
- Use **Mais → Dados e backup → Exportar backup** com frequência (o arquivo pode ir direto para o Google Drive pelo menu de compartilhar).
- O backup automático do Android (Google One) também pode incluir os dados do app, se estiver ativo no aparelho.
- O repositório é público: o **código** é visível, mas nenhum dado pessoal vai para o GitHub. O APK publicado não contém dados.

## Build local (opcional)

Requer Android Studio (SDK 36) e JDK 21.

```bash
npm ci && npm run cap:sync
cd android && ./gradlew assembleDebug
```

Um APK de debug local usa outra assinatura: não instale por cima do APK do GitHub (seria preciso desinstalar).
