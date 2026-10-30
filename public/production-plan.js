import { creativeDirection } from './creative-direction.js';
import { whatsappNumber } from './core.js';

export const MANUAL_REVIEW_CHECKS = [
  ['mobile', 'Conferi a página a 360 px: leitura, menu e ausência de rolagem lateral.'],
  ['tablet', 'Conferi a composição a 768 px.'],
  ['desktop', 'Conferi a composição a 1440 px.'],
  ['keyboard', 'Testei teclado, foco visível e abertura e fechamento dos controles.'],
  ['contact', 'Testei os botões e confirmei os destinos de contato com o cliente.'],
  ['content', 'Revisei serviços, textos, preços autorizados e informações pendentes.'],
  ['media', 'Conferi imagens, enquadramento, procedência e autorização de uso.'],
  ['contrast', 'Conferi contraste, tamanho do texto e legibilidade dos estados dos botões.'],
];

export function productionPlan(lead, { hasDraft = false, reviewed = false } = {}) {
  const direction = creativeDirection(lead), assets = lead.assets || [];
  const missing = [];
  if (!lead.goal || !lead.audience) missing.push('Definir a ação principal e o público da página.');
  if (!lead.services && !lead.products?.length) missing.push('Confirmar os serviços ou produtos a apresentar.');
  if (!whatsappNumber(lead.phone) && !whatsappNumber(lead.businessPhone) && !lead.email) missing.push('Confirmar telefone, WhatsApp ou e-mail para os botões de contato.');
  if (!assets.some(a => a.role === 'logo')) missing.push('Solicitar a logomarca; uma proposta tipográfica pode ser usada no rascunho.');
  if (!assets.some(a => a.mime?.startsWith('image/') && a.role !== 'logo')) missing.push('Solicitar fotos autorizadas; identificar qualquer imagem conceitual como ilustrativa.');
  for (const item of lead.research?.missing || []) if (!missing.includes(item)) missing.push(item);
  return {
    direction,
    missing,
    steps: [
      { name: 'Base e materiais', state: missing.length ? 'Há informações a confirmar' : 'Ficha disponível', detail: 'Usar os fatos da ficha e registrar o que depende do responsável.' },
      { name: 'Direção de criação', state: 'Proposta disponível', detail: direction.composition },
      { name: 'Código da página', state: hasDraft ? 'Rascunho salvo' : 'Preparar no chat', detail: 'Criar HTML, CSS e JavaScript próprios e salvar uma versão sem substituir a página atual.' },
      { name: 'Revisão de entrega', state: reviewed ? 'Conferência registrada' : 'Conferir código e aparência', detail: 'Combinar análise estrutural com testes reais no navegador e revisão do conteúdo.' },
    ],
  };
}

export function productionRequest(lead, prompt) {
  const destination = lead.isDemo
    ? 'Esta é uma empresa fictícia. Entregue os arquivos HTML, CSS e JavaScript; não cadastre empresas reais.'
    : `Use o plugin Prospecto. Leia a ficha ${lead.id} (${lead.name}) com prospecto_get_lead e leia prospecto_get_code antes de editar. Se disponível, consulte prospecto_prepare_production para obter o plano e a análise estrutural. Preserve a página aplicada, links, etapas e valores comerciais. Salve o resultado apenas com prospecto_save_code, usando a revisão atual do rascunho (0 se não existir), e confira o resultado com prospecto_get_code. NÃO use prospecto_save_draft para substituir a página neste pedido. Em conflito de revisão, releia os arquivos da equipe antes de continuar.`;
  return `${destination}${lead.isTest?'\nEsta ficha é um teste privado. Produtos, preços e horários são fictícios. Preserve a identificação de demonstração e não a transforme em oportunidade real.':''}

Prepare uma proposta completa em quatro etapas de trabalho. Não invente uma equipe ou alegue que existem agentes executando em segundo plano.

1. PESQUISA E BRIEFING: separe fatos confirmados, proposta criativa e informações pendentes. Não invente preços, serviços, horários, avaliações, fotografias da empresa ou WhatsApp.
2. DIREÇÃO DE CRIAÇÃO: defina composição, tipografia, imagens, contraste e navegação específicos para esse negócio. Aplique acabamento de design; não repita a estrutura padrão apenas trocando nome e cor. Use a skill prospecto-design-delivery se estiver disponível; caso contrário, siga estas etapas com as ferramentas existentes. Não instale pacotes por conta própria.
3. IMPLEMENTAÇÃO: produza index.html, styles.css e script.js. Implemente hover, foco, botões com destinos reais, navegação móvel e conteúdo essencial acessível sem JavaScript. Use apenas mídias autorizadas da ficha ou material conceitual identificado. A sandbox bloqueia scripts externos, requisições de rede, iframes e formulários. Não enfraqueça essa proteção.
4. REVISÃO: teste o resultado no navegador em 360, 768 e 1440 px, teclado, menus e contato. Corrija os problemas encontrados. Diferencie leitura do código, análise automática e teste visual realmente executado. Se o navegador não estiver disponível, registre o limite; não afirme que testou. A análise estrutural do Prospecto não comprova qualidade visual.

Entregue a direção adotada, a versão salva, as verificações efetivamente realizadas e as pendências do cliente. Não publique, não envie mensagens e não altere o funil comercial.

INSTRUÇÕES DO CLIENTE — preservar as preferências e o prompt personalizado
${prompt}`;
}
