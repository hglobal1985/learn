import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker.mjs';
const videos=[
 {id:'pub001',title:'公開課程',description:'實用的內容',category:'營養',source_type:'youtube',source_id:'dQw4w9WgXcQ',status:'published',access_mode:'public'},
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
 assert.match(await r.text(),/youtube-nocookie.com\\/embed/);
});
test('members and rank direct links fail closed',async()=>{
 for(const id of ['mem001','rank001','draft01']){
  const r=await request('/'+id);assert.equal(r.status,403);
  assert.doesNotMatch(await r.text(),/不可對外|secretID/);
 }
});
test('API never reveals member content to unauthenticated visitors',async()=>{
 const r=await request('/v1/videos');const result=await r.json();
 assert.deepEqual(result.videos.map(x=>x.id),['pub001']);assert.equal(result.total,1);
 assert.equal((await request('/v1/videos/mem001')).status,403);
});
test('all mutations remain blocked while central OAuth is unavailable',async()=>{
 const r=await request('/v1/videos','POST');assert.equal(r.status,401);
 assert.equal((await request('/v1/videos/pub001/playback','POST')).status,401);
});
test('health reports unfinished authentication honestly',async()=>{
 const r=await request('/v1/health');assert.deepEqual((await r.json()).central_auth,'pending');
});
test('missing database fails closed without exposing internals',async()=>{
 const r=await request('/v1/videos','GET',{});assert.equal(r.status,503);
});
