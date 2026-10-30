// Fixture only; provider calls and D1 mutations are checked separately in integration tests.
(() => {
 const previous=window.fetch.bind(window),time='2026-10-30T01:00:00Z',batchId='9dc140d9-6cda-4fba-8a78-c44a484087fa';
 const items=[
  {id:'node/101',name:'Cozinha Aurora · QA',sector:'Restaurante',city:'Curitiba / PR',neighborhood:'Bacacheri',lat:-25.402,lon:-49.209,address:'Rua fictícia, 30 · Bacacheri',businessPhone:'(41) 3000-1234',whatsapp:'',website:'https://restaurante.example',instagram:'',facebook:'',sourceUrl:'https://www.openstreetmap.org/node/101',checkedAt:time,websiteAssessment:'found',existingLeadId:''},
  {id:'node/102',name:'Pet Jardim · QA',sector:'Pet shop',city:'Curitiba / PR',neighborhood:'Bairro Alto',lat:-25.404,lon:-49.205,address:'Avenida fictícia, 50',businessPhone:'(41) 3000-5678',whatsapp:'',website:'',instagram:'https://instagram.com/petjardim',facebook:'',sourceUrl:'https://www.openstreetmap.org/node/102',checkedAt:time,websiteAssessment:'not_found',existingLeadId:''},
 ];
 window.fetch=async (url,options={})=>{
  if(typeof url!=='string'||!url.startsWith('/api/discovery/'))return previous(url,options);
  const body=options.body?JSON.parse(options.body):{};
  if(url.endsWith('/status'))return Response.json({search:{provider:'osm',configured:true},google:{configured:false},lovable:{configured:true,mode:'prefilled_link'}});
  if(url.endsWith('/locate'))return Response.json({provider:'photon',items:[{lat:.04015,lon:-51.05696,name:'Macapá',label:'Macapá · Amapá · Brasil',city:'Macapá / AP',state:'AP',neighborhood:'',type:'city'}]});
  if(url.endsWith('/search')){if(body.segment==='pharmacy')return Response.json({error:'A fonte de teste não respondeu. Tente novamente.'},{status:502});if(body.center)items.forEach((item,index)=>Object.assign(item,{lat:body.center.lat+.002*index,lon:body.center.lon+.002*index,city:body.center.city||'Cidade a confirmar',neighborhood:'Região de demonstração',address:'Rua fictícia, '+(30+index*20),businessPhone:body.center.state==='AP'?'(96) 3000-'+(1234+index):'(41) 3000-'+(1234+index)}));return Response.json({batchId,provider:'osm',cached:false,checkedAt:time,items,request:body,area:{label:body.center?.label||'Área de teste',radiusKm:body.radius_km||2.5}});}
  const item=items.find(i=>i.id===body.item_id);if(!item)return Response.json({error:'Empresa não encontrada'},{status:404});
  if(url.endsWith('/enrich')){Object.assign(item,{instagram:'https://instagram.com/cozinhaqa',facebook:'https://facebook.com/cozinhaqa',whatsapp:'5541999991234',officialFields:['instagram','facebook','whatsapp'],officialCheckedAt:time,enrichmentNote:'Links extraídos do site informado. Confira a empresa.'});return Response.json({item});}
  if(url.endsWith('/import')){
   const {normalizeLead}=await import('/core.js');let lead=fixture.leads.find(l=>l.id===item.existingLeadId),created=!lead;
   if(!lead){lead=normalizeLead({...item,source:item.sourceUrl,id:'osm-'+item.id.replace('/','-'),pageTemplate:'studio',phone:item.whatsapp,discovery:{provider:'osm',externalId:item.id},research:{origin:'ai',websiteAssessment:item.websiteAssessment,confidence:'medium',priority:'medium',summary:'Dados fictícios de QA.',opportunity:'Avaliar uma página.',missing:['Confirmar os dados.'],sources:[{url:item.sourceUrl,title:'OpenStreetMap',kind:'directory'}],queries:['Pesquisa de teste'],aiStatus:'needs_review'}});lead._revision=1;lead.assets=[];fixture.leads.push(lead);item.existingLeadId=lead.id;}
   return Response.json({created,matchedExisting:!created,archived:!!lead.archivedAt,lead:{id:lead.id,name:lead.name}});
  }
  return Response.json({error:'Google não configurado'},{status:503});
 };
})();
