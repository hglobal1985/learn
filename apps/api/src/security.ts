import {assert, type Env} from './http.js';
import type {AdminPermission,Viewer} from '../../../packages/shared/src/index.js';

export async function getViewer(request:Request,env:Env):Promise<Viewer>{
 const host=new URL(request.url).hostname;
 if(env.MOCK_AUTH==='local-only'&&(host==='localhost'||host==='127.0.0.1')){
  const demoSub=request.headers.get('x-demo-sub');
  if(demoSub&&/^dev:[a-z0-9_-]{1,40}$/i.test(demoSub))return {sub:demoSub};
 }
 // OAuth Code + PKCE and HttpOnly sessions remain disabled until the central contract exists.
 return null;
}
export function demoEligible(req:Request,env:Env):boolean{
 const hostname=new URL(req.url).hostname;
 return env.MOCK_AUTH==='local-only'&&['localhost','127.0.0.1'].includes(hostname)&&req.headers.get('x-demo-eligible')==='true';
}
export async function centralCheck(req:Request,env:Env,rule:{audience:'hglobal_verified';min_rank:string|null},sub:string):Promise<boolean>{
 if(!sub||!rule)return false;
 if(demoEligible(req,env))return true;
 // Deny until an authenticated central eligibility API is registered.
 return false;
}
const ALL:AdminPermission[]=['upload','videos.manage','videos.publish','videos.access','comments.moderate','admins.manage'];
export function validPermission(value:unknown):value is AdminPermission{return ALL.includes(value as AdminPermission)}
export async function requirePermission(env:Env,viewer:Viewer,permission:AdminPermission):Promise<string>{
 assert(viewer?.sub,401,'unauthenticated','請先登入');
 if(env.OWNER_SUB&&viewer.sub===env.OWNER_SUB)return viewer.sub;
 const grant=await env.DB.prepare('SELECT permission FROM admin_grants WHERE member_sub=? AND permission=?').bind(viewer.sub,permission).first();
 assert(grant,403,'forbidden','沒有管理權限');
 return viewer.sub;
}
export function validateMutationOrigin(req:Request,env:Env):void{
 if(['GET','HEAD','OPTIONS'].includes(req.method))return;
 const origin=req.headers.get('origin');
 const u=new URL(req.url);
 if(!origin){
  const demo=env.MOCK_AUTH==='local-only'&&['localhost','127.0.0.1'].includes(u.hostname);
  const bearer=/^Bearer [A-Za-z0-9._~+\\/-]+$/i.test(req.headers.get('authorization')||'');
  assert(demo||bearer,403,'origin_required','請求缺少來源驗證');
  return;
 }
 const allowed=env.WEB_ORIGIN||`${u.protocol}//${u.host}`;
 const demo=env.MOCK_AUTH==='local-only'&&['localhost','127.0.0.1'].includes(u.hostname);
 assert(origin===allowed||(demo&&origin.startsWith('http://localhost:')),403,'origin_denied','不允許此請求來源');
}
export function isOwnedComment(author:string,sub:string|null):boolean{return !!sub&&author===sub}
