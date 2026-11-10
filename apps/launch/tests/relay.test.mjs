import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {getViewer,allowed} from '../auth/backend.mjs';
import worker from '../worker.mjs';

const issuer='https://id.hglobal1985.com';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'});jwk.kid='relay-test-001';jwk.alg='RS256';jwk.use='sig';
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const make=(overrides={},typ='at+jwt')=>{
 const head=enc({alg:'RS256',kid:jwk.kid,typ});
 const claims=enc({iss:issuer,aud:issuer,app_id:'learn',sub:'member100',exp:Math.floor(Date.now()/1000)+600,...overrides});
 const body=head+'.'+claims;return body+'.'+createSign('RSA-SHA256').update(body).end().sign(privateKey).toString('base64url');
};
const fakeReq=(token)=>new Request('https://learn.hglobal1985.com/v1/videos/rank001',{headers:{Authorization:'Bearer '+token}});
const original=globalThis.fetch;
test('live Worker verifies Central-signed access JWT, never x-demo-sub on production',async()=>{
 globalThis.fetch=async(url)=>{
  assert.equal(url,issuer+'/oauth/jwks');
  return Response.json({keys:[jwk]});
 };
 try{
  const t=make();
  assert.deepEqual(await getViewer(fakeReq(t)),{sub:'member100'});
  assert.equal(await getViewer(fakeReq(make({iss:'https://attacker.test'}))),null);
  assert.equal(await getViewer(fakeReq(make({aud:'bad'}))),null);
  assert.equal(await getViewer(fakeReq(make({app_id:'other'}))),null);
  assert.equal(await getViewer(fakeReq(make({exp:1}))),null);
  assert.equal(await getViewer(fakeReq(make({},'JWT'))),null);
  assert.equal(await getViewer(new Request('https://learn.hglobal1985.com/v1/session',{headers:{'x-demo-sub':'dev:owner'}})),null);
 }finally{globalThis.fetch=original}
});
test('rank check fails closed and requires verified token and Central approval',async()=>{
 const v={id:'rank001',title:'restricted',description:'',access_mode:'rank',audience:'hglobal_verified',min_rank_code:'gold',status:'published'};
 const req=fakeReq(make()),viewer={sub:'member100'};
 globalThis.fetch=async(url,init)=>{
  if(String(url).endsWith('/v1/apps/learn/config'))return Response.json({app_id:'learn',status:'active'});
  if(String(url).endsWith('/v1/eligibility/check')){
   assert.match(init.headers.Authorization,/^Bearer /);return Response.json({allowed:true,reason:'ok'});
  }
  throw Error('unexpected');
 };
 try{
  assert.equal(await allowed(req,v,viewer),true);
  assert.equal(await allowed(req,v,null),false);
  assert.equal(await allowed(req,{...v,min_rank_code:'gold',audience:'everyone'},viewer),false);
  globalThis.fetch=async()=>new Response(null,{status:503});
  assert.equal(await allowed(req,v,viewer),false);
 }finally{globalThis.fetch=original}
});
test('no raw video playback ID, title or Mux token returned for unauthorized rank',async()=>{
 const id='private000',db={prepare(sql){let params=[];return {bind(...p){params=p;return this},async first(){return {id,title:'私密影片',access_mode:'rank',audience:'hglobal_verified',min_rank_code:'gold',status:'published',source_type:'mux',source_id:'secret123',mux_playback_policy:'signed'}},async all(){return {results:[]}}}}};
 const req=new Request('https://learn.hglobal1985.com/v1/videos/'+id);
 const res=await worker.fetch(req,{DB:db});
 assert.equal(res.status,403);
 const body=await res.text();
 assert.doesNotMatch(body,/私密影片|secret123|playback_token/);
});
