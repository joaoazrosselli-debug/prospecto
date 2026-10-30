import {outreachQueue} from '../public/outreach.js';
import type {StudioAccess} from './studio-auth';
import {unpackRecord,type StudioRow} from './studio-records';

export async function getOutreach(access:StudioAccess){
  const rows=await access.db.prepare("SELECT * FROM studio_records WHERE kind IN ('lead','settings') ORDER BY key").all<StudioRow>();
  const leads=rows.results.filter(r=>r.kind==='lead').map(unpackRecord),settings=rows.results.find(r=>r.kind==='settings');
  const queue=outreachQueue(leads,settings?JSON.parse(settings.data):{});
  return {mode:'prepare_only',canSend:false,backgroundRunning:false,ready:queue.filter((r:any)=>r.ready).length,rows:queue};
}
