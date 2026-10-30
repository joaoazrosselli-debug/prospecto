export function reviewLeadId(search=''){
  const id=new URLSearchParams(search).get('revisar')||'';
  return /^[\w-]{1,80}$/.test(id)?id:'';
}
export function reviewLink(id,origin){
  if(!/^[\w-]{1,80}$/.test(id))throw Error('Empresa inválida para revisão.');
  return origin+'/?revisar='+encodeURIComponent(id)+'#producao';
}
