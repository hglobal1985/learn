import {assert, type Env} from './http.js';
import type {AdminPermission,Viewer} from '../../../packages/shared/src/index.js';
export {getViewer} from './auth/session.js';
export {centralCheck,demoEligible} from './access/eligibility.js';
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
  const bearer=/^Bearer\s+\S+$/i.test(req.headers.get('authorization')||'');
  assert(demo||bearer,403,'origin_required','請求缺少來源驗證');
  return;
 }
 const allowed=env.WEB_ORIGIN||`${u.protocol}//${u.host}`;
 const demo=env.MOCK_AUTH==='local-only'&&['localhost','127.0.0.1'].includes(u.hostname);
 assert(origin===allowed||(demo&&origin.startsWith('http://localhost:')),403,'origin_denied','不允許此請求來源');
}
export function isOwnedComment(author:string,sub:string|null):boolean{return !!sub&&author===sub}
