import {Platform} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import type {AppConfig,AppSignIn,AppTokenPair} from '../../../../packages/shared/src/central-api.generated';

export const CENTRAL_URL='https://id.hglobal1985.com';
export const APP_ID='learn';
export const INTEGRATION_VERSION='2026-11-10.2';
const REFRESH_KEY='hglobal.learn.refresh';
const WEB_PENDING='hglobal.learn.pending';
const WEB_DONE='https://learn.hglobal1985.com/auth/done';
const MOBILE_DONE='learn://auth/google';
let access:string|null=null;
let expiry=0;
let memberId:string|null=null;
let refreshInFlight:Promise<boolean>|null=null;
type Pending={nonce:string;state:string;redirect:string;created:number;returnTo:string};
let nativePending:Pending|null=null;

function randomHex(){return Array.from(Crypto.getRandomBytes(24),x=>x.toString(16).padStart(2,'0')).join('')}
function sanitizedPath(path:string){return path.startsWith('/')&&!path.startsWith('//')&&!path.includes('\\')?path:'/'}
async function setRefresh(token:string|null){
 if(Platform.OS==='web'){
  if(token)window.sessionStorage.setItem(REFRESH_KEY,token);
  else window.sessionStorage.removeItem(REFRESH_KEY);
 }else if(token)await SecureStore.setItemAsync(REFRESH_KEY,token);
 else await SecureStore.deleteItemAsync(REFRESH_KEY);
}
async function readRefresh(){
 return Platform.OS==='web'?window.sessionStorage.getItem(REFRESH_KEY):SecureStore.getItemAsync(REFRESH_KEY);
}
function parseError(response:Response,body:unknown):Error{
 const o=body as {error?:{code?:string;message?:string}}|null;
 const err=new Error(o?.error?.message||'登入服務目前無法使用');
 (err as Error&{code?:string;status?:number}).code=o?.error?.code||'central_error';
 (err as Error&{code?:string;status?:number}).status=response.status;
 return err;
}
export async function central<T>(path:string,method='GET',payload?:unknown,token?:string):Promise<T>{
 const response=await fetch(CENTRAL_URL+path,{
  method,headers:{...(payload?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},
  ...(payload?{body:JSON.stringify(payload)}:{})
 });
 if(!response.ok){let body:unknown=null;try{body=await response.json()}catch{}throw parseError(response,body)}
 return response.status===204?undefined as T:await response.json() as T;
}
export async function config():Promise<AppConfig>{
 const data=await central<AppConfig>('/v1/apps/learn/config');
 if(data.app_id!=='learn'||!['active','paused','killed'].includes(data.status))throw Error('App 登記狀態不正確');
 return data;
}
export function outdated(version:string,minVersion:string){
 const parse=(x:string)=>x.split('.').slice(0,3).map(s=>Number.parseInt(s,10)||0);
 const a=parse(version),b=parse(minVersion);
 for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]!<b[i]!}
 return false;
}
export function signedIn(){return !!access&&Date.now()<expiry}
export function currentMember(){return memberId}
export async function clearLocal(){
 access=null;expiry=0;memberId=null;nativePending=null;
 if(Platform.OS==='web')window.sessionStorage.removeItem(WEB_PENDING);
 await setRefresh(null);
}
async function remember(pair:AppTokenPair,sub?:string){
 // Persist rotating refresh token BEFORE allowing another authenticated request.
 await setRefresh(pair.refresh_token);
 access=pair.access_token;expiry=Date.now()+Math.max(0,pair.expires_in-30)*1000;
 if(sub)memberId=sub;
}
export async function refresh():Promise<boolean>{
 if(refreshInFlight)return refreshInFlight;
 refreshInFlight=(async()=>{
  const token=await readRefresh();
  if(!token)return false;
  try{
   const pair=await central<AppTokenPair>('/v1/auth/refresh','POST',{refresh_token:token});
   await remember(pair);return true;
  }catch{
   await clearLocal();return false;
  }
 })();
 try{return await refreshInFlight}finally{refreshInFlight=null}
}
export async function token():Promise<string|null>{
 if(signedIn())return access;
 return await refresh()?access:null;
}
export async function login():Promise<'redirecting'|'ok'|'cancelled'>{
 const app=await config();
 if(app.status!=='active')throw Error('目前正在維護中');
 const data=await central<{nonce:string;expires_in:number}>('/v1/auth/nonce','POST',{app_id:APP_ID});
 const pending:Pending={nonce:data.nonce,state:randomHex(),redirect:Platform.OS==='web'?WEB_DONE:MOBILE_DONE,created:Date.now(),returnTo:'/'};
 const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,data.nonce);
 const url=new URL(CENTRAL_URL+'/auth/google/start');
 url.searchParams.set('app_id',APP_ID);url.searchParams.set('nonce',digest.toLowerCase());url.searchParams.set('return',pending.redirect);url.searchParams.set('state',pending.state);
 if(Platform.OS==='web'){
  pending.returnTo=sanitizedPath(window.location.pathname+window.location.search);
  window.sessionStorage.setItem(WEB_PENDING,JSON.stringify(pending));
  window.location.assign(url.toString());return 'redirecting';
 }
 nativePending=pending;
 const result=await WebBrowser.openAuthSessionAsync(url.toString(),MOBILE_DONE);
 if(result.type!=='success'){nativePending=null;return 'cancelled'}
 const callback=new URL(result.url);
 const query=callback.searchParams;
 if(callback.protocol!=='learn:'||callback.hostname!=='auth'||callback.pathname!=='/google')throw Error('登入回傳網址無效');
 const ok=await finish(query,pending);
 nativePending=null;return ok?'ok':'cancelled';
}
async function finish(params:URLSearchParams,pending:Pending):Promise<boolean>{
 if(Date.now()-pending.created>600000||!pending.nonce||params.get('state')!==pending.state)throw Error('登入驗證已失效，請重新登入');
 if(params.get('error'))throw Error('登入取消或驗證失敗');
 const id_token=params.get('id_token');
 if(!id_token)throw Error('沒有取得登入驗證資料');
 const data=await central<AppSignIn>('/v1/auth/google','POST',{app_id:APP_ID,id_token,nonce:pending.nonce});
 if(data.user.status!=='active'||!data.user.member_id){await clearLocal();throw Error('會員尚未啟用')}
 await remember(data,data.user.member_id);
 return true;
}
export async function finishWebReturn():Promise<string|null>{
 if(Platform.OS!=='web'||window.location.pathname!=='/auth/done')return null;
 const fragment=window.location.hash;
 window.history.replaceState(null,'',window.location.pathname);
 const stored=window.sessionStorage.getItem(WEB_PENDING);
 window.sessionStorage.removeItem(WEB_PENDING);
 if(!stored)throw Error('缺少登入驗證狀態');
 let pending:Pending;
 try{pending=JSON.parse(stored) as Pending}catch{throw Error('登入狀態無效')}
 await finish(new URLSearchParams(fragment.slice(1)),pending);
 return sanitizedPath(pending.returnTo);
}
export async function authorized<T>(path:string,method='GET',payload?:unknown):Promise<T>{
 let a=await token();if(!a)throw Error('請先登入 H-Global1985');
 try{return await central<T>(path,method,payload,a)}
 catch(err){
  if((err as Error&{status?:number}).status!==401)throw err;
  if(!await refresh())throw Error('登入已失效，請重新登入');
  a=access;if(!a)throw Error('請重新登入');
  return await central<T>(path,method,payload,a);
 }
}
export async function logout(all=false):Promise<void>{
 try{
  const a=await token();
  if(a)await central('/v1/auth/'+(all?'logout-all':'logout'),'POST',undefined,a);
 }finally{await clearLocal()}
}
