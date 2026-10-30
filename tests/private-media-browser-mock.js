(() => {
  const original=window.fetch;
  window.fetch=async (path,options={})=>{
    const url=new URL(typeof path==='string'?path:path.url,location.origin);
    const id=url.pathname.match(/^\/api\/files\/([\w-]+)$/)?.[1];
    const file=id&&fixture.qaFiles?.[id];
    if(file){const bytes=Uint8Array.from(atob(file.data),c=>c.charCodeAt(0));return new Response(bytes,{headers:{'Content-Type':file.mime}});}
    return original(path,options);
  };
})();
