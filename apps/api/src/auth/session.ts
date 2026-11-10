import type {Env} from '../http.js';
import type {Viewer} from '../../../../packages/shared/src/index.js';

/**
 * Identity boundary. Transitional contract 2026-11-10.1:
 * real OIDC sign-in is deliberately disabled until the new central integration contract arrives.
 * This module never reads HGLOBAL_ID_CLIENT_SECRET or accepts browser-supplied identity in production.
 */
export async function getViewer(request:Request,env:Env):Promise<Viewer>{
 const host=new URL(request.url).hostname;
 if(env.MOCK_AUTH==='local-only'&&(host==='localhost'||host==='127.0.0.1')){
  const sub=request.headers.get('x-demo-sub');
  if(sub&&/^dev:[a-z0-9_-]{1,40}$/i.test(sub))return {sub};
 }
 return null;
}
