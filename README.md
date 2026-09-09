# FRAME® — Seu trabalho merece ser visto.

Um portfólio de vídeos com identidade, movimento e espaço para o que importa: o seu olhar como editor.

FRAME reúne apresentação pessoal, projetos e contato em uma experiência visual pensada para editores de vídeo, profissionais do audiovisual e pequenos estúdios. Um lugar para mostrar seu estilo, apresentar seus serviços e facilitar o próximo contato profissional.

**Portfólio audiovisual · Showreel em destaque · Gestão de projetos · Mobile e desktop**

## Uma primeira impressão com a sua assinatura

A apresentação começa pelo seu trabalho. O showreel escolhido pelo editor ocupa o destaque da página e pode ser aberto tanto pelo botão principal quanto pelo filme de capa.

A identidade visual combina preto, branco e cinza com acentos em vermelho e azul, cantos arredondados e animações de navegação. Seções amplas dão espaço ao conteúdo, enquanto a marca acompanha a rolagem em uma dock no topo.

## Do primeiro play ao próximo projeto

- **Vídeos em primeiro plano.** Galeria com thumbnails do YouTube, títulos e descrições para contextualizar cada trabalho.
- **Navegação por interesse.** Categorias e busca ajudam visitantes a encontrar projetos alinhados ao que procuram.
- **Play sem sair do portfólio.** Os vídeos abrem em um modal integrado à página.
- **Contato sempre à mão.** Uma dock fixa mantém WhatsApp, e-mail e redes sociais acessíveis durante a navegação.
- **Experiência em diferentes telas.** O layout se adapta ao celular e ao desktop, da apresentação à galeria.

## Um portfólio que acompanha sua evolução

Novos trabalhos não precisam esperar por uma alteração no código. O painel administrativo permite cadastrar, editar e excluir projetos, criar categorias além das opções iniciais e escolher qual vídeo será o showreel.

Basta informar o link do YouTube, adicionar título e descrição e selecionar a categoria. Links tradicionais, curtos e de Shorts são aceitos, com prévia da thumbnail no formulário.

O resultado é liberdade para atualizar sua seleção de trabalhos conforme seu estilo, seus serviços e seus objetivos mudam.

## Seu jeito de se apresentar. Seu jeito de conversar.

FRAME oferece espaço para apresentar quem está por trás dos vídeos e os serviços que compõem seu trabalho — como edição, color grading e sound design.

Os contatos são configuráveis para diferentes contextos. O WhatsApp aceita número com mensagem inicial ou um link personalizado; o e-mail pode abrir uma nova mensagem ou direcionar para uma página de contato. Redes sociais são opcionais e aparecem apenas quando configuradas.

## Para quem cria histórias em vídeo

Pensado para editores freelancers que precisam de uma presença própria, profissionais que querem organizar trabalhos de diferentes formatos e pequenos estúdios que buscam reunir apresentação e portfólio em um só endereço.

Os projetos de demonstração ilustram as possibilidades do layout. A seleção final, os vídeos e a identidade do conteúdo ficam por conta de quem faz o portfólio acontecer.

## Tecnologia por trás da experiência

Interface construída com **React, TypeScript e Tailwind CSS**, conectada a uma API **NestJS**, com **Prisma e SQLite** para persistência dos projetos. Os vídeos são incorporados pelo YouTube, e a gestão acontece em uma área administrativa com autenticação e controle de sessão.

**FRAME® — Um espaço para apresentar o que você cria e abrir a conversa sobre o que vem a seguir.**

## Resiliência e catálogo paginado

A API de vídeos usa páginas de 24 itens (máximo 100), busca no servidor e detalhes separados. Galeria e painel navegam sem acumular cards. Escritas SQLite passam por fila limitada; saturação retorna 429/503 com `Retry-After`.

Consulte [limites e operação](docs/RESILIENCE.md) para o contrato da API, configuração segura do proxy, logs, compressão, migração do índice único de showreel e limites de SQLite. O [relatório de validação](STRESS_REPORT.md) registra métricas e comandos. `npm run test:stress` usa exclusivamente um banco temporário; `node scripts/prisma-diagnostic.mjs` reproduz o padrão transacional anterior sem alterar o banco do projeto.
