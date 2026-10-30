import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';

export class StudioFailure extends Error {
 constructor(public status:number,message:string,public details:Record<string,unknown>={}){super(message);}
}
export async function requireStudio(){
 const user=await getChatGPTUser();
 if(!user)throw new StudioFailure(401,'Entre com a conta convidada para acessar a base compartilhada.',{code:'signin'});
 if(!env.DB||!env.BUCKET)throw new StudioFailure(503,'O armazenamento ainda não foi conectado à hospedagem.');
 const ownerEmail=(env.PROSPECTO_OWNER_EMAIL||'').trim().toLowerCase();
 if(!ownerEmail)throw new StudioFailure(503,'O administrador ainda precisa ser configurado na hospedagem.');
 const isOwner=user.email.toLowerCase()===ownerEmail;
 if(!isOwner&&!await env.DB.prepare('SELECT email FROM studio_access WHERE email=?').bind(user.email.toLowerCase()).first())throw new StudioFailure(403,'Esta conta ainda não foi autorizada. Peça ao administrador para liberar o seu e-mail.',{code:'membership',email:user.email});
 return {user,db:env.DB,bucket:env.BUCKET,isOwner,ownerEmail};
}
export type StudioAccess=Awaited<ReturnType<typeof requireStudio>>;
