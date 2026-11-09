import {assert,type Env,HttpError} from './http.js';

async function muxApi<T>(env:Env,path:string,method='GET',body?:unknown):Promise<T>{
 assert(env.MUX_TOKEN_ID&&env.MUX_TOKEN_SECRET,503,'mux_not_configured','影片服務尚未設定');
 const basic=btoa(`${env.MUX_TOKEN_ID}:${env.MUX_TOKEN_SECRET}`);
 const r=await fetch(`https://api.mux.com/video/v1/${path}`,{
  method,headers:{Authorization:`Basic ${basic}`,...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });
 if(!r.ok)throw new HttpError(503,'mux_unavailable','影片服務暫時無法使用');
 return ((await r.json()) as {data:T}).data;
}
export async function inspectMuxAsset(env:Env,assetId:string):Promise<{status:string;playback_ids:{id:string;policy:string}[];duration?:number}>{
 assert(/^[A-Za-z0-9]+$/.test(assetId),422,'invalid_asset_id','無效的影片資產');
 return muxApi<{status:string;playback_ids:{id:string;policy:string}[];duration?:number}>(env,`assets/${encodeURIComponent(assetId)}`);
}
export async function createDirectUpload(env:Env,videoId:string,origin:string):Promise<{id:string;url:string}>{
 return muxApi<{id:string;url:string}>(env,'uploads','POST',{
  cors_origin:origin,
  new_asset_settings:{playback_policies:['signed'],passthrough:videoId,video_quality:'basic'}
 });
}
const encode=(v:unknown)=>btoa(JSON.stringify(v)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
function fromPem(pem:string):Uint8Array{
 const content=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const binary=atob(content);return Uint8Array.from(binary,x=>x.charCodeAt(0));
}
export async function signedPlaybackToken(env:Env,playbackId:string,audience:'v'|'t'='v',seconds=7200):Promise<string>{
 assert(env.MUX_SIGNING_KEY_ID&&env.MUX_SIGNING_PRIVATE_KEY,503,'mux_signing_unavailable','影片授權未設定');
 const header={alg:'RS256',typ:'JWT',kid:env.MUX_SIGNING_KEY_ID};
 const now=Math.floor(Date.now()/1000);
 const payload={sub:playbackId,aud:audience,exp:now+seconds,iat:now};
 const unsigned=`${encode(header)}.${encode(payload)}`;
 const key=await crypto.subtle.importKey('pkcs8',fromPem(env.MUX_SIGNING_PRIVATE_KEY).buffer as ArrayBuffer,
  {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const sig=new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
 const b64=btoa(String.fromCharCode(...sig)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 return `${unsigned}.${b64}`;
}
function hex(b:ArrayBuffer):string{return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}
export async function verifyWebhook(body:string,header:string|null,secret:string|undefined):Promise<boolean>{
 if(!secret||!header||!body)return false;
 const t=header.match(/(?:^|,)t=(\d+)/)?.[1];
 const sig=header.match(/(?:^|,)v1=([0-9a-f]{64})/i)?.[1];
 if(!t||!sig||Math.abs(Date.now()/1000-Number(t))>300)return false;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const actual=hex(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`${t}.${body}`)));
 let mismatch=0;for(let i=0;i<actual.length;i++)mismatch|=actual.charCodeAt(i)^sig.toLowerCase().charCodeAt(i);
 return mismatch===0;
}
