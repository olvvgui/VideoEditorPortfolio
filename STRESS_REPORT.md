# FRAME — correções de resiliência e validação

**Resultado do stress completo: aprovado**, Node 22.22.1, Prisma 6.19.0, SQLite temporário, execução de 09/09/2026. Evidências: [resultado final](STRESS_RESULTS.json), [baseline executado](docs/STRESS_BASELINE.json), [diagnóstico Prisma](docs/PRISMA_DIAGNOSTIC.json). Nenhum banco real, credencial ou dado de usuário foi alterado. Não houve migração para PostgreSQL.

## Problemas encontrados

| Arquivo | Causa e impacto | Classificação / severidade | Reprodução |
| --- | --- | --- | --- |
| `server/src/videos/videos.service.ts` | Cada cadastro abre transação concorrente; saturação SQLite vence o timeout e chega como 500 | Disponibilidade / alta | Baseline: 16 respostas 500 em 300 requisições concorrência 30, P95 5.067 ms |
| `server/src/security/exceptions.filter.ts` | Log preservava somente classe e requestId, sem código, operação ou duração; dificultava distinguir saturação de bug | Confiabilidade / média | Logs reais do baseline só continham `PrismaClientKnownRequestError` |
| `server/src/prisma/prisma.module.ts` e services de escrita | Sem admissão/fila limitada comum a vídeos, categorias e sessões | Disponibilidade / alta | Reprodução com 30 transações diretas e teste com escritor externo |
| `server/prisma/schema.prisma` e service de vídeos | Seleção transacional já funcionava, mas não havia restrição única no banco | Consistência / média, risco mitigado | Seleções de stress já mantinham um; novo teste tenta gravar segundo showreel diretamente e recebe P2002 |
| `server/src/categories/categories.service.ts` | Checagem de nome/existência/uso separada das escritas; possibilidade de corrida; crescimento sem limite de categorias | Consistência e desempenho / média | Inspeção do fluxo anterior; novo teste concorrente de nomes equivalentes retorna 201/409 e cap rejeita a 101ª categoria |
| `server/src/main.ts` / Throttler instalado | Só global/por handler e exceção de login; política agregada emitia `Retry-After-aggregate`, sem `Retry-After` padrão | Disponibilidade e interoperabilidade / média | Inspeção do Throttler 6.4; teste HTTP varia X-Forwarded-For e exige headers no 429 |
| `server/src/videos/videos.service.ts`, `src/App.tsx`, `src/components/Admin.tsx` | Listagem completa, descrições integrais, busca local e todos os cards no DOM | Desempenho / alta; superfície de exaustão de recursos | Teste fornecido: 5.000 vídeos, 5.809.724 bytes e 75.259 elementos públicos |
| `server/src/main.ts` / deploy | Nenhuma garantia de compressão no repositório | Desempenho / média | Configuração existente não continha middleware nem configuração de proxy para compressão |

O diagnóstico reproduzível do padrão sem fila registrou **15 P1008, um P2028 e 14 sucessos** em 30 transações. O P2028 indicou transação expirada/fechada, cerca de 5 segundos. O código de cada erro histórico não pode ser reconstruído dos logs antigos. Não foi comprovada corrupção nem queda do processo.

## Alterações realizadas

| Arquivos | Antes → depois | Justificativa |
| --- | --- | --- |
| `server/src/prisma/write-gate.ts`, `prisma.module.ts` | Escritas concorrentes → um escritor, fila máxima 16, espera de 1 s, transação com aquisição de 1 s/callback de 3 s | Limitar trabalho aceito, rejeitar excesso e liberar em finally; shutdown rejeita aguardantes e drena transação antes de desconectar |
| `server/src/videos/videos.service.ts` | Transações independentes e categoria fora da transação → todas as mutações usam o gate, validação de categoria dentro da transação | Evitar disputa interna e manter seleção/exclusão atômicas |
| `server/src/categories/categories.service.ts`, `server/src/auth/auth.service.ts` | Escritas não coordenadas → mesmo gate/transação para categorias e sessões | Nenhum caminho de escrita administrativa fica fora da proteção; categorias passam a ter cap 100 |
| `server/src/security/database-errors.ts`, `exceptions.filter.ts` | Código omitido e timeout genérico 500 → log seguro e classificação explícita | P1008/P2024/P2034 e P2028 de aquisição retornam 503; outros P2028/bugs continuam 500; constraints não são tratadas como saturação |
| `server/src/security/http.ts` | Erros do parser/origem sem nome HTTP → formato básico consistente com filtro | Manter resposta sanitizada também antes do controller |
| `server/src/security/rate.guard.ts`, `server/src/main.ts` | Sem política agregada específica de escrita / Retry-After padrão em toda política → 100 escritas/min/IP e Retry-After em todo 429 | Mantém global 120/min e login 5/min; orienta recuperação sem enfraquecer proteção |
| `server/prisma/schema.prisma`, nova migration | Sem índices de catálogo/unicidade do showreel → dois índices compostos e um único parcial | Ordenação/páginas, filtro de categoria e integridade no banco; detalhes em `docs/RESILIENCE.md` |
| `server/src/videos/video-query.dto.ts`, `videos.controller.ts`, `videos.service.ts` | GET retorna array completo → envelope paginado, busca/filtros explícitos, detalhe/destaque separados | Default 24, máximo 100, rejeição de query arbitrária, desempate por id |
| `src/api.ts`, `src/App.tsx`, `src/components/Admin.tsx`, `src/styles.css` | Lista integral e filtro local → páginas substituídas, busca com debounce no backend, tipos de lista/detalhe e carregamento do detalhe para modal/edição | 24 cards por tela; respostas antigas não sobrescrevem uma busca mais nova; demo estática preservada |
| `server/src/security/compression.ts`, `main.ts` | Sem compressão garantida → gzip apenas na listagem pública JSON 200 acima de 1 KB | Reduz banda sem comprimir sessões, erros ou mídia |
| `tests/*`, `scripts/stress-check.mjs`, `scripts/prisma-diagnostic.mjs` | Stress sem critérios amplos → assertions de admissão, recuperação, DB, paginação, segurança, payload e navegador | Evidência reproduzível em banco temporário; testes antigos adaptados ao novo envelope e filtro assíncrono |
| `README.md`, `docs/*`, este relatório | Recomendações gerais → contrato, limites, operação, métricas e evidências | Deploy consciente da restrição de uma instância e dos limites restantes |

A alteração de `package.json` que acrescenta `test:stress` **já existia no workspace**; foi preservada. Não foram adicionadas dependências nem alterado o lockfile.

## Segurança

### Vulnerabilidades reais comprovadas

Não foi comprovado bypass de autenticação/autorização, SSRF, SQL injection, exposição de tokens ou mass assignment. Não se classificam indiscriminadamente a lentidão da galeria e a contenção como vulnerabilidades de segurança. As falhas confirmadas são principalmente de **disponibilidade, confiabilidade, desempenho e consistência**.

### Riscos mitigados

- Consumo ilimitado por uma única listagem pública: paginação, campos menores e consultas explicitamente permitidas.
- Amplificação de escrita administrativa: fila limitada, rate limit específico e rejeições controladas.
- Corridas de categoria no processo suportado e segundo showreel persistido: transação/gate e índice único parcial.
- Diagnóstico sem contexto e vazamento acidental ao logar Prisma: allowlist de campos estruturados; códigos permanecem somente internamente.

### Pontos investigados que já estavam protegidos

- Cadastro é de projeto/vídeo, **não cadastro público de contas**. Todas as mutações já tinham AuthGuard global; login exige Admin real, sessão persistida e hash de credencial coerente.
- DTOs já limitavam título 120, descrição 5.000, URL 2.048, categoria 40, boolean; whitelist rejeitava campos desconhecidos. Parser já limitava JSON a 32 KB e rejeitava body comprimido. Foram preservados e testados.
- Backend não acessa URLs cadastradas; não existe fluxo SSRF. Hosts YouTube são validados, sem fetch/DNS/redirect lookup. Thumbnails/player são montados no browser a partir do ID.
- Trust proxy já era explícito/desativado por padrão; spoof de X-Forwarded-For não altera identidade nesse modo.
- Helmet, CSP para embeds legítimos, nosniff, política de framing, Referrer-Policy, HSTS e ocultação de X-Powered-By já existiam. Produção usa mesma origem, sem CORS wildcard com credentials.

### Riscos e limites restantes

Uma instância escritora; rate limit local não atende várias réplicas nem impede DDoS distribuído. Proxy externo real não foi testado: configurar peers exatos, sobrescrever XFF na borda e restringir acesso direto. Logs precisam de retenção/rotação operacional.

Busca SQLite por substring ainda examina linhas e tem case folding limitado a ASCII, diferente do filtro Unicode anterior no navegador. Offset pode deslocar registros quando o catálogo muda entre páginas; a prova de não duplicação/perda é para catálogo estável. Não há idempotency key para falha de rede ambígua. Categorias legadas acima do novo cap não são apagadas/escondidas automaticamente. Essas limitações e os gatilhos para PostgreSQL estão documentados em [operação](docs/RESILIENCE.md).

## Testes e métricas

### Baseline

Antes da edição: `npm test` passou seis testes, com dois testes de integração condicionais não executados fora do runner isolado. `npm run test:security` passou API/segurança/CRUD, mas o navegador inicialmente não existia no ambiente. `npm run test:stress` reproduziu os 500 e a recuperação antes de parar pela ausência de Chromium. Esse baseline está preservado em JSON.

O sandbox bloqueou sockets locais e downloads; os runners foram executados com a permissão necessária. Chromium e bibliotecas foram baixados/extraídos em `/tmp`, sem instalação no sistema. Uma rodada intermediária do E2E foi invalidada por reload do Vite durante geração de um arquivo de diagnóstico; a verificação final foi repetida sem arquivos sendo alterados e passou.

### Comandos

```bash
npm test
npm run test:security
npm run test:stress
node scripts/prisma-diagnostic.mjs
npm run build:demo
git diff --check
```

Neste ambiente, os dois runners com browser usam:

```bash
PLAYWRIGHT_BROWSERS_PATH=/tmp/frame-browsers \
LD_LIBRARY_PATH=/tmp/frame-browser-libs/extracted/usr/lib/x86_64-linux-gnu \
npm run test:stress
```

Aplique as mesmas duas variáveis a `npm run test:security`. Em ambiente comum, instale Chromium e dependências Playwright normalmente. O runner de segurança cria seu próprio SQLite e executa testes API/Node, dois cenários E2E e verificações de produção. `npm test` sozinho deixa integração condicional em skip; ela é efetivamente executada pelo runner de segurança.

`STRESS_CATALOG_ONLY=1` existe para diagnosticar apenas catálogo/navegador e identifica o resultado como `catalog-only`. **A evidência final é `mode: full`, `passed: true`**, sem esse atalho. Portas 5321/4181 (stress) e 5317/5174 (segurança). Nenhum teste exige reiniciar a API para recuperação da rajada; os reinícios do runner de segurança apenas isolam cenários diferentes.

### Resultado final dos comandos

- `npm run test:stress`: exit 0, modo completo, `passed: true`.
- `npm run test:security`: exit 0 na rodada final sem reload; uma suíte isolada de segurança passou, depois 11 testes Node/API passaram (a suíte anterior aparece como skip nessa segunda invocação), e os dois testes Playwright passaram em 16,4 s. Cookie Secure, HSTS e CSP de produção verificados.
- `npm run build:demo`: exit 0, catálogo estático de três projetos validado.
- `node scripts/prisma-diagnostic.mjs`: exit 0, reprodução intencional dos códigos anteriores em banco descartável.
- `git diff --check`: sem problemas.

### Escrita — baseline executado versus final

| Cenário | Req. / concorrência | 201 | 400 | 401 | 403 | 413 | 429 | 503 | 500 | P95 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Antes: moderado | 80 / 5 | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 53 ms |
| Antes: rajada | 300 / 30 | 22 | 0 | 0 | 0 | 0 | 262 | 0 | 16 | 5.067 ms |
| Depois: moderado | 80 / 5 | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 29 ms |
| Depois: rajada | 300 / 30 | 19 | 0 | 0 | 0 | 0 | 281 | 0 | 0 | 120 ms |
| Depois: lock externo de 6,5 s | 30 / 30 | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 0 | 1.029 ms |

A rajada original fornecida tinha 23/262/15 e P95 5.084 ms; a reprodução local variou para 22/262/16. O novo teto de escrita explica haver mais 429, sem contabilizar falhas reais como sucesso. No lock externo, o maior tempo foi cerca de 5 s (driver SQLite); o P95 é menor porque 29 rejeições ocorreram por fila cheia/expirada.

Persistência: **99 registros = 99 respostas 201** dos dois lotes; após 61 s, novo 201 → 100 registros. Sob lock externo, 30 respostas 503 → **zero novos registros**. Após liberar o lock, novo 201 → 101 registros. Exatamente um showreel após cada lote, as 12 seleções simultâneas e o rollback. A API respondeu 200 em leitura após a rajada e ao final, sem reinício.

Logs internos do lock: 13 `queue_full`, 16 `queue_timeout`, um `P1008/database_timeout`, todos status 503; duração, operação e endpoint presentes. A tentativa de selecionar ID inexistente registrou P2025 e respondeu 404, preservando o showreel anterior. Tentar segundo showreel diretamente no SQLite falhou por unicidade.

### Validação, autorização e consultas

No grupo de verificações complementares: 12 respostas 200 (seleções), uma 201 (recuperação de lock), **17 respostas 400**, **sete 401**, **uma 403**, **uma 404**, **uma 413**; zero 500. O par de categorias equivalentes foi verificado separadamente: uma 201 e uma 409. Login/primeira recuperação e leituras não estão somados nesse grupo.

Cobertura: URL local inválida, strings acima do máximo, campos desconhecidos, boolean/string/número incorretos, JSON de 40 KB; mutações sem autenticação; token válido sem sessão de Admin; origem incorreta; limit/page/sort/search inválidos, arrays de categoria, propriedades Prisma e parâmetros inexistentes. Rate limit/teste de spoof valida headers e Retry-After. Não há papel de usuário comum no schema; permissão é a associação persistida a Admin, não uma flag enviada pelo cliente.

Com 5.000 vídeos, **50 páginas de 100**, 5.000 IDs únicos e correspondência exata com a ordem do banco (`createdAt,id`). Primeira página repetida é idêntica. Busca/categoria/showreel são exercitados no backend; `limit=5000` retorna 400. Descrição de lista até 180, URL original e updatedAt ausentes. Gzip é negociado; identity e resposta pequena não são comprimidas.

### Catálogo e navegador

| Métrica | Antes, 5.000 (teste fornecido) | Depois, 1.000 | Depois, 5.000 |
| --- | ---: | ---: | ---: |
| API de listagem | 234 ms | 14 ms | 8 ms |
| JSON descomprimido | 5.809.724 bytes | 7.811 bytes | 7.835 bytes |
| Transferência gzip | não informada | 588 bytes | 596 bytes |
| Galeria | 2.534 ms | 453 ms | 426 ms |
| Elementos no DOM público | 75.259 | 623 | 623 |
| Cards públicos/painel | 5.000 / 5.000 | 24 / 24 | 24 / 24 |
| Busca única | 476 ms, local | 347 ms | 324 ms |
| Painel | 1.179 ms | 646 ms | 637 ms |
| Erros JavaScript | 0 | 0 | 0 |

Busca nova inclui debounce de 250 ms e consulta HTTP. Texto sintético muito repetitivo comprime excepcionalmente bem: não extrapolar a razão de gzip para conteúdo real. Tempos são amostras locais, não SLA. Imagens, fontes e players externos foram bloqueados no stress; o teste não mede reprodução real do YouTube. Modal abriu/fechou; edição recebeu a descrição integral; páginas substituíram cards. Overflow a 390 px foi verificado após busca; a suíte existente também cobre 320/375/768 px. Build da demo estática passou com seus três projetos.

## Alterações deliberadamente não realizadas

- Migração para PostgreSQL, alteração do banco real ou limpeza de dados: fora do escopo e desnecessárias para a carga suportada. A nova migration está pronta, mas só foi aplicada em bancos temporários.
- Retry automático: rejeição explícita é suficiente e evita retry storm/duplicação de criação após resultado ambíguo.
- Classificação genérica de P2028 como 503: esconderia bugs de transação expirada ou reutilizada.
- FTS, busca Unicode normalizada, cursor/snapshot e virtualização: a paginação real já limita payload/DOM; extensões exigem decisões de semântica e uso.
- Novo fetch/validador DNS SSRF: backend não busca URLs; não criar esse risco.
- Troca de autenticação, novo modelo de papéis, CORS aberto, aumento de timeout ou desativação de rate limit: nenhuma necessidade encontrada.

## Arquivos criados/modificados nesta implementação

- `README.md`
- `STRESS_REPORT.md`
- `STRESS_RESULTS.json`
- `docs/RESILIENCE.md`
- `docs/STRESS_BASELINE.json`
- `docs/PRISMA_DIAGNOSTIC.json`
- `scripts/prisma-diagnostic.mjs`
- `scripts/stress-check.mjs`
- `server/prisma/schema.prisma`
- `server/prisma/migrations/20260909000000_catalog_bounds/migration.sql`
- `server/src/main.ts`
- `server/src/prisma/prisma.module.ts`
- `server/src/prisma/write-gate.ts`
- `server/src/auth/auth.service.ts`
- `server/src/categories/categories.service.ts`
- `server/src/security/compression.ts`
- `server/src/security/database-errors.ts`
- `server/src/security/exceptions.filter.ts`
- `server/src/security/http.ts`
- `server/src/security/rate.guard.ts`
- `server/src/videos/video-query.dto.ts`
- `server/src/videos/videos.controller.ts`
- `server/src/videos/videos.service.ts`
- `src/App.tsx`
- `src/api.ts`
- `src/components/Admin.tsx`
- `src/styles.css`
- `tests/api.test.ts`
- `tests/browser/portfolio.spec.ts`
- `tests/security-api.test.ts`
- `tests/resilience.test.ts`

Além dessa lista, `package.json` já estava modificado antes do trabalho e foi preservado. Builds e screenshots são artefatos ignorados pelo Git; nenhum secret foi adicionado.
