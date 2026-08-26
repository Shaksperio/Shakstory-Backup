# Operação com GitHub

O repositório GitHub deve ser privado e conter código, schemas, documentação, scripts e os arquivos JSON editoriais autorizados. O frontend nunca recebe o token do GitHub e nunca chama a API do GitHub diretamente.

## Variáveis de ambiente do servidor

```dotenv
GITHUB_TOKEN=
GITHUB_OWNER=
GITHUB_REPOSITORY=
GITHUB_BRANCH=main
```

`GITHUB_TOKEN` é obrigatório apenas quando a sincronização versionada estiver habilitada. Ele deve possuir o menor conjunto de permissões possível para o repositório privado. As demais variáveis identificam o destino e não são credenciais, mas continuam sendo configuradas somente no ambiente do backend.

## Fluxo de persistência

A API valida o payload, agrupa alterações do autosave e publica documentos independentes em um commit de sincronização. O adaptador lê o SHA atual antes de escrever e envia o SHA na atualização. Se o SHA tiver mudado, a gravação é rejeitada como conflito; nenhum conteúdo é sobrescrito silenciosamente.

O GitHub não é usado como banco de dados de baixa latência nem recebe um commit a cada tecla. O banco operacional mantém a interação rápida; JSON/GitHub representa persistência versionada, auditoria e backup.

## GitHub OAuth

Para o OAuth App do GitHub, use como **Authorization callback URL**:

```text
https://shakstory-cpuxtpcc.manus.space/api/github/oauth/callback
```

O fluxo usa `state`, PKCE (`S256`) e cookies `HttpOnly`/`Secure`. O Client ID e o Client Secret são lidos exclusivamente do ambiente do servidor como `GITHUB_OAUTH_CLIENT_ID` e `GITHUB_OAUTH_CLIENT_SECRET`. O frontend inicia a autorização por `/api/github/oauth/start` e nunca recebe o Client Secret.

## Publicação do repositório

```bash
gh repo create shakstory --private --source=. --remote=github --push
```

Antes do comando, verifique o conteúdo com `pnpm check`, `pnpm test`, `pnpm validate:data` e `git diff --check`. Nunca use `git add .env`, arquivos de sessão, tokens ou dumps não autorizados.
