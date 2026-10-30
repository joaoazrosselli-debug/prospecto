# Buscar empresas pelo mapa

## Uso pela equipe

1. Abra **Buscar empresas**. Essa tela pesquisa uma fonte externa; a busca em **Empresas** filtra o catálogo que a equipe já cadastrou.
2. Digite cidade, bairro e estado, por exemplo **Macapá, AP** ou **Bairro Alto, Curitiba**. Clique em **Localizar região** e escolha o resultado correto. Nomes iguais podem existir em estados diferentes.
3. Escolha tipo de comércio, raio entre **0,5 e 20 km** e quantidade máxima de **5, 10, 20 ou 50**. O filtro de telefone pode ser desmarcado para ampliar os resultados.
4. Clique em **Buscar empresas**. Os marcadores numerados correspondem às empresas da lista. O círculo mostra o raio; ele não representa a fronteira administrativa de um bairro ou município.
5. Para navegar, arraste e aproxime o mapa. Clique em um ponto para mudar o centro ou use **Buscar nesta área** para pesquisar ao redor do centro visível. Arrastar não faz consultas de empresas automaticamente.
6. Clique em um marcador ou em **Ver detalhes**. Confira site, telefone, WhatsApp, redes, descrição, horários, fotos indicadas e fonte. **Consultar contatos no site** procura links publicados no site informado. Faça essa conferência antes de adicionar, quando necessário.
7. **Adicionar a Empresas** copia os dados encontrados para a base compartilhada. **Abrir ficha em Empresas** abre o cadastro preenchido. **Salvar e preparar o site** segue para a produção e o briefing.

Repetir a importação retorna a empresa existente e preserva edições, páginas e valores da equipe. Uma empresa já arquivada é direcionada à lixeira, sem restauração automática. Uma ficha nova começa como oportunidade, sem publicação, autorização de envio ou valores de negociação.

## O que as fontes oferecem

- OpenStreetMap fornece cadastros comunitários. A cobertura, os telefones, as redes e os horários variam; nenhum resultado garante que a empresa está em atividade.
- Não encontrar um site significa **site não localizado na fonte**, não ausência confirmada de site.
- Um telefone comercial não é presumido como WhatsApp.
- As avaliações e as fotos do Google podem ser consultadas pelo atalho **Ver fotos e avaliações no Google Maps**. A nota dentro do aplicativo depende da configuração separada da Places API.
- Uma foto indicada na fonte é uma referência, não uma autorização para reutilizá-la. Ela não é baixada nem anexada automaticamente ao site do cliente.
- A busca entrega uma amostra limitada da área. Não é uma varredura de todas as empresas do Brasil.

## Implementação e limites

O mapa usa **OpenLayers 10.11.0**, **ol-mapbox-style 13.8.0** e o mapa base **OpenFreeMap**. A renderização é Canvas 2D, sem exigir WebGL. A posição e o mapa são reutilizados durante a edição dos filtros e a abertura de detalhes.

O módulo de entrada é `maps/engine.js`; `scripts/build-maps.mjs` produz `public/vendor/maps/engine.js`, CSS e avisos de licença a partir das dependências fixadas no lockfile. `npm run dev` e `npm run build` executam essa preparação automaticamente. Os arquivos gerados não devem ser editados manualmente.

A localização digitada usa Photon apenas por ação explícita, com cache de sete dias, cota compartilhada de 100 consultas por dia e intervalo de cinco segundos. O serviço público não tem garantia de disponibilidade. `PROSPECTO_GEOCODER_URL` pode apontar para uma instância própria compatível com Photon, via HTTPS. Não há autocomplete de rede, geolocalização do dispositivo ou varredura recorrente.

A pesquisa de empresas continua no Overpass da Private.coffee: 40 consultas por dia no espaço, intervalo de quinze segundos, cache de quinze minutos e lotes com validade de 24 horas. Resultados anteriores são mantidos na interface quando uma fonte falha. As coordenadas disponíveis e as referências de origem são preservadas na importação.

A migração `0005_discovery_locations.sql` acrescenta somente a tabela de cache da localização; os cadastros existentes não são reescritos. As APIs continuam autenticadas e protegidas por origem. O MCP oferece `prospecto_locate_region`, pesquisa por centro/raio e a importação existente.

Google Maps não está embutido como provedor de mapa nesta entrega. Uma integração completa exige conta do responsável, APIs e faturamento próprios. Não há chave, assinatura ou cobrança nova ativada. Conteúdo da Places API continua ao vivo, sem ser copiado para o CRM; não deve ser misturado aos marcadores do mapa aberto.

## Verificações

- `node tests/discovery-national.mjs`: geometria, UF, limites espaciais, Equador e normalização.
- Após build, `node tests/discovery-national-integration.mjs`: localização, cache, cotas, falhas da fonte, autenticação, importação e MCP com banco temporário.
- `node tests/discovery-integration.mjs`: compatibilidade das buscas anteriores, contatos e duplicatas.
- Revisão no navegador com `tests/browser-fixture.mjs`, exclusivamente com empresas fictícias. Remover `public/qa.html` antes do build publicado.

## Referências técnicas

- https://openfreemap.org/quick_start/
- https://github.com/openlayers/openlayers
- https://github.com/openlayers/ol-mapbox-style
- https://github.com/komoot/photon
- https://overpass.private.coffee/
- https://www.openstreetmap.org/copyright
- https://developers.google.com/maps/documentation/javascript/get-api-key
- https://developers.google.com/maps/documentation/places/web-service/policies
