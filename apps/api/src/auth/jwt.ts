/** Central-member RS256 access-token validation. No secrets, credentials, or user data are logged. */
const ISSUER='https://id.hglobal1985.com';
const JWKS_URL=ISSUER+'/oauth/jwks';
type JWK={kty:string;kid?:string;alg?:string;use?:string;n?:string;e?:string};
type Claims={sub:string;iss:string;aud:string;app_id:string;exp:number;nbf?:number;iat?:number;scope?:string};
const cached=new Map<string,{key:CryptoKey;until:number}>();
let pending:Promise<void>|null=null;
const decode=(value:string):unknown=>{
 const s=value.replace(/-/g,'+').replace(/_/g,'/');
 return JSON.parse(atob(s+'='.repeat((4-s.length%4)%4)));
};
async function loadKeys(force=false):Promise<void>{
 if(!force&&[...cached.values()].some(x=>x.until>Date.now()))return;
 if(pending)return pending;
 pending=(async()=>{
  const response=await fetch(JWKS_URL,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('jwks_unavailable');
  const body=await response.json() as {keys?:JWK[]};
  if(!Array.isArray(body.keys))throw Error('invalid_jwks');
  const entries:{kid:string;key:CryptoKey}[]=[];
  for(const jwk of body.keys){
   if(jwk.kty!=='RSA'||!jwk.kid||!jwk.n||!jwk.e||jwk.use&&jwk.use!=='sig'||jwk.alg&&jwk.alg!=='RS256')continue;
   const key=await crypto.subtle.importKey('jwk',jwk as JsonWebKey,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
   entries.push({kid:jwk.kid,key});
  }
  if(!entries.length)throw Error('empty_jwks');
  cached.clear();for(const x of entries)cached.set(x.kid,{key:x.key,until:Date.now()+600000});
 })();
 try{await pending}finally{pending=null}
}
export async function verifyCentralAccessToken(token:string):Promise<Claims|null>{
 try{
  if(token.length>8192||token.length<100||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))return null;
  const [h,p,s]=token.split('.');
  const header=decode(h!) as {alg?:string;typ?:string;kid?:string};
  if(header.alg!=='RS256'||header.typ!=='at+jwt'||!header.kid)return null;
  let entry=cached.get(header.kid);
  if(!entry||entry.until<=Date.now()){await loadKeys(true);entry=cached.get(header.kid)}
  if(!entry)return null;
  const sig=s!.replace(/-/g,'+').replace(/_/g,'/');
  const bin=atob(sig+'='.repeat((4-sig.length%4)%4));
  const signature=Uint8Array.from(bin,c=>c.charCodeAt(0));
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',entry.key,signature,new TextEncoder().encode(h+'.'+p));
  if(!ok)return null;
  const payload=decode(p!) as Claims;
  const now=Math.floor(Date.now()/1000);
  if(payload.iss!==ISSUER||payload.aud!==ISSUER||payload.app_id!=='learn'||!payload.sub||typeof payload.sub!=='string'||payload.sub.length>128||typeof payload.exp!=='number'||payload.exp<=now||payload.nbf&&payload.nbf>now)return null;
  return payload;
 }catch{return null}
}
export function bearer(request:Request):string|null{
 const m=/^Bearer ([-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+)$/.exec(request.headers.get('authorization')||'');
 return m?.[1]??null;
}
