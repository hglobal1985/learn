import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import worker from '../worker.mjs';
import {AUTH_BROWSER_JS} from '../auth/web-client.mjs';

const issuer='https://id.hglobal1985.com';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'});
jwk.kid='superadmin-preview-test';jwk.use='sig';jwk.alg='RS256';
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const bearer=()=>{
 const h=encode({alg:'RS256',typ:'at+jwt',kid:jwk.kid});
 const p=encode({iss:issuer,aud:issuer,app_id:'learn',sub:'approved-member-sub',exp:Math.floor(Date.now()/1000)+600});
 const unsigned=h+'.'+p;
 return unsigned+'.'+createSign('RSA-SHA256').update(unsigned).end().sign(privateKey).toString('base64url');
};
const restricted={
 id:'jade20261108',title:'線上翡翠達標班 2026/11/8',description:'金章以上限定',
 access_mode:'rank',audience:'hglobal_verified',min_rank_code:'gold',category:'培訓',
 source_type:'mux',source_id:'aSecretSignedPlaybackId',mux_playback_policy:'signed',
 mux_asset_id:'hiddenAsset',status:'published',created_at:'2026-11-10T10:19:06+08:00'
};
const draft={...restricted,id:'draft0001',title:'尚未發布的秘密課程',status:'draft'};
const database={
 prepare(sql){
  return {
   bind(){return this},
   async all(){
    if(sql.includes('SELECT DISTINCT category'))return {results:[]};
    if(sql.includes("WHERE status='published'")){
     return {results:sql.includes("AND access_mode='public'")?[]:[restricted]};
    }
    return {results:[]};
   },
   async first(){return restricted}
  };
 }
};
const req=(path,authenticated=false,method='GET')=>new Request('https://learn.hglobal1985.com'+path,{
 method,headers:authenticated?{Authorization:'Bearer '+bearer()}:{}
});
const original=globalThis.fetch;
function mockCentral({superadmin=true,eligible=false,status='active',failRole=false}={}){
 globalThis.fetch=async(url)=>{
  const path=String(url);
  if(path===issuer+'/oauth/jwks')return Response.json({keys:[jwk]});
  if(path===issuer+'/v1/apps/learn/config')return Response.json({app_id:'learn',status});
  if(path===issuer+'/v1/eligibility/check')return Response.json({allowed:eligible,reason:'not_exposed'});
  if(path===issuer+'/v1/apps/learn/handoff'){
   if(failRole)return new Response(null,{status:503});
   return superadmin?Response.json({app_id:'learn',up_to_date:true}):
    Response.json({error:{code:'forbidden'}},{status:403});
  }
  throw Error('Unexpected external URL in test');
 };
}
test('Central-verified superadmin can discover published rank-restricted course without an Amway award',async()=>{
 mockCentral({superadmin:true,eligible:false});
 try{
  const r=await worker.fetch(req('/v1/videos',true),{DB:database});
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.admin_preview,true);
  assert.equal(data.videos.length,1);
  assert.equal(data.videos[0].title,restricted.title);
  assert.doesNotMatch(JSON.stringify(data),/aSecretSignedPlaybackId|hiddenAsset/);
  const detail=await worker.fetch(req('/v1/videos/jade20261108',true),{DB:database});
  assert.equal(detail.status,200);
  assert.equal((await detail.json()).video.title,restricted.title);
 }finally{globalThis.fetch=original}
});
test('unauthenticated visitor cannot discover or read published private course',async()=>{
 mockCentral();
 try{
  const listing=await worker.fetch(req('/v1/videos'),{DB:database});
  assert.equal((await listing.json()).videos.length,0);
  const detail=await worker.fetch(req('/v1/videos/jade20261108'),{DB:database});
  assert.equal(detail.status,403);
  const player=await worker.fetch(req('/v1/videos/jade20261108/playback',false,'POST'),{DB:database});
  assert.equal(player.status,403);
 }finally{globalThis.fetch=original}
});
test('ordinary member not qualified and not admin remains forbidden',async()=>{
 mockCentral({superadmin:false,eligible:false});
 try{
  const listing=await worker.fetch(req('/v1/videos',true),{DB:database});
  assert.equal((await listing.json()).videos.length,0);
  const detail=await worker.fetch(req('/v1/videos/jade20261108',true),{DB:database});
  assert.equal(detail.status,403);
  const player=await worker.fetch(req('/v1/videos/jade20261108/playback',true,'POST'),{DB:database});
  assert.equal(player.status,403);
 }finally{globalThis.fetch=original}
});
test('eligible ordinary member still sees rank-restricted course without admin override',async()=>{
 mockCentral({superadmin:false,eligible:true});
 try{
  const response=await worker.fetch(req('/v1/videos',true),{DB:database});
  const payload=await response.json();
  assert.equal(payload.admin_preview,false);
  assert.equal(payload.videos.length,1);
 }finally{globalThis.fetch=original}
});
test('superadmin override fails closed when Central app paused or role API unavailable',async()=>{
 for(const config of [{superadmin:true,eligible:false,status:'paused'},{superadmin:true,eligible:false,failRole:true}]){
  mockCentral(config);
  try{
   const response=await worker.fetch(req('/v1/videos',true),{DB:database});
   const payload=await response.json();
   assert.equal(payload.videos.length,0);
   const detail=await worker.fetch(req('/v1/videos/jade20261108',true),{DB:database});
   assert.equal(detail.status,403);
  }finally{globalThis.fetch=original}
 }
});
test('published-only API never allows superadmin to open draft by direct video ID',async()=>{
 mockCentral({superadmin:true,eligible:false});
 const db={prepare(){return {bind(){return this},async first(){return draft},async all(){return {results:[draft]}}}}};
 try{
  const detail=await worker.fetch(req('/v1/videos/draft0001',true),{DB:db});
  assert.equal(detail.status,403);
 }finally{globalThis.fetch=original}
});
test('browser updates authenticated category chips and clearly labels admin editorial previews',()=>{
 assert.match(AUTH_BROWSER_JS,/data\.admin_preview/);
 assert.match(AUTH_BROWSER_JS,/超級管理員預覽/);
 assert.match(AUTH_BROWSER_JS,/data\.videos\.map\(v=>v\.category\)/);
 assert.doesNotThrow(()=>new Function(AUTH_BROWSER_JS));
});
