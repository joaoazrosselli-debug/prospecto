# Prospecto — estúdio de sites

Aplicativo para organizar empresas locais, produzir páginas e acompanhar propostas. Preserva a identidade visual da primeira versão e o mesmo Site.

## Uso

- **Empresas:** cadastros de qualquer segmento, busca, CSV e edição dos contatos.
- **Produção:** novos modelos por segmento e três modelos anteriores preservados; criação no Lovable; briefing; catálogo com preços opcionais; logos, banners, fotos e vídeos; prompt editável por cliente; editor de HTML/CSS/JavaScript com rascunho e histórico; checklist e pedido de materiais.
- **Entrega:** ZIP com index.html e mídias, kit de briefing/prompt, e link de apresentação revogável por cliente.
- **Negócios e resultados:** preço do site, recebimentos e custos manuais, separados dos preços publicados pelo cliente. Sem gateway.
- **Equipe:** o administrador libera ou revoga e-mails dentro do aplicativo. Compartilhe o endereço; não há envio automático de convites.

## Dados e acesso

O servidor usa o D1 em `DB` para registros e o R2 em `BUCKET` para arquivos. As migrações Drizzle são aplicadas pela hospedagem antes da publicação. Os registros privados de clientes ficam no banco. O arquivo `data/pilot-curitiba.json` contém apenas pesquisas comerciais públicas preparadas para o piloto autorizado.

`PROSPECTO_OWNER_EMAIL` é configurado como segredo de runtime no Sites. O login é o Sign in with ChatGPT gerenciado pela plataforma. Todas as APIs privadas exigem identidade e verificam a lista de e-mails autorizados; somente o administrador pode gerenciar acesso. A página de entrada pode ser aberta por link. Isso não libera cadastros ou arquivos.

Os links `/p/<token>` são ativados explicitamente na produção de cada cliente. Eles mostram a página e suas mídias, sem expor o painel, notas, valores da negociação ou custos internos. Desativar o link bloqueia também as URLs de mídia dessa apresentação. O token é aleatório e não substitui o controle da equipe. HTML personalizado é isolado por sandbox e CSP. As páginas existentes continuam com JavaScript desativado. O editor permite ativar scripts locais explicitamente; na prévia e no link hospedado, eles recebem uma origem opaca, sem acesso ao painel, cookies ou armazenamento da aplicação. Conexões de rede, iframes, workers, formulários e scripts externos ficam bloqueados. Não adicione allow-same-origin ao sandbox.

A base antiga `prospecto.local.v1` é lida no mesmo navegador e origem e incorporada à nuvem após autenticação. Uma cópia anterior à migração é mantida localmente. Alterações pendentes também ficam em cache para recuperação. Edições em campos distintos são combinadas; conflitos no mesmo campo exigem uma escolha explícita. Outros dispositivos só veem registros depois da sincronização. O backup JSON inclui os cadastros, prompts e HTML aplicado; baixe o kit do cliente para copiar as mídias. Rascunhos e versões de código são exportados por cliente no Editor de código, em ZIP ou JSON. Eles ficam em tabelas próprias e não fazem parte do backup geral de cadastros.

Limites de upload: PNG/JPEG/WebP até 6 MB, MP4/WebM até 20 MB; 30 arquivos ou 100 MB por cliente. Logos SVG precisam ser exportadas para PNG. Materiais permanecem privados até a ativação do link do cliente. Domínios próprios são uma configuração separada.

## IA e pesquisa

A aba **Assistente IA** reúne pesquisas, fontes, pendências, hipóteses de oportunidade e qualificação humana. O Site declara a capacidade MCP e oferece `POST /mcp`. A publicação provisiona o plugin do Prospecto; o usuário precisa instalá-lo/conectá-lo na sua conta antes de usar as ferramentas no chat. A autorização por e-mail e a revogação da equipe valem também para o MCP.

O assistente pesquisa com as ferramentas web do chat e grava o resultado com `prospecto_upsert_researched_lead`. Pode consultar a base (`prospecto_workspace`, `prospecto_list_leads`, `prospecto_get_lead`), salvar uma proposta privada (`prospecto_save_draft`) e anexar PNG/JPEG/WebP com procedência (`prospecto_attach_media`). Não há ferramenta de envio, publicação, alteração financeira ou avanço da etapa comercial. Atualizações explícitas exigem revisão atual; cadastros repetidos são deduplicados. Páginas aprovadas ou com link ativo não podem ser substituídas pela IA.

Exemplo de pedido no chat, com o plugin conectado: “Pesquise até 10 comércios no Bairro Alto, Bacacheri e Colombo. Confira duplicatas, registre fontes e pendências e prepare até 3 páginas privadas. Não invente preços ou serviços, não envie mensagens e não publique.” Telefone comercial é separado de WhatsApp confirmado. Não localizar um site mantém a situação como não verificada.

O piloto `portfolio-demo-2026` reúne 10 fichas e 3 propostas com ilustrações conceituais próprias, sem fotos ou marcas apresentadas como oficiais. A variável de runtime `PROSPECTO_PILOT_BATCH=portfolio-demo-2026` incorpora esse lote uma única vez quando o administrador abre a base. O botão “Incorporar lote piloto” é uma alternativa manual, também restrita ao administrador. A importação é atômica, preserva registros existentes e mantém as propostas privadas, sem preços ou contato realizado. Fontes públicas podem estar desatualizadas; as pendências ficam visíveis para revisão.

Lotes pelo chat são executados por comando, com o assistente ativo. A busca do painel consulta o mapa aberto por ação explícita. Não há agendamento, execução recorrente ou API paga de IA conectada. A prévia imediata continua disponível pelos modelos. O prompt e o HTML permanecem editáveis por cliente.

O prompt padrão traz direção de arte, composição, tipografia, fotografia, conteúdo e critérios de revisão. `creative-direction.js` sugere rotas visuais por segmento, como proposta e não como marca oficial. As preferências continuam no campo `brandStyle`, compartilhado entre Conteúdo e Prompt. Salvar uma direção atualiza prompts gerados; textos personalizados existentes são preservados. “Montar versão com a ficha” leva as alterações ao editor para revisão. O pedido copiável para o chat identifica a ficha e instrui o assistente a salvar HTML próprio em privado, respeitando revisão atual e bloqueios de publicação. Não há execução de LLM disparada por esse botão. Os três modelos rápidos e os HTMLs existentes permanecem iguais; editar o prompt não redesenha uma página automaticamente. O marcador opcional `{{direcao_criativa}}` é acrescentado a templates do estúdio que ainda não o incluem. Prompts personalizados por cliente são devolvidos literalmente.

## Editor de código

Em **Produção → Editor de código**, os arquivos `index.html`, `styles.css` e `script.js` podem ser editados com linhas numeradas, importados, formatados com Prettier local e exportados. A formatação pode ser desfeita antes de outras alterações no arquivo; ela não aplica código à página. O formatador é carregado só quando usado e seus arquivos são copiados do pacote instalado durante dev/build. A execução da prévia é explícita; scripts começam desligados ao carregar o editor. Há console de erros e troca de largura de visualização. O exemplo de CSS acrescenta estados de hover e foco à navegação; pode ser ajustado livremente.

**Salvar versão** grava o rascunho compartilhado e uma versão imutável em uma transação. **Aplicar à página** é separado, exige as revisões atuais do rascunho e da ficha, preserva valores comerciais e guarda a página anterior. Páginas aprovadas ou com link ativo precisam ser colocadas em revisão e descompartilhadas antes da aplicação. Restaurar uma versão carrega o editor; não altera a página automaticamente. Alterações de HTML feitas pela API de registros ou pelo MCP também guardam a página anterior. Versões não são apagadas automaticamente.

As tabelas `studio_code_drafts` e `studio_page_versions` usam a mesma autorização da equipe. `prospecto_get_code` consulta arquivos e histórico; `prospecto_save_code` grava apenas rascunho. O MCP não oferece ação para aplicar ou publicar código. Edições simultâneas no rascunho recebem conflito em vez de sobrescrever silenciosamente. Uma cópia local recuperável auxilia em interrupções, sem substituir o banco compartilhado.

O ZIP contém HTML, CSS, JS, `prospecto-source.json` e as mídias. O JSON de uma versão pode ser importado novamente. URLs e bibliotecas externas incluídas em códigos importados precisam ser avaliadas na hospedagem final. Este editor não executa Java no servidor, código de backend, Node ou aplicações com build: ele manipula a página HTML/CSS/JavaScript do cliente.

## Plano e revisão de entrega

Em **Produção → Plano e revisão**, a equipe encontra o plano de trabalho por cliente, direção criativa, materiais pendentes e um pedido completo copiável para executar no chat conectado. O pedido usa `prospecto_save_code`: prepara uma versão sem substituir o HTML aplicado. Prompts personalizados continuam preservados. A ferramenta somente de leitura `prospecto_prepare_production` entrega o mesmo plano e análise ao assistente.

O servidor usa parse5 para analisar o documento salvo: idioma, viewport, título, conteúdo principal, IDs e âncoras, contato compatível com a ficha, atributos alt, caminhos do kit, scripts e recursos bloqueados. As verificações de CSS são indícios declarados de responsividade, hover, foco e menos movimento. A análise não executa JavaScript, não abre links externos, não mede contraste, aparência ou desempenho e nunca declara teste visual automático.

Rascunho e página aplicada são analisados separadamente. A conferência da equipe é uma declaração explícita do que foi verificado em 360/768/1440 px, teclado, contato, conteúdo, mídias e contraste. Pode ser salva parcialmente. O registro guarda o relatório e um SHA-256 dos arquivos, dos dados públicos e dos metadados das mídias. A interface descarta as marcações visuais anteriores quando esse conteúdo muda e apresenta o registro anterior como desatualizado. Valores comerciais internos não compõem a impressão digital. Salvar conferência não aprova o cliente, não aplica o código e não publica.

As conferências ficam em `studio_delivery_reviews`, com o mesmo acesso da equipe. O botão **Baixar relatório interno** exporta o estado consultado e a última conferência em JSON; a exportação é interna, com observações da equipe. Essas conferências, assim como os rascunhos e versões de código, não fazem parte do backup geral de cadastros.

As referências de Impeccable 4.8.0 foram baixadas e usadas para orientar o fluxo de design. A skill pessoal **Prospecto — design e entrega** reúne uma adaptação específica para o ambiente e duas referências licenciadas do Impeccable. O plugin integral do Impeccable não foi instalado. Não há Figma obrigatório, dependência de scripts externos nas páginas ou API paga de LLM conectada. `PRODUCT.md` e `DESIGN.md` documentam o produto e o sistema visual existente.

## Desenvolvimento e validação

Use o workflow do plugin Sites com a identidade de `.openai/hosting.json`. O frontend original foi portado para `studio.html` e `public/`; as rotas usam o starter Vinext mantido pelo Sites.

- Gerar migrações: `npm run db:generate`.
- Gerar build: helper `scripts/build-site.mjs` do plugin Sites.
- Tipos: `node node_modules/typescript/bin/tsc --noEmit`.
- Prompts, direção criativa, privacidade e preservação de instruções: `node tests/prompt-authoring.mjs`.
- Migração, offline e conflitos: `node tests/shared-store.mjs`.
- Editor, histórico, concorrência, recuperação e isolamento: `node tests/code-editor.mjs` (depois do build).
- Plano e revisão, impressão digital, conflitos, privacidade e análise estrutural: `node tests/production-review.mjs` (depois do build).
- APIs reais com D1/R2 temporários: `node tests/integration.mjs` (depois do build).
- MCP, permissões, deduplicação em paralelo, materiais e piloto: `node tests/mcp-integration.mjs` (depois do build).
- QA visual: `node tests/browser-fixture.mjs` cria `public/qa.html` com dados e respostas fictícias. **Remova esse arquivo antes do build final.** A fixture não modifica a autenticação da aplicação nem usa o banco de produção.

A prévia do aplicativo não substitui a aprovação do responsável pelos textos, preços e materiais do cliente.

### Testes de loja e preparação comercial

A área **Prospecção** permite criar a loja fictícia **Jzincu Fitness**. A criação é idempotente: abrir novamente preserva conteúdo, arquivos e edições. A ficha fica na base compartilhada com `isTest: true`, fora do funil real, das métricas e das primeiras abordagens. O servidor preserva esse marcador e impede o link público; contatos pessoais usados no teste continuam privados. Nome, telefone comercial e e-mail do responsável são opcionais e não são gravados no código-fonte do aplicativo.

A fila de primeiras conversas usa qualificação, WhatsApp confirmado, permissão com origem e número correspondente, recusa compartilhada por número e deduplicação. Um número alterado não herda uma permissão antiga; outro cadastro no mesmo número não recebe uma segunda primeira abordagem depois que um contato foi registrado. Abrir o WhatsApp ou baixar o lote não registra envio nem muda a negociação. O registro de envio é uma declaração explícita da equipe. As opções de apresentação como estudante ou profissional ficam em Configurações.

`GET /api/outreach` e `prospecto_prepare_outreach` são somente preparação. `POST /api/ai/test-store` e `prospecto_create_test_business` criam o cenário de teste sem pesquisar uma empresa real. Não há provedor de mensagens, agendamento, webhook de entrega, chave de modelo ou cobrança de API conectados. Para enviar por WhatsApp Business Platform futuramente serão necessários consentimento apropriado, conta/número, templates aplicáveis e integração de status do provedor. Um telefone público não autoriza automaticamente mensagens.

Verificações adicionais: `node tests/outreach.mjs` e, após build, `node tests/test-store-integration.mjs`. As fixtures temporárias `public/qa*` devem ser removidas antes da publicação; não são clientes nem arquivos de produção.


### Revisão interna, materiais privados e lixeira

**Baixar lote para revisão** exporta todos os cadastros ativos da base compartilhada, incluindo pendências e lojas de teste, mesmo quando não há contatos prontos. O arquivo identifica o teste e os motivos de bloqueio; não contém valores financeiros nem notas internas e não altera permissões, etapas ou envios.

**Copiar link de revisão** abre a empresa correta em Produção usando `?revisar=<id>#producao`. É um link do painel, restrito às contas da equipe; a entrada com ChatGPT mantém o destino. Isso é separado da apresentação pública, que continua indisponível para testes.

As prévias do painel e do Editor de código carregam materiais pelo contexto autenticado do painel e os inserem temporariamente como dados na página isolada. O código salvo e o ZIP continuam usando os caminhos originais. Não há arquivos tornados públicos, acesso a credenciais pelo código do cliente ou `allow-same-origin`. Arquivos ausentes ou inacessíveis mostram uma mensagem de erro na prévia.

A lixeirinha nos cartões move cadastros para a lixeira compartilhada e desativa seus links públicos. Restaurar mantém arquivos, conteúdo, versões e valores, sem reativar a apresentação. Recebimentos históricos permanecem em Resultados. Cadastros na lixeira não entram nas listas ativas ou na prospecção; recusas e contatos anteriores continuam impedindo uma nova primeira abordagem ao mesmo número. Não há exclusão permanente neste fluxo.

Regressões: `node tests/review-access.mjs` e, após build, `node tests/review-trash-integration.mjs`. A fixture `tests/private-media-browser-mock.js` permite conferir no navegador a mídia autenticada dentro da sandbox, sem autenticar o iframe nem alterar dados de produção.

## Busca de empresas e Lovable

![Busca por segmento e região](docs/images/discovery-workflow.jpg)

Exemplo da interface com empresas fictícias, usado na revisão do fluxo.

A aba **Buscar empresas** consulta o OpenStreetMap em qualquer região do Brasil: localize cidade ou bairro, escolha o ponto no mapa, segmento, raio de 0,5 a 20 km e até 50 resultados. Os atalhos de Curitiba continuam disponíveis. O mapa interativo usa OpenLayers em Canvas 2D e OpenFreeMap; marcadores abrem os detalhes da empresa. A localização por Photon é manual, com cache de sete dias, intervalo de cinco segundos e até 100 consultas diárias por equipe. Não há garantia de cobertura completa. A fonte Overpass é a instância Private.coffee, que permite este uso; consultas são acionadas pelo usuário, limitadas a 40 por dia no espaço e reaproveitadas por 15 minutos. Falhas da fonte não apagam resultados anteriores nem criam registros. Lotes ficam disponíveis por 24 horas e são limpos nas próximas pesquisas. Não há busca agendada.

**Ver detalhes** mostra contatos e fontes. **Consultar contatos no site** acessa somente a página informada, com limite de tamanho, tempo e redirecionamentos, para extrair descrição e links de contato. Uma rede informada no mapa não é apresentada como vinculada ao site. Telefone não presume WhatsApp. Cidade sem marcação específica na fonte permanece como pendência. Não localizar um site na fonte mantém `websiteStatus=unknown`.

**Adicionar a Empresas** é uma ação separada: importa somente uma empresa de um lote válido do servidor, com origem e licença ODbL, na etapa Nova oportunidade. Duplicatas, inclusive simultâneas e na lixeira, retornam o cadastro existente sem sobrescrever dados, prompts, páginas ou valores. Após importar, **Abrir ficha em Empresas** abre o cadastro preenchido; **Salvar e preparar o site** segue para a produção. A exportação CSV preserva a fonte e inclui atribuição/licença do OSM. Veja o [guia do mapa e suas limitações](docs/MAPA-E-DESCOBERTA.md).

Avaliações do Google são opcionais: configure `GOOGLE_PLACES_API_KEY` como segredo de runtime na hospedagem e publique a versão com esse ambiente. A chave precisa da Places API (New) habilitada e faturamento próprio. O servidor usa máscara de campos limitada e permite até 20 consultas ao vivo por dia no espaço. São exibidas possíveis correspondências para conferência; nota, contagem, endereço e atribuição do Google não são gravados em lotes, CRM, backups ou prompts. O recurso não foi validado com uma chave de produção. Os caminhos `/privacidade.html` e `/termos.html` descrevem as fontes e o tratamento dos dados.

Em **Produção → Criar no Lovable**, escolha site de apresentação, catálogo ou cardápio, prepare e edite um prompt próprio e abra `https://lovable.dev/#prompt=...`. Esse botão preenche o editor externo; a geração é confirmada na conta Lovable e usa seus créditos. Os arquivos privados precisam ser anexados pelo kit; não são colocados em URLs públicas pelo botão. O código React/TypeScript produzido no Lovable não é importado automaticamente no editor HTML do Prospecto. Os links do projeto e da apresentação ficam na ficha; a revisão do link é explícita e se invalida ao trocar o endereço. Uma prévia interna `id-preview--` não pode ser marcada como apresentação pronta para o cliente.

O plugin do Prospecto oferece `prospecto_locate_region`, `prospecto_search_businesses` (centro/raio ou atalhos), `prospecto_import_discovered_business` e `prospecto_save_builder_brief`. Esta última ação grava somente prompt, tipo e links com revisão atual. Não aplica HTML nem publica, confirma revisão ou envia mensagens. O Lovable conectado no chat pode criar o projeto; a integração por link do painel não depende dessa conexão e não representa autorização de execução em segundo plano.

Novos cadastros usam `pageTemplate=studio`: composições próprias para alimentação, catálogo e serviços, com tipografia incorporada, estados de hover/foco e navegação que funciona sem JavaScript. Modelos anteriores e HTML personalizado são preservados; uma ficha existente pode escolher **Novo modelo por segmento**. Os três modelos são bases de apresentação, não um LLM executado ao salvar cores ou prompt. A personalização por IA é feita pelo chat conectado ou no Lovable.
