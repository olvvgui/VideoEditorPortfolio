# FRAME: limites e operação

## Contrato HTTP

- `GET /api/videos?page=1&limit=24&search=...&category=Comercial&showreel=true&sort=newest`: público. Retorna `{items,total,page,limit,hasNext}`. `limit` entre 1 e 100, página entre 1 e 100.000, termo de busca até 100 caracteres e categoria até 40. Acima do limite: 400, sem executar consulta. Não existe opção para listar tudo.
- Ordenação: `newest` (padrão) ou `oldest`, sempre por `createdAt` e depois `id` na mesma direção. Empates de timestamp não tornam a ordem aleatória. Os seis parâmetros acima são os únicos aceitos; arrays, propriedades Prisma, `type`/`project` inexistentes e ordenações arbitrárias são rejeitados. Neste produto, cada vídeo é um projeto e o tipo editorial é a categoria.
- `items`: `id,title,description,videoId,category,isShowreel`. A descrição é uma prévia de até 180 caracteres; não inclui URL original, datas internas ou `updatedAt`.
- `GET /api/videos/:id`: detalhe público, com descrição integral e URL. `GET /api/videos/featured`: showreel ou, se nenhum estiver marcado, vídeo mais recente; `null` quando vazio. O destaque independe dos filtros/página da galeria.
- `POST /api/videos`, `PUT/DELETE /api/videos/:id`, `POST /api/categories`, `DELETE /api/categories/:id`, `GET /api/auth/me`: guard global exige sessão persistida associada a `Admin`. Não há modelo de usuário comum nem papéis adicionais. Um JWT válido sem sessão de Admin não concede permissão.
- `GET /api/categories`: vocabulário público. Novas categorias são admitidas somente enquanto houver menos de 100; a verificação ocorre na mesma transação da criação. O limite não apaga nem esconde categorias legadas já existentes. Categorias padrão e categorias em uso não podem ser removidas.
- Login público: `POST /api/auth/login`; logout público e idempotente: `POST /api/auth/logout` (apenas revoga a própria sessão apresentada).

A paginação por número permite anterior/próxima e troca direta de página com alteração pequena no contrato existente. A navegação é estável para catálogo sem mudanças; inserções/exclusões entre páginas podem deslocar offsets. Para exportação com snapshot ou feeds sob mudanças frequentes, adotar cursor/snapshot em uma evolução específica. A listagem e seu total são lidos na mesma transação.

A busca usa `contains` em título, descrição e categoria, com `where` construído explicitamente. O SQLite faz comparação sem distinguir caixa para ASCII; não oferece o mesmo case folding Unicode de `toLocaleLowerCase("pt-BR")` do navegador antigo. Não foi introduzido FTS nem índice B-tree de descrição: esse índice não aceleraria busca por substring. Para catálogos muito maiores, avaliar busca normalizada/FTS com testes linguísticos e de relevância.

## Admissão de escrita e erros

Um processo NestJS suporta **um escritor ativo**, **16 em espera**, **1.000 ms de espera na fila**. Fila cheia/expirada ou shutdown retorna 503 com `Retry-After: 1`. O limite por IP continua produzindo 429. Não há retry automático no servidor ou formulário; o usuário pode tentar novamente. Não reenvie uma criação automaticamente após uma falha de rede de resultado ambíguo: este contrato não inclui chave de idempotência.

Vídeos, categorias e sessões usam `PrismaService.write`, que envolve toda a operação em transação. A consulta de categoria também está dentro dela. A liberação ocorre em `finally`, somente quando a transação termina; nenhum `Promise.race` libera o escritor enquanto o banco ainda trabalha. Aquisição Prisma: 1.000 ms; callback transacional: 3.000 ms (menores que os padrões anteriores). Não há chamadas remotas no callback. O timeout nativo de bloqueio SQLite não foi aumentado: na contenção externa medida, a requisição ativa levou cerca de 5 segundos. O timeout do callback não é um SLA de 3 segundos para todo o driver; a fila tem seu próprio prazo independente.

No shutdown, fecha-se a admissão, rejeitam-se os aguardantes, aguarda-se a transação ativa e só depois desconecta-se Prisma. A fila tem encerramento idempotente. Os testes cobrem liberação após exceção, expiração, limite, rejeição durante shutdown e drenagem. O supervisor de produção deve conceder pelo menos 15 segundos de grace period antes de interromper o processo.

Classificação conservadora:

| Erro | Resposta | Razão |
| --- | --- | --- |
| `P1008` / `P2024` | 503 | timeout de operação/pool |
| `P2034` | 503 | conflito de escrita/deadlock |
| `P2028` com metadata exatamente `Unable to start a transaction in the given time.` | 503 | falha de aquisição |
| Outros `P2028`, inclusive transação expirada/fechada | 500 | pode indicar callback lento, mau uso ou bug; exige investigação |
| `P2002` / `P2003` | 409 | unicidade/referência, sem retry |
| `P2025` | 404 | registro inexistente |
| Schema inválido, corrupção, validação interna Prisma, exceções desconhecidas | 500 sanitizado | não ocultar falhas reais |

O diagnóstico sem fila reproduziu `P1008` e `P2028` por commit em transação expirada. O novo teste de bloqueio externo comprova `P1008` → 503. Não é possível recuperar retrospectivamente os códigos específicos dos logs antigos, que registravam apenas o nome da classe.

O filtro registra JSON com `requestId`, código Prisma original, operação, duração incluindo fila, motivo classificado, flag transitória, template de endpoint e status final. Erros não são substituídos antes de chegar ao filtro. Não são serializados `message`, `meta`, stack, query, SQL, parâmetros, headers, cookies, URL com query, corpo, e-mail ou conexão. A classificação pode inspecionar um campo textual de metadata, mas não o registra. O cliente recebe somente status, nome HTTP, mensagem sanitizada e, em erros 5xx, identificador de correlação. Parsers retornam o mesmo conjunto básico de campos.

## Consistência e índices

A seleção desmarca o anterior e marca o novo na mesma transação; falha em qualquer etapa faz rollback. A migração `20260909000000_catalog_bounds` acrescenta um índice único parcial `Video_single_showreel WHERE isShowreel=1`, reforçando a regra também contra escritores fora do processo. Garante **no máximo um**. Após uma seleção bem-sucedida em catálogo não vazio, há exatamente um. Mantém-se a possibilidade funcional anterior de desmarcar explicitamente o showreel; o destaque usa o mais recente nesse caso. Ao excluir o selecionado, o próximo é selecionado na mesma transação.

Índices novos:

- `(createdAt,id)`: ordem determinística das páginas e escolha do próximo destaque.
- `(category,createdAt,id)`: igualdade por categoria seguida da ordem da página; também ajuda a checagem de vídeos em uso por categoria.
- Único parcial de showreel: regra de integridade e busca do selecionado, sem um índice booleano completo redundante.

A migração falha se já houver duplicidade de showreel; não reescreve nem remove registros silenciosamente. Deve ser revisada e aplicada pelo processo normal de deploy após backup. **Não foi executada no banco real nesta tarefa.** Use migrations; o índice parcial é mantido no SQL, pois não está representado pelo schema Prisma 6.19.

## Rate limit e reverse proxy

Políticas em memória, por processo e por `req.ip` calculado pelo Express:

- 120/minuto por handler;
- 120/minuto agregado entre todos os handlers;
- 100/minuto agregado para métodos de escrita, inclusive categorias, exclusões, edições e logout;
- login tem adicionalmente 5/minuto por IP.

Os headers `X-RateLimit-Limit/Remaining/Reset` e suas variantes `-write`/`-aggregate` mostram a política. Em qualquer 429 existe também `Retry-After` padrão, inclusive quando quem bloqueou foi uma política nomeada. NAT compartilha os limites por IP; isso é adequado ao portfólio de um editor, mas precisa ser revisto para muitas pessoas em uma rede.

`TRUST_PROXY` vazio significa conexão direta: `X-Forwarded-For` não altera a identidade. Para proxy local exclusivo, configure IPs exatos, por exemplo `127.0.0.1,::1`, **somente se esses forem os peers efetivos**. Para containers, use o IP/rede restrita real do proxy. Não use `true`, contagem de hops, `0.0.0.0/0`, `::/0` ou redes que incluam clientes não confiáveis. Restrinja a porta da API por firewall/rede ao proxy. Exemplo de cabeçalhos no único proxy Nginx de borda:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
client_max_body_size 32k;
```

A borda deve sobrescrever o header recebido do cliente. Cadeias de proxies requerem lista explícita de peers confiáveis. Os testes HTTP confirmam que variar `X-Forwarded-For` com trust desativado não contorna o limite agregado. Não foi testado um proxy externo real; valide a topologia no deploy.

## URLs, produção e compressão

O backend **não faz fetch**, resolução DNS, download, metadata lookup nem segue redirects de URLs cadastradas. Apenas valida hosts YouTube permitidos e extrai o ID. O navegador monta thumbnail em `i.ytimg.com` e player em `youtube-nocookie.com`; não usa um hostname arbitrário do cadastro. Portanto, não há fluxo SSRF a proteger por resolução DNS. Não adicionar fetch sem uma nova revisão de SSRF.

Permanecem: whitelist com rejeição de propriedades desconhecidas, DTOs com limites (título 120, descrição 5.000, URL 2.048, categoria 40, login 254/72 bytes), boolean estrito, parsing JSON de até 32 KB, rejeição de body comprimido e tipos inválidos. Não há upload de vídeo nem cadastro público de contas.

Produção usa mesma origem para SPA/API, sem habilitar CORS. Escritas exigem `Origin` exatamente igual a `FRONTEND_ORIGIN`; produção exige HTTPS. Cookies HttpOnly, Secure em produção, SameSite Strict e sessão persistida. Métodos são delimitados pelos controllers; requisições inseguras ainda passam pela política de origem/conteúdo. Helmet conserva CSP compatível com YouTube, `frame-ancestors 'none'`, X-Frame-Options, nosniff, Referrer-Policy e HSTS; oculta X-Powered-By. O painel HTML não é segredo: cada operação sensível é protegida na API.

Não foi encontrada configuração de proxy garantindo compressão neste repositório. O backend fornece gzip nível 4 para **GET público de listagem de vídeos**, JSON 200 acima de 1.024 bytes e somente se o cliente aceitar gzip. Não comprime autenticação, erros, detalhes, respostas com Set-Cookie, arquivos de mídia nem pequenas respostas. Usa `Vary: Accept-Encoding`; não mistura tokens/segredos com texto refletido. Um proxy pode assumir compressão de assets estáticos e deve respeitar Content-Encoding para evitar recompressão. A redução principal é a paginação/seleção de campos.

## Limites restantes e PostgreSQL

SQLite continua apropriado para esta implantação de uma instância e escrita administrativa modesta. O teste não é SLA nem prova de resistência a DDoS distribuído. Limitação de conexão/body/rate também deve existir na borda; o limiter em memória não compartilha contadores entre processos, e mudanças de IP podem distribuí-los. Retenção e rotação dos logs são responsabilidade da operação.

PostgreSQL passa a ser recomendado antes de múltiplas instâncias, vários editores escrevendo frequentemente ou maior necessidade de throughput. Nessa mudança, adotar rate limit compartilhado e revisar índices/migrations. Não houve migração automática, WAL imposto, aumento de timeout, desativação de limiter ou alteração de credenciais. Não há garantia de consistência entre processos para todas as regras de categoria baseadas em nome; a implantação suportada continua sendo um processo escritor. O índice de showreel atua no banco independentemente disso.

Referências primárias consultadas: [erros Prisma](https://docs.prisma.io/docs/orm/reference/error-reference), [índices parciais SQLite](https://www.sqlite.org/partialindex.html), [códigos SQLite](https://www.sqlite.org/rescode.html). A implementação do Throttler 6.4 foi auditada diretamente em `node_modules/@nestjs/throttler/dist/throttler.guard.js`; a classificação foi validada contra o Prisma 6.19 instalado, sem migração de versão.
