# Mapa do código

| Área | Arquivos | Responsabilidade |
| --- | --- | --- |
| Interface | `studio.html`, `public/app.js`, `public/style.css`, `public/studio-v2.css` | Navegação, cadastros e organização visual |
| Regras e sincronização | `public/core.js`, `public/shared.js`, `public/sync-conflict.js` | Normalização, sincronização e resolução de conflitos |
| Produção e editor | `public/production.js`, `public/source-editor.js`, `public/site-prompt.js` | Briefing, código editável e prompts |
| Rotas | `app/api/[...path]/route.ts`, `app/mcp/route.ts`, `app/p/[...path]/route.ts` | Entrada de APIs, ferramentas e apresentações |
| Autorização | `lib/studio-auth.ts`, `app/chatgpt-auth.ts` | Identidade e autorização por equipe |
| Dados | `db/`, `drizzle/`, `lib/studio-records.ts` | Esquema e acesso a registros |
| Pesquisa e IA | `lib/studio-discovery.ts`, `lib/prospecto-agent.ts` | Fontes externas e ferramentas MCP |
| Revisão | `lib/delivery-audit.ts`, `lib/studio-production.ts` | Conferência estrutural e registro de revisão |
| Testes | `tests/` | Casos de regras, concorrência, acesso e isolamento |

O frontend consulta APIs privadas. As APIs verificam a identidade e o acesso antes de ler D1 ou R2. Páginas de apresentação usam um token revogável e não liberam o painel. HTML do cliente é exibido em sandbox com uma política de conteúdo restritiva.

A versão pública é uma cópia independente do código. Não existe workflow de publicação no Site privado, credencial de implantação ou ligação automática entre um pull request e a operação em uso.
