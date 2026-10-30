(() => {
  const originalFetch = window.fetch;
  window.fetch = async (path, options = {}) => {
    if (path === '/api/outreach') {
      const { outreachQueue } = await import('/outreach.js');
      const rows = outreachQueue(fixture.leads, fixture.settings);
      return Response.json({mode:'prepare_only',canSend:false,backgroundRunning:false,ready:rows.filter(r=>r.ready).length,rows});
    }
    if (path === '/api/ai/test-store') {
      const existing=fixture.leads.find(l=>l.id==='test-jzincu-fitness');
      if(existing)return Response.json({created:false,lead:existing,published:false});
      const {normalizeLead}=await import('/core.js');
      const input=JSON.parse(options.body||'{}');
      const lead=normalizeLead({id:'test-jzincu-fitness',name:'Jzincu Fitness',isTest:true,city:'Curitiba / PR',sector:'Roupas e acessórios fitness',businessPhone:input.business_phone||'',email:input.contact_email||''});
      lead._revision=1;lead.assets=[];fixture.leads.push(lead);
      return Response.json({created:true,lead,published:false});
    }
    return originalFetch(path,options);
  };
})();
