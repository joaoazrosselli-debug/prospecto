import {esc,plain,whatsappNumber} from './core.js';
import {outreachQueue,normalizeOutreach,outreachReviewBatch} from './outreach.js';
import {api} from './shared.js';
let ui;
const $=s=>document.querySelector(s);
export function configureOutreach(hooks){ui=hooks;}
const queue=()=>outreachQueue(ui.state().leads.filter(l=>!l.isDemo),ui.state().settings);

export function renderOutreach(){
  const rows=queue(),ready=rows.filter(r=>r.ready),real=rows.filter(r=>!ui.state().leads.find(l=>l.id===r.leadId)?.isTest);
  $('#view').innerHTML=`<section class="panel outreach-intro"><div><h2>Prepare a próxima conversa</h2><p>Qualifique a empresa, confira o canal e registre se ela pode receber sua mensagem. Abrir um rascunho não registra um envio.</p></div><div class="button-row"><button class="btn primary" data-outreach="batch" ${!rows.length?'disabled':''}>${ui.icon('download')}Baixar lote para revisão (${rows.length})</button><button class="btn" data-outreach="test">Criar ou abrir loja de teste</button></div><p class="small-copy muted">O lote inclui pendências e lojas de teste para revisão interna. Baixar não autoriza nem envia mensagens.</p><p class="small-copy muted">${real.length} empresas reais · ${ready.length} ${ready.length===1?'pronta':'prontas'} para primeira conversa · Envio automático não conectado.</p></section><div class="outreach-list">${rows.length?rows.map(r=>`<article class="panel outreach-row"><div><div class="inline-heading"><h3>${esc(r.name)}</h3><span class="tag ${r.ready?'ready':''}">${r.ready?'Pronto para revisar':'Pendente'}</span></div><p>${r.ready?'Qualificação, número e permissão registrados. Revise o texto antes de abrir o WhatsApp.':esc(r.reasons.join(' '))}</p></div><div class="button-row"><button class="btn sm" data-outreach="review" data-id="${r.leadId}">Revisar contato</button><button class="btn sm ${r.ready?'primary':''}" data-action="message" data-id="${r.leadId}">Ver mensagem</button></div></article>`).join(''):'<div class="empty"><h2>A fila começa com a sua base</h2><p>Cadastre uma empresa ou use o Assistente para pesquisar um lote pequeno.</p><a class="btn" href="#assistente">Abrir assistente</a></div>'}</div><section class="panel outreach-roadmap"><h2>O que já pode ser automatizado</h2><dl><dt>Pesquisa e página</dt><dd>O assistente pesquisa fontes, cadastra fichas e salva o código por comando no chat.</dd><dt>Preparação comercial</dt><dd>Esta fila separa primeiras conversas, confere permissões por número e bloqueia recusas, testes e duplicatas.</dd><dt>Envio e respostas</dt><dd>Próxima integração: WhatsApp Business Platform, com templates e confirmação de entrega pelo provedor. Ainda não há envio ou agendamento em segundo plano.</dd></dl></section>`;
}
export function openOutreachReview(id){
  const lead=ui.state().leads.find(l=>l.id===id);if(!lead)return;const o=normalizeOutreach(lead.outreach);
  ui.openModal('Revisar contato',lead.name,`<form id="outreach-form" class="form-stack" data-id="${lead.id}"><p>WhatsApp cadastrado: <strong>${esc(lead.phone||'Não confirmado')}</strong>. Telefone comercial não é convertido automaticamente em WhatsApp.</p>${lead.isTest?'<div class="hint-box">Esta ficha é de teste e ficará fora da fila, independentemente dos campos abaixo.</div>':''}<label class="check-label"><input type="checkbox" name="qualified" ${o.qualified||lead.research?.aiStatus==='qualified'?'checked':''}>Revisei os dados e qualifiquei esta oportunidade.</label><div class="field"><label for="contact-permission">Pode receber mensagens neste número?</label><select id="contact-permission" name="permission"><option value="unknown" ${o.permission==='unknown'?'selected':''}>Ainda não sei</option><option value="allowed" ${o.permission==='allowed'?'selected':''}>Sim, tenho permissão registrada</option><option value="blocked" ${o.permission==='blocked'?'selected':''}>Não contatar / pediu para parar</option></select></div><div class="field"><label for="permission-source">Origem da permissão ou da recusa</label><textarea id="permission-source" name="permissionSource" maxlength="600" placeholder="Ex.: pediu uma proposta pelo formulário em 29/10. Um telefone público não é permissão automática.">${esc(o.permissionSource)}</textarea></div><div class="field"><label for="outreach-note">Próximo passo da conversa</label><textarea id="outreach-note" name="note" maxlength="1500">${esc(o.note)}</textarea></div><p class="small-copy muted">${o.lastContactAt?'Último envio registrado pela equipe: '+new Date(o.lastContactAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Nenhum envio registrado nesta ficha.'}</p><label class="check-label"><input type="checkbox" name="contacted" ${lead.isTest?'disabled':''}>Confirmo que já enviei a mensagem por minha conta; registrar agora.</label><p class="form-error" id="outreach-error"></p><div class="form-actions"><button class="btn" type="button" data-action="close">Cancelar</button><button class="btn primary" type="submit">Salvar revisão</button></div></form>`);
}

function testForm(){ui.openModal('Loja de teste','Jzincu Fitness · catálogo fictício e ficha privada',`<form id="test-business-form" class="form-stack"><p>A loja fica na base compartilhada com a etiqueta Teste, sem entrar em resultados ou contatos. Se já existir, será aberta sem sobrescrever seu trabalho.</p><div class="field"><label for="test-owner">Seu nome para o teste (opcional)</label><input id="test-owner" name="owner_name" maxlength="100" value="${esc(ui.cloud().info?.user?.name||'')}"></div><div class="field"><label for="test-phone">Seu telefone para a prévia privada (opcional)</label><input id="test-phone" name="business_phone" inputmode="tel" maxlength="30"></div><div class="field"><label for="test-email">Seu e-mail para a prévia privada (opcional)</label><input id="test-email" name="contact_email" type="email" maxlength="254"></div><p class="form-error" id="test-error"></p><div class="form-actions"><button class="btn" type="button" data-action="close">Cancelar</button><button class="btn primary" type="submit">Criar ou abrir teste</button></div></form>`);}

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-outreach]');if(!b||!ui||b.disabled)return;
  if(b.dataset.outreach==='review')openOutreachReview(b.dataset.id);
  if(b.dataset.outreach==='test')testForm();
  if(b.dataset.outreach==='batch'){
    b.disabled=true;
    try{const current=await api('outreach');if(!current.rows?.length)throw Error('A base está vazia. Adicione uma empresa ou crie uma loja de teste.');ui.download(JSON.stringify(outreachReviewBatch(current.rows),null,2),'prospecto-lote-revisao.json','application/json');ui.toast('Lote de revisão baixado, incluindo pendências. Nenhuma mensagem foi enviada.');}catch(error){ui.toast(error.message);}finally{if(b.isConnected)b.disabled=false;}
  }
});
document.addEventListener('submit',async e=>{
  const f=e.target;if(!ui||!['outreach-form','test-business-form'].includes(f.id))return;e.preventDefault();const data=Object.fromEntries(new FormData(f));
  try{
    if(f.id==='outreach-form'){
      const lead=ui.state().leads.find(l=>l.id===f.dataset.id);if(!lead)return;
      if(data.permission==='allowed'&&!plain(data.permissionSource))throw Error('Informe onde a empresa autorizou receber mensagens.');
      const before=normalizeOutreach(lead.outreach);
      lead.outreach=normalizeOutreach({...before,qualified:data.qualified==='on',permission:data.permission,permissionSource:data.permissionSource,permissionNumber:whatsappNumber(lead.phone),note:data.note,lastContactAt:data.contacted==='on'&&!lead.isTest?new Date().toISOString():before.lastContactAt});
      // An explicit decision here replaces only the qualification flag, keeping
      // the research evidence and commercial stage intact.
      if(lead.research&&data.qualified!=='on'&&lead.research.aiStatus==='qualified')lead.research={...lead.research,aiStatus:'needs_review'};
      ui.persist();ui.close();ui.render();ui.toast('Revisão salva. Nenhuma mensagem foi enviada.');
    }else{
      const submit=f.querySelector('[type="submit"]');submit.disabled=true;
      const payload=Object.fromEntries(Object.entries(data).filter(([,v])=>plain(v)));
      const result=await api('ai/test-store',{method:'POST',body:JSON.stringify(payload)});
      await ui.cloud().refresh();ui.close();if(result.lead.archivedAt){ui.route('lixeira');ui.toast('A loja de teste está na lixeira. Restaure o cadastro para abrir a revisão.');return;}ui.select(result.lead.id);ui.route('producao');ui.toast(result.created?'Jzincu Fitness criada como teste privado.':'Teste existente aberto; suas edições foram preservadas.');
    }
  }catch(error){f.querySelector('.form-error').textContent=error.message;const button=f.querySelector('[type="submit"]');if(button)button.disabled=false;}
});
