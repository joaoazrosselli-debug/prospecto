import type {StudioAccess} from './studio-auth';
import {createSite,assetPath} from '../public/landing.js';
export async function pageSnapshot(access:StudioAccess,lead:any){
 const rows=await access.db.prepare('SELECT id,name,mime,role,alt FROM studio_assets WHERE lead_id=? ORDER BY created_at').bind(lead.id).all();
 const assets=rows.results.map(a=>({...a,url:assetPath(a)}));
 return {html:createSite({...lead,assets}),css:'',js:'',scriptMode:'classic',scriptsEnabled:!!lead.pageScriptsEnabled};
}
