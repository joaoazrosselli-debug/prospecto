import { esc } from './core.js';
import { api } from './shared.js';

let hooks, state, request = 0;
const scopes = new Map();
const $ = selector => document.querySelector(selector);
const statusName = { pass: 'Encontrado', warn: 'Conferir', fail: 'Corrigir' };

export function deliveryPanelMarkup() {
  return '<section id="delivery-panel" class="panel delivery-loading" aria-live="polite"><h2>Plano e revisão da página</h2><p>Carregando a ficha, o código salvo e as conferências da equipe…</p></section>';
}

function render(data) {
  const { source, plan, automatic, review } = data;
  const current = review?.current ? review : null;
  const label = source.scope === 'draft' ? 'Rascunho salvo' : 'Página atual';
  return `<section id="delivery-panel" class="delivery-workspace">
    <section class="panel delivery-heading"><div><h2>Prepare uma página que vale apresentar.</h2><p>Organize a criação, encontre problemas no código e registre o que a equipe realmente conferiu.</p></div><button class="btn primary" data-delivery="request">Copiar pedido completo para o chat</button><p class="delivery-execution">A criação é executada pelo assistente no chat conectado. Aqui, a análise de código é automática. Não há agente rodando em segundo plano.</p></section>
    <ol class="delivery-steps">${plan.steps.map(step => `<li><h3>${esc(step.name)}</h3><span>${esc(step.state)}</span><p>${esc(step.detail)}</p></li>`).join('')}</ol>
    <div class="delivery-main"><section class="panel delivery-review">
      <div class="delivery-section-heading"><div><h2>Conferir esta versão</h2><p>Rascunho e página atual são analisados separadamente.</p></div><div class="field"><label for="delivery-scope">Código analisado</label><select id="delivery-scope"><option value="active" ${source.scope === 'active' ? 'selected' : ''}>Página atual</option><option value="draft" ${source.scope === 'draft' ? 'selected' : ''} ${source.hasDraft ? '' : 'disabled'}>Rascunho salvo</option></select></div></div>
      <div class="delivery-source"><strong>${label} · revisão ${source.revision}</strong><div class="button-row"><button class="btn sm" data-delivery="refresh">Verificar código salvo</button><button class="btn sm ghost" data-delivery="export">Baixar relatório interno</button></div></div>
      <p class="delivery-warning">${esc(automatic.notice)}</p>
      <div class="delivery-counts"><span><strong>${automatic.blockers}</strong> para corrigir</span><span><strong>${automatic.warnings}</strong> para conferir</span><span><strong>${automatic.passed}</strong> indícios encontrados</span></div>
      <details class="delivery-findings" ${automatic.blockers ? 'open' : ''}><summary>Resultados da análise estrutural</summary><ul>${automatic.checks.map(check => `<li class="delivery-finding ${check.status}"><div><strong>${esc(check.label)}</strong><span>${statusName[check.status]}</span></div><p>${esc(check.detail)}</p></li>`).join('')}</ul></details>
      ${review && !review.current ? `<div class="delivery-stale" role="status"><strong>A conferência anterior ficou desatualizada.</strong><p>O código, os dados públicos ou os materiais mudaram. Confira esta versão; as marcações anteriores não foram reaproveitadas.</p>${review.note ? `<details><summary>Observação da conferência anterior</summary><p>${esc(review.note)}</p></details>` : ''}</div>` : ''}
      <form id="delivery-review-form" data-unsaved="false" class="form-stack"><div><h3>Conferência da equipe</h3><p>Marque apenas o que foi testado. Estes itens são declarações da equipe, não testes automáticos.</p></div><div class="delivery-checklist">${data.manualChecks.map(([id, text]) => `<label class="check-label"><input type="checkbox" name="${esc(id)}" ${current?.checks?.[id] ? 'checked' : ''}><span>${esc(text)}</span></label>`).join('')}</div>
      <div class="field"><label for="delivery-note">O que foi testado e o que falta resolver?</label><textarea id="delivery-note" name="note" maxlength="2000" placeholder="Ex.: menu e contatos conferidos; fotos oficiais e horários ainda aguardam o cliente.">${esc(current?.note || '')}</textarea></div>
      <div class="delivery-save"><p id="delivery-save-status" role="status">${current ? `Conferência ${current.status === 'reviewed' ? 'registrada' : 'parcial'} em ${esc(new Date(current.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}.` : 'Ainda não há conferência registrada para esta versão.'}</p><button class="btn primary" type="submit">Salvar conferência</button></div><p class="small-copy muted">Salvar não aplica código, não aprova o cliente e não ativa o link. Uma conferência parcial também pode ser guardada.</p></form>
    </section><aside class="delivery-aside"><section class="panel"><h2>Direção sugerida</h2><h3>${esc(plan.direction.label)}</h3><p>${esc(plan.direction.mood)}</p><div class="creative-swatches" aria-label="Paleta conceitual">${plan.direction.colors.map(color => `<span><i style="background:${esc(color)}" aria-hidden="true"></i><code>${esc(color)}</code></span>`).join('')}</div><p>${esc(plan.direction.type)}</p><p class="small-copy muted">Proposta provisória. A marca e as preferências do cliente têm prioridade.</p></section><section class="panel"><h2>Antes de apresentar</h2>${plan.missing.length ? `<ul class="delivery-pending">${plan.missing.map(item => `<li>${esc(item)}</li>`).join('')}</ul>` : '<p>Não foram identificadas pendências básicas na ficha. Confirme o conteúdo com o responsável.</p>'}<p class="small-copy muted">Estas pendências ficam na área da equipe, fora da página do cliente.</p></section></aside></div>
  </section>`;
}

export async function mountDeliveryPanel(lead, ui, { discard = false } = {}) {
  hooks = ui;
  const token = ++request;
  if (lead.isDemo) {
    $('#delivery-panel').innerHTML = '<h2>Revisão ligada a uma empresa da equipe</h2><p>Selecione uma empresa da sua base para analisar o código salvo e registrar conferências compartilhadas. Os exemplos da demonstração não gravam revisões no banco.</p>';
    return;
  }
  try {
    const scope = scopes.get(lead.id);
    const data = await api('production/' + lead.id + (scope ? '?scope=' + scope : ''));
    if (token !== request || !$('#delivery-panel') || hooks.current()?.id !== lead.id) return;
    // Preserve a form if a background refresh finishes after the team starts typing.
    if (!discard && $('#delivery-review-form')?.dataset.unsaved === 'true') return;
    state = { id: lead.id, data, busy: false };
    $('#delivery-panel').outerHTML = render(data);
  } catch (error) {
    if (token === request && $('#delivery-panel')) $('#delivery-panel').innerHTML = `<h2>Não foi possível carregar a revisão</h2><p>${esc(error.message)}</p><button class="btn" data-delivery="retry">Tentar novamente</button>`;
  }
}

const dirty = () => $('#delivery-review-form')?.dataset.unsaved === 'true';
const canReload = () => !dirty() || window.confirm('Recarregar a revisão? As marcações ainda não salvas serão descartadas.');
document.addEventListener('click', async event => {
  const button = event.target.closest('[data-delivery]');
  if (!button || !hooks || !$('#delivery-panel')) return;
  try {
    if (button.dataset.delivery === 'request') {
      const copied = await hooks.copy(state.data.request);
      if (copied !== false) hooks.toast('Pedido copiado. Cole no chat com o Prospecto conectado.');
    }
    if (button.dataset.delivery === 'export') {
      const { lead, source, automatic, review, manualChecks } = state.data;
      hooks.download(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), purpose: 'Relatório interno da equipe; não é aprovação do cliente.', lead, source, automatic, review, manualChecks }, null, 2), 'prospecto-' + state.id + '-revisao.json', 'application/json');
    }
    if (['refresh', 'retry'].includes(button.dataset.delivery) && canReload()) await mountDeliveryPanel(hooks.current(), hooks, { discard: true });
  } catch (error) { hooks.toast(error.message); }
});
document.addEventListener('change', async event => {
  if (event.target.id !== 'delivery-scope' || !state) return;
  if (state.busy) { event.target.value = state.data.source.scope; return; }
  if (!canReload()) { event.target.value = state.data.source.scope; return; }
  scopes.set(state.id, event.target.value);
  await mountDeliveryPanel(hooks.current(), hooks, { discard: true });
});
document.addEventListener('submit', async event => {
  if (event.target.id !== 'delivery-review-form' || !state || !hooks) return;
  event.preventDefault();
  const form = event.target, current = state;
  if (current.busy) return;
  const input = new FormData(form), checks = Object.fromEntries(current.data.manualChecks.map(([key]) => [key, input.has(key)]));
  const note = String(input.get('note') || '');
  current.busy = true;
  const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    await api('production/' + current.id + '/review', { method: 'POST', body: JSON.stringify({ scope: current.data.source.scope, fingerprint: current.data.source.fingerprint, checks, note }) });
    if (state !== current || hooks.current()?.id !== current.id || !form.isConnected) return;
    const unchanged = current.data.manualChecks.every(([key]) => form.elements.namedItem(key).checked === checks[key]) && form.elements.note.value === note;
    if (unchanged) { form.dataset.unsaved = 'false'; await mountDeliveryPanel(hooks.current(), hooks, { discard: true }); }
    else $('#delivery-save-status').textContent = 'Conferência salva. Há novas alterações no formulário que ainda precisam ser salvas.';
    hooks.toast('Conferência salva. A página foi preservada.');
  } catch (error) { if (form.isConnected) $('#delivery-save-status').textContent = error.message; hooks.toast(error.message); }
  finally { current.busy = false; if (button.isConnected) button.disabled = false; }
});
window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
