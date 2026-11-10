const ISSUER='https://id.hglobal1985.com';
const keys=new Map();
let pending=null;
function parse(v){
 const b=v.replace(/-/g,'+').replace(/_/g,'/');
 return JSON.parse(atob(b+'='.repeat((4-b.length%4)%4)));
}
async function refreshJwks(){
 if(pending)return pending;
 pending=(async()=>{
  const r=await fetch(ISSUER+'/oauth/jwks',{signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw Error('jwks_unavailable');
  const data=await r.json();
  if(!Array.isArray(data.keys))throw Error('invalid_jwks');
  const found=[];
  for(const j of data.keys){
   if(j.kty!=='RSA'||!j.kid||j.use&&j.use!=='sig'||j.alg&&j.alg!=='RS256')continue;
   const key=await crypto.subtle.importKey('jwk',j,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
   found.push({kid:j.kid,key});
  }
  if(!found.length)throw Error('missing_jwks');
  keys.clear();for(const x of found)keys.set(x.kid,{key:x.key,until:Date.now()+600000});
 })();
 try{await pending}finally{pending=null}
}
export async function getViewer(req){
 try{
  const h=req.headers.get('authorization')||'';
  const match=/^Bearer ([-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+)$/.exec(h);
  if(!match||match[1].length>8192)return null;
  const [head,body,sig]=match[1].split('.');
  const header=parse(head);
  if(header.alg!=='RS256'||header.typ!=='at+jwt'||!header.kid)return null;
  let k=keys.get(header.kid);
  if(!k||k.until<Date.now()){await refreshJwks();k=keys.get(header.kid)}
  if(!k)return null;
  const s=sig.replace(/-/g,'+').replace(/_/g,'/');
  const bin=atob(s+'='.repeat((4-s.length%4)%4));
  const signature=Uint8Array.from(bin,c=>c.charCodeAt(0));
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',k.key,signature,new TextEncoder().encode(head+'.'+body)))return null;
  const claims=parse(body);const now=Math.floor(Date.now()/1000);
  if(claims.iss!==ISSUER||claims.aud!==ISSUER||claims.app_id!=='learn'||!claims.sub||typeof claims.sub!=='string'||typeof claims.exp!=='number'||claims.exp<=now||claims.nbf&&claims.nbf>now)return null;
  return {sub:claims.sub};
 }catch{return null}
}
export async function allowed(req,video,viewer){
 if(video.status!=='published')return false;
 if(video.access_mode==='public')return true;
 if(!viewer?.sub)return false;
 try{
  const r=await fetch(ISSUER+'/v1/apps/learn/config',{signal:AbortSignal.timeout(5000)});
  if(!r.ok||(await r.json()).status!=='active')return false;
 }catch{return false}
 if(video.access_mode==='members'){
  try{
   const r=await fetch(ISSUER+'/v1/me/profile',{headers:{Authorization:req.headers.get('authorization')||''},signal:AbortSignal.timeout(5000)});
   return r.ok;
  }catch{return false}
 }
 if(video.access_mode!=='rank')return false;
 const audience=video.audience||'hglobal_verified';
 if(!['everyone','hglobal_verified'].includes(audience)||audience==='everyone'&&video.min_rank_code!=null)return false;
 try{
  const auth=req.headers.get('authorization');
  if(!/^Bearer [-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(auth||''))return false;
  const r=await fetch(ISSUER+'/v1/eligibility/check',{method:'POST',headers:{Authorization:auth,'Content-Type':'application/json'},body:JSON.stringify({rule:{audience,min_rank:audience==='everyone'?null:video.min_rank_code}}),signal:AbortSignal.timeout(5000)});
  if(!r.ok)return false;const data=await r.json();return data.allowed===true;
 }catch{return false}
}
