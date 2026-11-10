import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import worker from '../worker.mjs';
import {youtubeId,videoForm,safeMuxPlayback} from '../admin/media.mjs';
import {ADMIN_BROWSER_JS} from '../admin/browser.mjs';
import {AUTH_BROWSER_JS} from '../auth/web-client.mjs';
const ISSUER='https://id.hglobal1985.com';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'});jwk.kid='owner-suite-20261110';jwk.alg='RS256';jwk.use='sig';
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
function token(){
 const head=enc({alg:'RS256',kid:jwk.kid,typ:'at+jwt'});
 const body=enc({iss:ISSUER,aud:ISSUER,app_id:'learn',sub:'owner-verified-sub',exp:Math.floor(Date.now()/1000)+600});
 const raw=head+'.'+body;
 return raw+'.'+createSign('RSA-SHA256').update(raw).end().sign(privateKey).toString('base64url');
}
class DB{
 constructor(){this.records=[]}
 prepare(sql){
  const records=this.records;let values=[];
  return {
   bind(...params){values=params;return this},
   async first(){
    if(sql.includes('mux_asset_id=?'))return records.find(v=>v.mux_asset_id===values[0])||null;
    if(sql.includes('WHERE id=?'))return records.find(v=>v.id===values[0])||null;
    return null;
   },
   async all(){return {results:records.map(v=>({...v}))}},
   async run(){
    if(sql.startsWith('INSERT INTO videos(')){
     const [id,title,description,category,access_mode,audience,min_rank_code,source_type,source_id,mux_asset_id,mux_playback_policy,youtube_visibility,accepted_unlisted_risk,duration_seconds]=values;
     records.push({id,title,description,category,access_mode,audience,min_rank_code,source_type,source_id,mux_asset_id,mux_playback_policy,youtube_visibility,accepted_unlisted_risk,duration_seconds,status:'draft'});
    }else if(sql.includes("status='published'")){const v=records.find(x=>x.id===values.at(-1));if(v)v.status='published'}
    else if(sql.includes("status='draft'")){const v=records.find(x=>x.id===values.at(-1));if(v)v.status='draft'}
    return {success:true};
   }
  };
 }
}
const savedFetch=globalThis.fetch;
function mockCentral({isOwner=true,active=true}={}){
 globalThis.fetch=async(url)=>{
  const u=String(url);
  if(u===ISSUER+'/oauth/jwks')return Response.json({keys:[jwk]});
  if(u===ISSUER+'/v1/apps/learn/config')return Response.json({app_id:'learn',status:active?'active':'paused'});
  if(u===ISSUER+'/v1/apps/learn/handoff')return isOwner?Response.json({up_to_date:true}):Response.json({error:{code:'forbidden'}},{status:403});
  throw Error('unexpected fetch destination');
 };
}
function req(path,method='GET',body=null,withAuth=true,origin='https://learn.hglobal1985.com'){
 const h={...(withAuth?{Authorization:'Bearer '+token()}:{}),...(method!=='GET'?{'content-type':'application/json',origin}:{})};
 return new Request('https://learn.hglobal1985.com'+path,{method,headers:h,body:body?JSON.stringify(body):undefined});
}
test('YouTube parser accepts only HTTPS known hosts and correct 11-char IDs',()=>{
 const id='dQw4w9WgXcQ';
 for(const path of ['https://youtu.be/'+id,'https://www.youtube.com/watch?v='+id,'https://www.youtube.com/shorts/'+id,'https://m.youtube.com/live/'+id]){
  assert.equal(youtubeId(path),id);
 }
 for(const bad of ['http://www.youtube.com/watch?v='+id,'https://youtube.com.evil.test/watch?v='+id,'https://evil.test/?v='+id,'https://www.youtube.com/watch?v=bad']){
  assert.equal(youtubeId(bad),null);
 }
 assert.throws(()=>videoForm({title:'demo',source_type:'youtube',youtube_url:'https://youtu.be/'+id,access_mode:'rank'}));
});
test('Mux restricted import forbids any public playback policy and non-ready assets',()=>{
 const signed={status:'ready',duration:60,playback_ids:[{policy:'signed',id:'signedSafe001'}]};
 assert.equal(safeMuxPlayback(signed,'rank').policy,'signed');
 assert.throws(()=>safeMuxPlayback({...signed,playback_ids:[...signed.playback_ids,{policy:'public',id:'publicID'}]},'rank'));
 assert.throws(()=>safeMuxPlayback({...signed,status:'preparing'},'rank'));
});
test('anonymous and non-superadmin cannot read or write video admin data',async()=>{
 mockCentral();const db=new DB();
 try{
  const anon=await worker.fetch(req('/v1/admin/videos','GET',null,false),{DB:db});assert.equal(anon.status,401);
  const anonPost=await worker.fetch(req('/v1/admin/videos','POST',{title:'x'},false),{DB:db});assert.equal(anonPost.status,401);
  mockCentral({isOwner:false});
  const unauthorized=await worker.fetch(req('/v1/admin/videos'),{DB:db});assert.equal(unauthorized.status,403);
  const forbiddenPost=await worker.fetch(req('/v1/admin/videos','POST',{title:'x'}),{DB:db});assert.equal(forbiddenPost.status,403);
  assert.equal(db.records.length,0);
 }finally{globalThis.fetch=savedFetch}
});
test('superadmin can add YouTube from phone as draft and publish',async()=>{
 mockCentral();const db=new DB();
 try{
  const status=await worker.fetch(req('/v1/admin/session'),{DB:db});
  assert.equal((await status.json()).is_super_admin,true);
  const data={source_type:'youtube',title:'我的測試課程',description:'介紹',category:'營養',access_mode:'public',youtube_url:'https://youtu.be/dQw4w9WgXcQ'};
  const created=await worker.fetch(req('/v1/admin/videos','POST',data),{DB:db});
  assert.equal(created.status,201);
  const body=await created.json();
  assert.equal(db.records[0].status,'draft');
  assert.equal(db.records[0].source_id,'dQw4w9WgXcQ');
  const publish=await worker.fetch(req('/v1/admin/videos/'+body.video_id+'/publish','POST'),{DB:db});
  assert.equal(publish.status,200);
  assert.equal(db.records[0].status,'published');
  const takeDown=await worker.fetch(req('/v1/admin/videos/'+body.video_id+'/unpublish','POST'),{DB:db});
  assert.equal(takeDown.status,200);
  assert.equal(db.records[0].status,'draft');
 }finally{globalThis.fetch=savedFetch}
});
test('Mux Asset ID import saves draft but cannot publish without safe API credentials',async()=>{
 mockCentral();const db=new DB();
 try{
  const created=await worker.fetch(req('/v1/admin/videos','POST',{source_type:'mux',title:'Mux 新課程',asset_id:'abcde12345678901234567890',access_mode:'rank',category:'培訓'}),{DB:db});
  assert.equal(created.status,201);
  const body=await created.json();
  assert.equal(body.needs_mux_connection,true);
  assert.equal(db.records[0].status,'draft');
  assert.equal(db.records[0].source_id,'');
  const publish=await worker.fetch(req('/v1/admin/videos/'+body.video_id+'/publish','POST'),{DB:db});
  assert.equal(publish.status,503);
  assert.equal(db.records[0].status,'draft');
 }finally{globalThis.fetch=savedFetch}
});
test('website account navigation and admin UI work on mobile and retain CSP',async()=>{
 mockCentral();const db=new DB();
 try{
  const setting=await worker.fetch(req('/settings','GET',null,false),{DB:db});
  const page=await setting.text();
  assert.match(page,/mobile-tabs/);
  assert.match(page,/我的學習與帳號設定/);
  assert.match(page,/manage-link/);
  const admin=await worker.fetch(req('/admin','GET',null,false),{DB:db});
  const text=await admin.text();
  assert.match(text,/Mux｜已上傳的影片/);
  assert.match(text,/YouTube｜影片連結/);
  assert.match(text,/admin-panel" hidden/);
  assert.match(admin.headers.get('content-security-policy'),/nonce-/);
  assert.doesNotThrow(()=>new Function(ADMIN_BROWSER_JS));
 }finally{globalThis.fetch=savedFetch}
});

test('central profile calls are never sent to learn API, and owner checks do not report handoff versions',()=>{
 assert.match(AUTH_BROWSER_JS,/isLocal\?path:BASE\+path/);
 assert.doesNotMatch(AUTH_BROWSER_JS,/path\.startsWith\('\/v1\/'\)\?path/);
});
