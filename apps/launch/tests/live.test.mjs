import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
const videos=[
 {id:'pub001',title:'公開課程',description:'實用的內容',category:'營養',source_type:'youtube',source_id:'dQw4w9WgXcQ',status:'published',access_mode:'public'},
 {id:'muxpub01',title:'Mux 公開課程',description:'公開影片',category:'營養',source_type:'mux',source_id:'publicMux99',mux_playback_policy:'public',status:'published',access_mode:'public'},
 {id:'muxsign01',title:'Signed 公開課程',description:'安全授權',category:'營養',source_type:'mux',source_id:'signedPlaybackXYZ',mux_playback_policy:'signed',status:'published',access_mode:'public'},
 {id:'mem001',title:'會員內容',description:'不可對外',category:'培訓',source_type:'mux',source_id:'secretID',status:'published',access_mode:'members'},
 {id:'rank001',title:'限定內容',description:'不可對外',category:'培訓',source_type:'mux',source_id:'secretID',status:'published',access_mode:'rank'},
 {id:'draft01',title:'草稿資料',description:'不可顯示',category:'營養',source_type:'youtube',source_id:'dQw4w9WgXcQ',status:'draft',access_mode:'public'}
];
class DB{
 prepare(sql){let params=[];return {
  bind(...a){params=a;return this},
  async all(){
   if(sql.includes('SELECT DISTINCT category'))return {results:[{category:'營養'}]};
   if(sql.includes('FROM videos WHERE status'))return {results:videos.filter(v=>v.status==='published'&&v.access_mode==='public')};
   if(sql.includes('FROM comments'))return {results:[]};
   return {results:[]};
  },
  async first(){return videos.find(v=>v.id===params[0])||null}
 }}
}
const env={DB:new DB()};
const request=async(path,method='GET',db=env)=>worker.fetch(new Request('https://learn.hglobal1985.com'+path,{method}),db);
test('homepage renders public-only catalog, no fake accounts',async()=>{
 const r=await request('/');let body=await r.text();
 assert.equal(r.status,200);assert.match(body,/寰宇行動大學/);
 assert.match(body,/公開課程/);
 assert.doesNotMatch(body,/會員內容|限定內容|草稿資料|模擬管理員/);
 assert.match(r.headers.get('content-security-policy'),/nonce-/);
});
test('public direct root video path is a functional detail page',async()=>{
 const r=await request('/pub001');assert.equal(r.status,200);
 assert.ok((await r.text()).includes('youtube-nocookie.com/embed'));
});
test('public Mux embeds official browser-compatible iframe with safe thumbnail',async()=>{
 const home=await request('/');const markup=await home.text();
 assert.match(markup,/image\.mux\.com\/publicMux99\/thumbnail\.webp\?width=640/);
 assert.doesNotMatch(markup,/image\.mux\.com\/signedPlaybackXYZ|secretID/);
 const detail=await request('/muxpub01');const html=await detail.text();
 assert.equal(detail.status,200);
 assert.match(html,/https:\/\/player\.mux\.com\/publicMux99\?preload=none/);
 assert.doesNotMatch(html,/stream\.mux\.com\/publicMux99\.m3u8/);
 const csp=detail.headers.get('content-security-policy')||'';
 assert.match(csp,/frame-src[^;]*https:\/\/player\.mux\.com/);
 assert.match(csp,/img-src[^;]*https:\/\/image\.mux\.com/);
});
test('signed playback IDs are never placed in public thumbnails, players or API',async()=>{
 const page=await request('/muxsign01');assert.equal(page.status,200);
 const html=await page.text();
 assert.doesNotMatch(html,/signedPlaybackXYZ|player\.mux\.com\/signedPlaybackXYZ/);
 assert.match(html,/影片尚未提供播放/);
 const api=await request('/v1/videos/muxsign01');const json=await api.json();
 assert.equal(json.video.source_id,undefined);
 assert.doesNotMatch(JSON.stringify(json),/signedPlaybackXYZ/);
});
test('members and rank direct links fail closed',async()=>{
 for(const id of ['mem001','rank001','draft01']){
  const r=await request('/'+id);assert.equal(r.status,403);
  assert.doesNotMatch(await r.text(),/不可對外|secretID/);
 }
});
test('API never reveals member content to unauthenticated visitors',async()=>{
 const r=await request('/v1/videos');const result=await r.json();
 assert.deepEqual(result.videos.map(x=>x.id),['pub001','muxpub01','muxsign01']);assert.equal(result.total,3);
 assert.equal((await request('/v1/videos/mem001')).status,403);
});
test('mutations remain protected while publicly viewable YouTube is playable',async()=>{
 const r=await request('/v1/videos','POST');assert.equal(r.status,401);
 const p=await request('/v1/videos/pub001/playback','POST');
 assert.equal(p.status,200);assert.equal((await p.json()).type,'youtube');
 assert.equal((await request('/v1/videos/mem001/playback','POST')).status,403);
});
test('health reports 2026-11-10.2 relay without pretending to have credentials',async()=>{
 const r=await request('/v1/health');const body=await r.json();assert.equal(body.central_auth,'relay');assert.equal(body.contract_version,'2026-11-10.2');
});
test('production never authenticates via demo headers or legacy secret',async()=>{
 const fake={DB:new DB(),HGLOBAL_ID_CLIENT_SECRET:'legacy-not-used'};
 const r=await worker.fetch(new Request('https://learn.hglobal1985.com/v1/session',{headers:{'x-demo-sub':'dev:owner'}}),fake);
 assert.deepEqual(await r.json(),{authenticated:false,member_sub:null});
});
test('missing database fails closed without exposing internals',async()=>{
 const r=await request('/v1/videos','GET',{});assert.equal(r.status,503);
});

test('login relay and privacy routes render while server does not handle Google credentials',async()=>{
 for(const path of ['/login','/auth/done','/settings','/admin']){
  const r=await request(path);assert.equal(r.status,200);
  assert.match(r.headers.get('content-security-policy'),/id\.hglobal1985\.com/);
 }
 const s=await request('/settings');const body=await s.text();
 assert.match(body,/id\.hglobal1985\.com\/privacy/);
 assert.match(body,/申請刪除帳號/);
 assert.doesNotMatch(body,/HGLOBAL_ID_CLIENT_SECRET/);
});
