import {esc} from './core.js';
import {api} from './shared.js';
import {DISCOVERY_SEGMENTS,DISCOVERY_REGIONS,contactDigits,siteAssessmentLabel,discoveryArea,validMapPoint,distanceKm} from './discovery-data.js';
import {suspendDiscoveryMap,mountDiscoveryMap,discoveryMapCenter,fitDiscoveryResults} from './discovery-map.js';
let ui,config=null,batch=null,activeId='',busy=false,problem='',stale=false,locating=false,locations=[],locationQuery='',locationProblem='',focusMap=true;
let siteFilter='all';
let request={segment:'all',region:'bairro-alto',radius_km:2.5,limit:10,require_contact:true};
const ratings=new Map(),pendingItems=new Set(),$=s=>document.querySelector(s);
const at=t=>new Date(t).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
const link=(url,label,extra='')=>url?`<a class="inline-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" ${extra}>${esc(label)} ↗</a>`:'';
const maps=item=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([item.name,item.address,item.city,validMapPoint(item.lat,item.lon)?`${item.lat},${item.lon}`:''].filter(Boolean).join(' '));
const visibleItems=()=>batch?.items.filter(item=>siteFilter==='all'||siteFilter===(item.website?'with':'without'))||[];
export function configureDiscovery(hooks){ui=hooks;}
export function discoveryMarkup(){return '<div id="discovery-panel"></div>';}
export function mountDiscovery(){render();if(!config)api('discovery/status').then(r=>{config=r;render();}).catch(error=>{problem=error.message;render();});}
function formRequest(){
 const form=$('#discovery-form');if(!form)return {...request};
 const data=new FormData(form);
 return {...request,segment:data.get('segment')||request.segment,limit:Number(data.get('limit')||request.limit),radius_km:Number(data.get('radius_km')||request.radius_km),require_contact:data.has('require_contact')};
}
function choosePoint(point){
 const previous=discoveryArea(request),near=distanceKm(previous,point)<15;
 request={...formRequest(),region:'map',center:{...point,label:near&&previous.city?'Área no mapa · '+previous.city:'Ponto escolhido no mapa',city:near?previous.city:'',state:near?previous.state:'',neighborhood:''}};
 locations=[];stale=!!batch;focusMap=true;render();
}
function render(){
 const root=$('#discovery-panel');if(!root)return;suspendDiscoveryMap();
 const area=discoveryArea(request),locked=busy||locating;
 root.innerHTML=`<section class="panel discovery-search"><div class="discovery-title"><div><h2>Busque empresas em qualquer região do Brasil</h2><p>Localize uma cidade ou bairro, ajuste o raio e analise as empresas no mapa. Salve a ficha sem redigitar os dados encontrados.</p></div><span class="tag ready">Pesquisa externa</span></div>
 <form id="discovery-location-form"><label class="field-label" for="discovery-location">Cidade, bairro ou região</label><div class="discovery-location-controls"><input id="discovery-location" name="query" minlength="3" maxlength="160" value="${esc(locationQuery)}" placeholder="Ex.: Macapá, Amapá · ou Bairro Alto, Curitiba" autocomplete="off" required ${locked?'disabled':''}><button class="btn" type="submit" ${locked?'disabled':''}>${ui.icon('pin')}${locating?'Localizando…':'Localizar região'}</button></div><p class="small-copy muted">Digite a região e clique em Localizar. Escolha o resultado correto; nenhum cadastro é criado nesta etapa.</p><p class="form-error" role="alert">${esc(locationProblem)}</p></form>
 ${locations.length?`<ul class="discovery-locations" aria-label="Localizações encontradas">${locations.map((location,index)=>`<li><button type="button" data-discovery-location="${index}"><span>${ui.icon('pin')}</span><span><strong>${esc(location.name)}</strong><small>${esc(location.label)}</small></span><span aria-hidden="true">↗</span></button></li>`).join('')}</ul>`:''}
 <div class="discovery-presets" aria-label="Atalhos de região"><span>Atalhos:</span>${DISCOVERY_REGIONS.map(([id,label])=>`<button type="button" class="text-button ${request.region===id?'active':''}" data-discovery-region="${id}" ${locked?'disabled':''}>${esc(label.replace(' e arredores',''))}</button>`).join('')}</div>
 <form id="discovery-form"><div class="discovery-fields"><div class="field"><label for="discovery-segment">Tipo de comércio</label><select id="discovery-segment" name="segment" ${locked?'disabled':''}>${DISCOVERY_SEGMENTS.map(([v,label])=>`<option value="${v}" ${request.segment===v?'selected':''}>${esc(label)}</option>`).join('')}</select></div><div class="field"><label for="discovery-radius">Raio da pesquisa</label><select id="discovery-radius" name="radius_km" ${locked?'disabled':''}>${[.5,1,2,2.5,3,5,10,15,20].map(v=>`<option value="${v}" ${area.radiusKm===v?'selected':''}>${v.toLocaleString('pt-BR')} km</option>`).join('')}</select></div><div class="field"><label for="discovery-limit">Quantidade máxima</label><select id="discovery-limit" name="limit" ${locked?'disabled':''}>${[5,10,20,50].map(v=>`<option value="${v}" ${request.limit===v?'selected':''}>${v} empresas</option>`).join('')}</select></div><button class="btn primary" type="submit" ${locked?'disabled':''}>${ui.icon('search')}${busy?'Pesquisando…':'Buscar empresas'}</button></div><div class="discovery-search-options"><label class="check-label"><input name="require_contact" type="checkbox" ${request.require_contact?'checked':''} ${locked?'disabled':''}>Apenas empresas com telefone informado</label><span class="small-copy muted">${config?.search?.dailyLimit||40} pesquisas por dia no espaço · resultados por área</span></div></form>
 <div class="discovery-selected-area"><span>${ui.icon('pin')}</span><div><strong>${esc(area.label)}</strong><p>${area.radiusKm.toLocaleString('pt-BR')} km ao redor do ponto · o círculo pode incluir bairros vizinhos.</p></div></div><p class="form-error" role="alert">${esc(problem)}</p></section>
 <section class="panel discovery-map-panel" aria-labelledby="discovery-map-title"><div class="discovery-map-heading"><div><h2 id="discovery-map-title">Explore a região</h2><p class="small-copy muted">Arraste para navegar. Clique em um ponto para mudar o centro da busca.</p></div><div class="button-row"><button type="button" class="btn sm" data-discovery-map="fit" ${!batch?.items.some(i=>validMapPoint(i.lat,i.lon))?'disabled':''}>Ver resultados no mapa</button><button type="button" class="btn sm primary" data-discovery-map="search" ${locked?'disabled':''}>Buscar nesta área</button></div></div><div id="discovery-map" class="discovery-map-canvas" role="region" aria-label="Mapa de empresas e área de pesquisa no Brasil"></div><div class="discovery-map-caption"><p id="discovery-map-status" class="small-copy muted" role="status">Carregando mapa…</p><span class="small-copy muted">Mapa: OpenFreeMap / OSM · localização: Photon</span></div><p class="small-copy muted">Os números correspondem às empresas da lista. O mapa aberto pode ter menos contatos que o Google; um campo vazio significa informação não disponível.</p></section>
 <div id="discovery-results" aria-live="polite" aria-busy="${busy}">${batch?results():`<div class="discovery-start"><strong>Da pesquisa ao seu catálogo</strong><ol><li>Localize a região e escolha o comércio.</li><li>Analise os marcadores e os detalhes.</li><li>Adicione a empresa ao seu catálogo.</li><li>Complete o briefing e prepare a proposta.</li></ol></div>`}</div>`;
 const focus=focusMap;focusMap=false;
 mountDiscoveryMap($('#discovery-map'),{area,items:visibleItems().map(item=>({...item,mapNumber:batch.items.indexOf(item)+1})),activeId,focus,onPick:point=>{if(!busy&&!locating)choosePoint(point);},onSelect:item=>{activeId=item.id;render();queueMicrotask(()=>document.querySelector(`[data-company="${item.id}"]`)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'}));},onStatus:message=>{const status=$('#discovery-map-status');if(status)status.textContent=message;}});
}

function results(){
 return `<div class="discovery-results-heading"><div><h2>${batch.items.length} ${batch.items.length===1?'empresa encontrada':'empresas encontradas'}</h2><p class="small-copy muted">${stale?'Resultados anteriores · ':''}${batch.cached?'Consulta reaproveitada · ':''}${at(batch.checkedAt)} · ${esc(batch.area?.label||'Área consultada')}${batch.area?.radiusKm?' · '+batch.area.radiusKm.toLocaleString('pt-BR')+' km':''}</p></div><div class="field"><label for="discovery-site-filter">Situação do site</label><select id="discovery-site-filter"><option value="all" ${siteFilter==='all'?'selected':''}>Todas</option><option value="without" ${siteFilter==='without'?'selected':''}>Site não localizado</option><option value="with" ${siteFilter==='with'?'selected':''}>Site encontrado</option></select></div></div><div class="discovery-results-list">${batch.items.map((item,index)=>`<article class="panel discovery-company" data-company="${esc(item.id)}" data-site="${item.website?'with':'without'}" ${siteFilter!=='all'&&siteFilter!==(item.website?'with':'without')?'hidden':''}><div class="discovery-company-main"><div><h3><span class="discovery-list-number">${index+1}</span>${esc(item.name)}</h3><p class="small-copy muted">${esc([item.sector,item.neighborhood,item.city].filter(Boolean).join(' · '))}</p></div><span class="tag ${item.website?'ready':'warn'}">${siteAssessmentLabel(item)}</span></div><p class="small-copy">${esc(item.address||'Endereço completo não informado na fonte.')}</p><div class="discovery-contact-row">${contactDigits(item.businessPhone)?`<a class="contact-value" href="tel:+${esc(contactDigits(item.businessPhone))}">${ui.icon('phone')}${esc(item.businessPhone)}</a>`:item.whatsapp?`<span class="contact-value">WhatsApp informado: ${esc(item.whatsapp)}</span>`:'<span class="small-copy muted">Telefone não informado</span>'}${link(item.website,'Site')}${link(item.instagram,'Instagram')}${link(item.facebook,'Facebook')}</div><div class="discovery-company-bottom"><span class="small-copy muted">${item.existingLeadId?item.existingArchived?'Já está na lixeira':'Já está na sua base':'Novo resultado · revisar informações'}</span><div class="button-row"><button class="btn sm" data-discovery="details" data-id="${esc(item.id)}">Ver detalhes</button><button class="btn sm ${item.existingLeadId?'':'primary'}" data-discovery="import" data-id="${esc(item.id)}">${item.existingLeadId?'Abrir ficha em Empresas':'Adicionar a Empresas'}</button></div></div>${activeId===item.id?detail(item):''}</article>`).join('')||'<div class="empty"><h3>Nenhuma empresa com esses critérios.</h3><p>Experimente outra região, outro segmento ou desmarque o filtro de telefone. A pesquisa não cobre todos os estabelecimentos.</p></div>'}</div><p class="discovery-attribution small-copy muted">Dados: <a class="inline-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a>. Uma ausência nesta fonte não comprova ausência de site ou contato.</p>`;
}
function detail(item){
 const g=ratings.get(item.id),googleReady=config?.google?.configured;
 return `<div class="discovery-detail"><h4>Confira antes de produzir</h4><dl><div><dt>Site próprio</dt><dd>${item.website?link(item.website,item.website):'Não localizado na fonte. Confirmar com a empresa.'}</dd></div><div><dt>Telefone comercial</dt><dd>${esc(item.businessPhone||'Não informado')}</dd></div><div><dt>WhatsApp</dt><dd>${esc(item.whatsapp||'Não confirmado. Telefone público não confirma este canal.')}</dd></div><div><dt>Redes sociais</dt><dd>${link(item.instagram,'Instagram')}${item.instagram?` <small>${item.officialFields?.includes('instagram')?'vinculado no site consultado':'informado no mapa · conferir'}</small>`:''} ${link(item.facebook,'Facebook')}${item.facebook?` <small>${item.officialFields?.includes('facebook')?'vinculado no site consultado':'informado no mapa · conferir'}</small>`:''}${!item.instagram&&!item.facebook?'Nenhuma rede informada':''}</dd></div>${item.description?`<div><dt>Descrição no site</dt><dd>${esc(item.description)}</dd></div>`:''}${item.openingHours?`<div><dt>Horários na fonte</dt><dd>${esc(item.openingHours)}</dd></div>`:''}<div><dt>Fotos</dt><dd>${item.photoUrl?link(item.photoUrl,'Foto indicada no mapa')+' · autoria e uso a conferir.':'Não informadas nesta fonte. Você pode conferir fotos pelo Google Maps.'}</dd></div><div><dt>Fonte e consulta</dt><dd>${link(item.sourceUrl,'Abrir registro no OpenStreetMap')} · ${at(item.checkedAt)}</dd></div></dl><div class="button-row"><button class="btn sm" data-discovery="enrich" data-id="${esc(item.id)}" ${!item.website?'disabled':''}>${item.officialCheckedAt?'Conferir site novamente':'Consultar contatos no site'}</button>${link(maps(item),'Ver fotos e avaliações no Google Maps')}${validMapPoint(item.lat,item.lon)?`<button class="btn sm" data-discovery="map" data-id="${esc(item.id)}">Localizar no mapa</button>`:''}</div>${item.enrichmentNote?`<p class="small-copy muted">${esc(item.enrichmentNote)}</p>`:''}<div class="discovery-google"><div class="inline-heading"><h4>Avaliações no Google</h4><button class="btn sm" data-discovery="google" data-id="${esc(item.id)}" ${!googleReady?'disabled':''}>Consultar avaliações</button></div>${g?g.matches.length?`<p class="small-copy">Confira qual resultado corresponde à empresa.</p>${g.matches.map(m=>`<div class="google-match"><strong>${esc(m.name)}</strong><p class="small-copy">${esc(m.address)}</p><span>${m.rating===null?'Sem nota informada':`${m.rating.toLocaleString('pt-BR')} / 5 · ${m.count} avaliações`}</span> ${link(m.mapsUrl,'Ver no Google Maps')}${m.attributions?.map(a=>`<small>${a.url?link(a.url,a.provider):esc(a.provider)}</small>`).join('')||''}</div>`).join('')}<p class="small-copy muted">Consulta ao vivo em ${at(g.checkedAt)}. As notas não são copiadas para a ficha nem para o prompt.</p><span class="GMP-attribution" translate="no">Google Maps</span>`:'<p>Nenhuma correspondência encontrada. Confira pelo link do Google Maps.</p>':`<p class="small-copy muted">${googleReady?'Consulta ao vivo disponível. Confira a correspondência pelo nome e endereço.':'A conexão da Places API precisa ser configurada para mostrar nota e quantidade de avaliações aqui. Você já pode abrir o Google Maps pelo link acima.'}</p>`}</div><div class="discovery-next"><p>Serviços, preços, fotos e identidade visual serão completados no briefing. A ficha começa sem autorização de envio.</p><button class="btn primary" data-discovery="produce" data-id="${esc(item.id)}">Salvar e preparar o site ${ui.icon('arrow')}</button></div><p class="small-copy"><a class="inline-link" href="/privacidade.html" target="_blank" rel="noopener">Privacidade</a> · <a class="inline-link" href="/termos.html" target="_blank" rel="noopener">Termos de uso</a></p></div>`;
}
async function importItem(item,destination=''){
 const result=await api('discovery/import',{method:'POST',body:JSON.stringify({batch_id:batch.batchId,item_id:item.id})});
 item.existingLeadId=result.lead.id;item.existingArchived=result.archived;
 await ui.cloud().flush();const deadline=Date.now()+25000;while(ui.cloud().busy&&Date.now()<deadline)await new Promise(r=>setTimeout(r,100));
 if(ui.cloud().busy||ui.cloud().blocked)throw Error('A empresa foi salva. Conclua a sincronização da equipe antes de abrir o cadastro.');
 await ui.cloud().refresh();
 if(destination){ui.useReal();if(result.archived){ui.route('lixeira');ui.toast('Esta empresa está na lixeira. Restaure o cadastro para continuar.');return;}ui.select(result.lead.id);if(destination==='empresas'&&ui.openLead)ui.openLead(result.lead.id);else ui.route('producao');}
 else{render();ui.toast(result.created?'Empresa adicionada a Empresas, com os dados disponíveis.':'Cadastro existente preservado.');}
}
async function search(){
 if(busy||locating)return;
 request=formRequest();const submitted={...request,...(request.center?{center:{...request.center}}:{})};
 busy=true;problem='';stale=!!batch;render();
 try{batch=await api('discovery/search',{method:'POST',body:JSON.stringify(submitted)});activeId='';ratings.clear();stale=false;focusMap=true;}
 catch(error){problem=error.message+(error.retryAfter?' Tente novamente em '+error.retryAfter+' segundos.':'');}
 finally{busy=false;render();}
}
document.addEventListener('submit',async e=>{
 if(!ui)return;
 if(e.target.id==='discovery-form'){e.preventDefault();await search();return;}
 if(e.target.id!=='discovery-location-form')return;e.preventDefault();if(busy||locating)return;
 const query=String(new FormData(e.target).get('query')||'').trim();locationQuery=query;request=formRequest();locating=true;locationProblem='';locations=[];render();
 try{const found=await api('discovery/locate',{method:'POST',body:JSON.stringify({query})});locations=found.items;if(!locations.length)locationProblem='Não localizamos essa região. Acrescente cidade e estado ou escolha o ponto diretamente no mapa.';}
 catch(error){locationProblem=error.message+(error.retryAfter?' Aguarde '+error.retryAfter+' segundos.':'');}
 finally{locating=false;render();}
});
document.addEventListener('input',e=>{if(e.target.id==='discovery-location')locationQuery=e.target.value;});
document.addEventListener('change',e=>{
 if(e.target.form?.id==='discovery-form'){request=formRequest();if(e.target.id==='discovery-radius')render();}
 if(e.target.id==='discovery-site-filter'){siteFilter=e.target.value;render();}
});
document.addEventListener('click',async e=>{
 const locationButton=e.target.closest('[data-discovery-location]');
 if(locationButton&&ui&&!busy&&!locating){const location=locations[Number(locationButton.dataset.discoveryLocation)];if(location){const {lat,lon,label,city,state,neighborhood}=location;request={...formRequest(),region:'map',center:{lat,lon,label,city,state,neighborhood}};locationQuery=label.slice(0,160);locations=[];locationProblem='';stale=!!batch;focusMap=true;render();}return;}
 const preset=e.target.closest('[data-discovery-region]');
 if(preset&&ui&&!busy&&!locating){const region=DISCOVERY_REGIONS.find(r=>r[0]===preset.dataset.discoveryRegion);if(region){request={...formRequest(),region:region[0],radius_km:region[6]/1000};delete request.center;locationQuery='';locations=[];locationProblem='';stale=!!batch;focusMap=true;render();}return;}
 const mapButton=e.target.closest('[data-discovery-map]');
 if(mapButton&&ui&&!busy&&!locating&&!mapButton.disabled){if(mapButton.dataset.discoveryMap==='fit')fitDiscoveryResults(visibleItems());else{const point=discoveryMapCenter();if(point){choosePoint(point);await search();}}return;}
 const button=e.target.closest('[data-discovery]');if(!button||!ui||button.disabled||busy)return;
 const item=batch?.items.find(i=>i.id===button.dataset.id);if(!item)return;
 const action=button.dataset.discovery;
 if(action==='details'){activeId=activeId===item.id?'':item.id;render();return;}
 if(action==='map'){focusMap=false;fitDiscoveryResults([item]);$('#discovery-map')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
 if(pendingItems.has(item.id))return;pendingItems.add(item.id);button.disabled=true;problem='';
 try{
  if(action==='import')await importItem(item,item.existingLeadId?'empresas':'');
  if(action==='produce')await importItem(item,'producao');
  if(action==='enrich'){const result=await api('discovery/enrich',{method:'POST',body:JSON.stringify({batch_id:batch.batchId,item_id:item.id})});Object.assign(item,result.item);render();}
  if(action==='google'){ratings.set(item.id,await api('discovery/google',{method:'POST',body:JSON.stringify({batch_id:batch.batchId,item_id:item.id})}));render();}
 }catch(error){problem=error.message;render();ui.toast(error.message);}
 finally{pendingItems.delete(item.id);if(button.isConnected)button.disabled=false;}
});
