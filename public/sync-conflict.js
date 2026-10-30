const LABELS={archivedAt:'Situação na lixeira',publicEnabled:'Link de apresentação',name:'Nome da empresa',city:'Cidade',sector:'Segmento',address:'Endereço',phone:'WhatsApp',businessPhone:'Telefone comercial',email:'E-mail',website:'Site',websiteStatus:'Situação do site',source:'Fonte',services:'Serviços',description:'Descrição',notes:'Anotações internas',headline:'Título principal',subtitle:'Apresentação',hours:'Horários',stage:'Etapa comercial',value:'Valor combinado',received:'Total recebido',products:'Produtos e serviços',outreach:'Revisão do contato',research:'Pesquisa',customHtml:'Código da página',productionStatus:'Etapa de produção',promptOverride:'Prompt do cliente',promptTemplate:'Prompt do estúdio',lovablePrompt:'Prompt do Lovable',brandStyle:'Direção visual',palette:'Cor da marca',layout:'Composição',pageTemplate:'Modelo da prévia',publishReady:'Faixa de prévia',studio:'Nome do estúdio',price:'Preço sugerido',goal:'Objetivo',senderName:'Nome na abordagem',salesProfile:'Forma de apresentação'};
function display(field,value){
 if(field==='archivedAt')return value?'Na lixeira desde '+new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Ativa na base';
 if(field==='publicEnabled')return value?'Link ativado':'Link desativado';
 if(value==null||value==='')return 'Não preenchido';
 if(typeof value==='boolean')return value?'Sim':'Não';
 if(typeof value==='object')return JSON.stringify(value).slice(0,280);
 return String(value).slice(0,280);
}
export function conflictPresentation({kind,id,error},local={}){
 const subject=kind==='lead'?(error.current?.name||local.name||'empresa'):kind==='settings'?'Configurações do estúdio':(error.current?.label||local.label||'custo');
 return {title:'Duas versões do mesmo cadastro',description:'Cadastro: '+subject+'. Outra sessão salvou uma versão diferente; pode ser outro aparelho seu ou alguém da equipe.',fields:(error.fields||[]).map(field=>({label:LABELS[field]||'Outro campo do cadastro',local:display(field,local[field]),remote:display(field,error.current?.[field])}))};
}
