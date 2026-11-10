import type {Env} from '../http.js';
import type {EligibilityCheck} from '../../../../packages/shared/src/index.js';
import {bearer} from '../auth/jwt.js';
const CENTRAL='https://id.hglobal1985.com';
/** Local-only test hook; never enabled on a public hostname. */
export function demoEligible(req:Request,env:Env):boolean{
 const host=new URL(req.url).hostname;
 return env.MOCK_AUTH==='local-only'&&(host==='localhost'||host==='127.0.0.1')&&req.headers.get('x-demo-eligible')==='true';
}
/** Ask Central for every rank check. Fail closed on all errors; don't persist eligibility. */
export async function centralCheck(req:Request,env:Env,rule:Parameters<EligibilityCheck>[0],sub:string):Promise<boolean>{
 if(!sub||!rule||!['everyone','hglobal_verified'].includes(rule.audience))return false;
 if(rule.audience==='everyone'&&rule.min_rank!=null)return false;
 if(demoEligible(req,env))return true;
 const access=bearer(req);
 if(!access)return false;
 try{
  const response=await fetch(CENTRAL+'/v1/eligibility/check',{
   method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},
   body:JSON.stringify({rule}),signal:AbortSignal.timeout(5000)
  });
  if(!response.ok)return false;
  const data=await response.json() as {allowed?:unknown};
  return data.allowed===true;
 }catch{return false}
}
