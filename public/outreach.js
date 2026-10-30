import {plain,whatsappNumber,safeURL} from './core.js';

export function normalizeOutreach(value={}){
  return {
    qualified:value.qualified===true,
    permission:['unknown','allowed','blocked'].includes(value.permission)?value.permission:'unknown',
    permissionSource:plain(value.permissionSource).slice(0,600),
    permissionNumber:whatsappNumber(value.permissionNumber),
    lastContactAt:/^\d{4}-\d{2}-\d{2}T/.test(value.lastContactAt||'')&&!Number.isNaN(Date.parse(value.lastContactAt))?value.lastContactAt:'',
    note:plain(value.note).slice(0,1500),
  };
}

export function outreachMessage(lead,settings={},variant=0){
  const name=plain(settings.senderName);
  const intro=settings.salesProfile==='studio'
    ?`Sou ${name?name+', do ': 'do '}${settings.studio||'estúdio de sites'}.`
    :`${name?'Sou '+name+'. ':''}Sou estudante de Engenharia de Software e estou construindo meu portfólio com sites para comércios locais.`;
  const city=lead.neighborhood?` no ${lead.neighborhood}`:lead.city?` em ${lead.city}`:'';
  const reviewedPreview=lead.externalPreviewReviewed?safeURL(lead.externalPreviewUrl):'';
  const text=[
    `Olá! ${intro} Conheci a ${lead.name}${city}. Posso te mostrar uma ideia de página para apresentar os produtos ou serviços de vocês? Se houver interesse, a gente conversa sobre o escopo e o valor.`,
    reviewedPreview?`Oi, tudo bem? ${intro} Preparei uma proposta visual para a ${lead.name}. Você pode avaliar aqui: ${reviewedPreview} Se fizer sentido, conversamos sobre os ajustes, o escopo e o valor.`:`Oi, tudo bem? ${intro} Estou entrando em contato com a ${lead.name} para saber se faz sentido conversar sobre uma página própria. Posso explicar a ideia por aqui?`,
    `Olá, equipe da ${lead.name}! ${intro} Gostaria de conversar com quem cuida da presença online da empresa. Posso enviar uma sugestão de site para vocês avaliarem?`,
  ];
  return text[((variant%text.length)+text.length)%text.length]+' Se preferir não receber mensagens, me avise que encerro o contato.';
}

// Preparing a conversation is distinct from sending it. Permission belongs to a
// confirmed number; an edited contact cannot inherit a previous permission.
export function outreachQueue(leads,settings={}){
  const suppressed=new Set(leads.filter(l=>!l.isDemo&&!l.isTest&&normalizeOutreach(l.outreach).permission==='blocked').flatMap(l=>[whatsappNumber(l.phone),normalizeOutreach(l.outreach).permissionNumber]).filter(Boolean));
  const contacted=new Set(leads.filter(l=>!l.isDemo&&!l.isTest&&(normalizeOutreach(l.outreach).lastContactAt||['contato','proposta'].includes(l.stage))).map(l=>whatsappNumber(l.phone)).filter(Boolean));
  const seen=new Set();
  return leads.filter(lead=>!lead.archivedAt).sort((a,b)=>String(a.id).localeCompare(String(b.id))).map(lead=>{
    const outreach=normalizeOutreach(lead.outreach),number=whatsappNumber(lead.phone),reasons=[];
    const context={isTest:!!(lead.isDemo||lead.isTest),city:lead.city||'',sector:lead.sector||'',businessPhone:lead.businessPhone||'',website:lead.website||''};
    if(lead.isDemo||lead.isTest)return {...context,leadId:lead.id,name:lead.name,number,ready:false,reasons:['Empresa de teste; fora dos contatos.'],outreach,message:outreachMessage(lead,settings)};
    if(['fechado','perdido'].includes(lead.stage))reasons.push('Negociação encerrada.');
    if(!(outreach.qualified||lead.research?.aiStatus==='qualified'))reasons.push('Qualifique a oportunidade.');
    if(!number)reasons.push('Confirme um número de WhatsApp.');
    if(outreach.permission==='blocked'||(number&&suppressed.has(number)))reasons.push('Não contatar: recusa registrada para este número.');
    else if(outreach.permission!=='allowed'||!outreach.permissionSource||outreach.permissionNumber!==number)reasons.push('Registre a permissão e sua origem para este número.');
    if(outreach.lastContactAt||['contato','proposta'].includes(lead.stage)||(number&&contacted.has(number)))reasons.push('Já houve contato neste número; revise o próximo passo na negociação.');
    if(!reasons.length&&seen.has(number))reasons.push('Mesmo número de outra ficha já incluída neste lote.');
    const ready=!reasons.length;if(ready)seen.add(number);
    return {...context,leadId:lead.id,name:lead.name,number,ready,reasons,outreach,message:outreachMessage(lead,settings)};
  });
}

export function outreachReviewBatch(rows,at=new Date().toISOString()){
  return {version:2,preparedAt:at,mode:'internal_review',sent:false,counts:{total:rows.length,ready:rows.filter(r=>r.ready).length,pending:rows.filter(r=>!r.ready).length,tests:rows.filter(r=>r.isTest).length},contacts:rows.map(r=>({leadId:r.leadId,name:r.name,isTest:!!r.isTest,city:r.city||'',sector:r.sector||'',number:r.number||'',businessPhone:r.businessPhone||'',website:r.website||'',ready:!!r.ready,pending:[...(r.reasons||[])],message:r.message}))};
}
