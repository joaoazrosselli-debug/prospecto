import {z} from 'zod';
import {normalizeLead} from '../public/core.js';
import {StudioFailure,type StudioAccess} from './studio-auth';
import {unpackRecord,type StudioRow} from './studio-records';

export const testBusinessSchema=z.object({
  owner_name:z.string().max(100).optional(),
  business_phone:z.string().max(30).optional(),
  contact_email:z.string().email().max(254).optional(),
}).strict();

export async function createTestBusiness(access:StudioAccess,raw:unknown){
  const input=testBusinessSchema.parse(raw),id='test-jzincu-fitness',key='lead:'+id;
  const existing=await access.db.prepare('SELECT * FROM studio_records WHERE key=?').bind(key).first<StudioRow>();
  if(existing){if(!JSON.parse(existing.data).isTest)throw new StudioFailure(409,'Já existe uma ficha real com este identificador. Nenhuma informação foi alterada.');return {created:false,lead:unpackRecord(existing),published:false};}
  const products=[
    ['legging-movimento','Legging Movimento','Cintura alta, modelagem ajustada e tecido com elasticidade. Cores propostas: ameixa e preto.',159.9,'peça'],
    ['top-ritmo','Top Ritmo','Alças largas e faixa de sustentação. Tamanhos ilustrativos P, M, G e GG.',89.9,'peça'],
    ['camiseta-respiro','Camiseta Respiro','Modelagem solta para treinar ou usar no dia a dia. Proposta em algodão com elastano.',79.9,'peça'],
    ['short-passada','Short Passada','Cós com ajuste e bolso lateral. Modelo fictício para caminhada e corrida.',119.9,'peça'],
    ['mini-bands','Kit Mini Bands','Três faixas de resistência em intensidades diferentes. Catálogo demonstrativo.',49.9,'kit'],
    ['garrafa-600','Garrafa 600 ml','Proposta de garrafa reutilizável com tampa de rosca. Capacidade ilustrativa.',69.9,'unidade'],
  ].map(([id,title,description,price,unit])=>({id,title,description,price,unit,kind:'product',priceMode:'fixed'}));
  const data=normalizeLead({id,name:'Jzincu Fitness',isTest:true,city:'Curitiba / PR',neighborhood:'Bairro Alto',sector:'Roupas e acessórios fitness',businessPhone:input.business_phone||'',email:input.contact_email||'',
    headline:'Seu treino começa no que te acompanha.',subtitle:'Roupas e acessórios para colocar o corpo em movimento. Explore o catálogo e monte sua combinação.',
    services:'Roupas fitness\nAcessórios de treino\nAtendimento para consultar tamanhos e cores',
    description:'Loja fictícia de roupas e acessórios fitness criada para testar o Prospecto. Produtos, preços, horários e operação são ilustrativos. Não recebe pedidos reais.',
    about:'A Jzincu Fitness é uma proposta de marca local: peças para o treino e para o caminho até ele. Este catálogo demonstra uma seleção de roupas e acessórios, sem estoque real.',
    area:'Bairro Alto e Bacacheri, em Curitiba; Colombo / PR — cenário de teste',
    hours:'Segunda a sexta, das 9h às 18h; sábado, das 9h às 13h — horários fictícios',
    audience:'Pessoas que buscam roupas e acessórios para a rotina de treino',goal:'Explorar o catálogo e simular uma consulta de produto',
    faq:'A loja está funcionando? | Não. Esta é uma loja fictícia usada para testar o Prospecto.\nOs preços são reais? | Não. Todos os valores são ilustrativos e não constituem uma oferta comercial.\nComo consultar tamanhos? | A página demonstra o fluxo de consulta, sem reservar estoque ou confirmar pedidos.',
    cta:'Explorar o catálogo',brandStyle:'Marca esportiva independente. Ameixa escuro, papel claro e laranja queimado. Tipografia condensada, fotografia editorial de tecidos e catálogo funcional. Evitar neon, gradientes decorativos e promessas de performance.',
    palette:'#a84422',layout:'editorial',products,publicPrices:true,productionStatus:'production',pageScriptsEnabled:true,
    notes:`Teste solicitado pelo responsável do Prospecto.${input.owner_name?' Responsável: '+input.owner_name+'.':''} Não prospectar esta ficha, não incluir em vendas e não publicar dados pessoais.`,
  });
  const now=new Date().toISOString();
  const result=await access.db.prepare('INSERT OR IGNORE INTO studio_records(key,kind,data,revision,updated_at,updated_by) VALUES(?,?,?,1,?,?)').bind(key,'lead',JSON.stringify(data),now,access.user.userId).run();
  const row=await access.db.prepare('SELECT * FROM studio_records WHERE key=?').bind(key).first<StudioRow>();
  if(!row||!JSON.parse(row.data).isTest)throw new StudioFailure(409,'A ficha mudou durante a criação. Recarregue antes de continuar.');
  return {created:!!result.meta.changes,lead:unpackRecord(row),published:false};
}
