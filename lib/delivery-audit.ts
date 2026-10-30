import { parse } from 'parse5';
import { compileCode } from '../public/source-code.js';
import { assetPath } from '../public/landing.js';

type Check = { id: string; label: string; status: 'pass' | 'warn' | 'fail'; detail: string };
const attr = (node: any, name: string) => node?.attrs?.find((a: any) => a.name === name)?.value;
function textOf(node: any): string {
  if (['script', 'style'].includes(node.tagName)) return '';
  return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(textOf).join(' ');
}
const number = (value: string) => {
  const n = String(value || '').replace(/\D/g, '');
  return n.length === 10 || n.length === 11 ? '55' + n : n;
};

// Structural checks, deliberately not a visual score or a claim of browser testing.
export function auditDelivery(files: any, lead: any) {
  const html = compileCode(files), doc: any = parse(html), nodes: any[] = [];
  const walk = (node: any) => { if (node.tagName) nodes.push(node); for (const child of node.childNodes || []) walk(child); };
  walk(doc);
  const all = (tag: string) => nodes.filter(n => n.tagName === tag);
  const meta = (name: string) => all('meta').find(n => attr(n, 'name')?.toLowerCase() === name);
  const checks: Check[] = [];
  const check = (id: string, label: string, ok: boolean, detail: string, warning = false) => checks.push({ id, label, status: ok ? 'pass' : warning ? 'warn' : 'fail', detail });
  check('document', 'Documento e idioma', doc.childNodes.some((n: any) => n.nodeName === '#documentType') && /^pt(?:-br)?$/i.test(attr(all('html')[0], 'lang') || ''), 'Verifica doctype e idioma português no HTML.');
  check('viewport', 'Configuração para celular', /width\s*=\s*device-width/i.test(attr(meta('viewport'), 'content') || ''), 'A presença da viewport não comprova que o layout funciona no celular.');
  check('title', 'Título da página', textOf(all('title')[0] || {}).trim().length >= 4, 'Exige um título preenchido no documento.');
  check('description', 'Descrição para busca', !!attr(meta('description'), 'content')?.trim(), 'Conferir se o texto descreve a empresa com precisão.', true);
  check('headings', 'Conteúdo principal e título', all('main').length === 1 && all('h1').length === 1 && !!textOf(all('h1')[0] || {}).trim(), 'Verifica um main e um h1 com texto; a hierarquia visual precisa de conferência.');
  const ids = nodes.map(n => attr(n, 'id')).filter(Boolean), idSet = new Set(ids);
  check('unique_ids', 'Identificadores únicos', ids.length === idSet.size, 'IDs repetidos podem impedir a navegação e a associação de controles.');
  const badLinks = all('a').filter(n => {
    const href = (attr(n, 'href') || '').trim();
    if (!href || href === '#' || /^javascript:/i.test(href)) return true;
    if (href.startsWith('#')) { try { return !idSet.has(decodeURIComponent(href.slice(1))); } catch { return true; } }
    return false;
  });
  check('links', 'Destinos da navegação', !badLinks.length, badLinks.length ? `${badLinks.length} link(s) sem destino ou com âncora ausente.` : 'Âncoras internas encontradas. Links externos ainda precisam ser abertos e conferidos.');
  const known = [number(lead.phone), number(lead.businessPhone)].filter(n => /^55\d{10,11}$/.test(n));
  const contact = all('a').some(n => {
    const href = attr(n, 'href') || '';
    if (/^tel:/i.test(href)) return known.includes(number(href.slice(4)));
    if (/^mailto:/i.test(href)) {try{return !!lead.email&&decodeURIComponent(href.slice(7).split('?')[0]).toLowerCase()===lead.email.toLowerCase();}catch{return false;}}
    try { const u = new URL(href); return u.hostname === 'wa.me' && !!lead.phone && number(u.pathname) === number(lead.phone); } catch { return false; }
  });
  check('contact', 'Contato compatível com a ficha', contact, 'Procura telefone, WhatsApp ou e-mail igual ao cadastrado. A existência e o atendimento do contato precisam ser confirmados.');
  check('image_alt', 'Alternativas das imagens', all('img').every(n => attr(n, 'alt') !== undefined), 'Verifica a presença do atributo alt; a qualidade do texto alternativo exige leitura.');
  const available = new Set((lead.assets || []).map(assetPath));
  const missingMedia = nodes.flatMap(n => ['src', 'poster'].map(a => attr(n, a)).filter(v => v?.replace(/^\.\//, '').startsWith('midias/'))).filter(v => !available.has(v.replace(/^\.\//, '')));
  check('media_files', 'Arquivos do kit', !missingMedia.length, missingMedia.length ? `${missingMedia.length} referência(s) a mídias que não constam na ficha.` : 'Os caminhos midias/ usados constam na ficha. O carregamento deve ser conferido no navegador.');
  const scripts = all('script').filter(n => !attr(n, 'type') || /^(?:module|(?:text|application)\/javascript)$/i.test(attr(n, 'type')));
  check('external_scripts', 'Compatibilidade dos scripts', !scripts.some(n => !!attr(n, 'src')), 'A apresentação hospedada bloqueia scripts externos.');
  const handlers = nodes.some(n => n.attrs?.some((a: any) => /^on/i.test(a.name)));
  check('scripts_enabled', 'Execução das interações', !!files.scriptsEnabled || (!scripts.length && !handlers && !files.js?.trim()), 'Código JavaScript e eventos precisam estar ativados para executar na apresentação.');
  const scriptSource = scripts.map(n => (n.childNodes || []).map((c: any) => c.value || '').join('')).join('\n');
  check('network', 'Dependências de rede', !/\b(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|import\s*\()/i.test(scriptSource), 'Busca indícios de requisições de rede bloqueadas pela sandbox; não executa o JavaScript.', true);
  check('blocked_elements', 'Recursos aceitos pela apresentação', !all('iframe').length && !all('form').length && !all('object').length && !all('embed').length, 'Formulários, iframes e conteúdos incorporados não funcionam nesta apresentação isolada.');
  const css = all('style').map(n => (n.childNodes || []).map((c: any) => c.value || '').join('')).join('\n');
  check('responsive', 'Regras de adaptação no CSS', /@media\s*[^{}]*width|(?:minmax|clamp)\s*\(/i.test(css), 'Indício de adaptação encontrado no CSS; não equivale a testar larguras.', true);
  check('hover', 'Estado de hover declarado', /:hover\b/.test(css), 'Indício no CSS; conferir quais controles recebem o estilo e sua legibilidade.', true);
  check('focus', 'Estado de foco declarado', /:focus(?:-visible|-within)?\b/.test(css), 'Indício no CSS; testar a sequência de teclado e o foco visível.', true);
  check('reduced_motion', 'Preferência por menos movimento', !/(?:transition|animation)\s*:/i.test(css) || /prefers-reduced-motion/.test(css), 'Páginas com transições devem respeitar a preferência por menos movimento.', true);
  check('placeholders', 'Textos provisórios', !/lorem ipsum|\bTODO\b|seu texto aqui|insira (?:o |a )?(?:texto|imagem)/i.test(textOf(doc)), 'Procura exemplos comuns de placeholder; não verifica a veracidade dos textos.', true);
  return { version: 1, kind: 'static_analysis', checks, blockers: checks.filter(c => c.status === 'fail').length, warnings: checks.filter(c => c.status === 'warn').length, passed: checks.filter(c => c.status === 'pass').length, visualTested: false, notice: 'Análise estrutural do código salvo. Não executa a página, não mede contraste ou desempenho e não confirma qualidade visual nem dados comerciais.' };
}
