import type {Env} from '../http.js';
import type {EligibilityCheck} from '../../../../packages/shared/src/index.js';

/** Local-only test hook; never enabled on a public hostname. */
export function demoEligible(req:Request,env:Env):boolean{
 const host=new URL(req.url).hostname;
 return env.MOCK_AUTH==='local-only'&&(host==='localhost'||host==='127.0.0.1')&&req.headers.get('x-demo-eligible')==='true';
}

/** Central eligibility is fail-closed until a verified production login/session is available. */
export async function centralCheck(req:Request,env:Env,rule:Parameters<EligibilityCheck>[0],sub:string):Promise<boolean>{
 if(!sub||!rule||!['everyone','hglobal_verified'].includes(rule.audience))return false;
 if(rule.audience==='everyone'&&rule.min_rank!==null)return false;
 if(demoEligible(req,env))return true;
 return false;
}
