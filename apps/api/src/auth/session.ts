import type {Env} from '../http.js';
import type {Viewer} from '../../../../packages/shared/src/index.js';
import {bearer,verifyCentralAccessToken} from './jwt.js';
/** Only signed, unexpired Central-issued learn tokens count as a real identity. */
export async function getViewer(request:Request,env:Env):Promise<Viewer>{
 const host=new URL(request.url).hostname;
 if(env.MOCK_AUTH==='local-only'&&(host==='localhost'||host==='127.0.0.1')){
  const sub=request.headers.get('x-demo-sub');
  if(sub&&/^dev:[a-z0-9_-]{1,40}$/i.test(sub))return {sub};
 }
 const token=bearer(request);
 if(!token)return null;
 const claims=await verifyCentralAccessToken(token);
 return claims?{sub:claims.sub}:null;
}
