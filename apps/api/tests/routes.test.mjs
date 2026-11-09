import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../../../.build-tests/apps/api/src/index.js';
import {createHmac} from 'node:crypto';
const comments=[{id:'comment01',video_id:'public01',author_sub:'dev:member',parent_comment_id:null,body:'心得',status:'visible',created_at:'2026-11-10T01:00:00+08:00'}];
const videos=[
 {id:'public01',title:'公開影片',description:'',status:'published',access_mode:'public',min_rank_code:null,source_type:'youtube',source_id:'dQw4w9WgXcQ',category:'一般'},
 {id:'member01',title:'會員影片',description:'',status:'published',access_mode:'members',min_rank_code:null,source_type:'youtube',source_id:'dQw4w9WgXcQ',category:'一般'},
 {id:'rank001',title:'獎銜影片',description:'',status:'published',access_mode:'rank',min_rank_code:'15',source_type:'youtube',source_id:'dQw4w9WgXcQ',category:'一般'},
 {id:'draft001',title:'草稿',description:'',status:'draft',access_mode:'public',min_rank_code:null,source_type:'youtube',source_id:'dQw4w9WgXcQ',category:'一般'}
];
class Db{
 prepare(sql){return{
  bind(...args){this.args=args;return this},
  async first(){
   if(sql.includes('SELECT * FROM videos WHERE id'))return videos.find(x=>x.id===this.args?.[0])||null;
   if(sql.includes('SELECT * FROM comments WHERE id'))return comments.find(x=>x.id===this.args?.[0])||null;
   return null;
  },
  async all(){
   return {success:true,results:sql.includes('FROM videos')?videos:sql.includes('FROM comments')?comments:[]};
  },
  async run(){return {success:true}}
 }}
}
const env={DB:new Db(),MOCK_AUTH:'local-only',OWNER_SUB:'dev:owner'};
const base='http://localhost:8787';
async function run(path,headers={},method='GET',data){
 const req=new Request(base+path,{method,headers:{...headers,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
 const res=await handleRequest(req,env);return {status:res.status,json:await res.json()};
}
test('health is transparent about unconnected OIDC',async()=>{
 const r=await run('/v1/health');assert.equal(r.status,200);assert.equal(r.json.central_auth,'not_connected');
});
test('guests only see public videos, excluding drafts and restricted totals',async()=>{
 const r=await run('/v1/videos');assert.deepEqual(r.json.videos.map(x=>x.id),['public01']);assert.equal(r.json.total,1);
});
test('logged-in members see members but not rank videos',async()=>{
 const r=await run('/v1/videos',{'x-demo-sub':'dev:member'});assert.deepEqual(r.json.videos.map(x=>x.id),['public01','member01']);
});
test('rank permission is denied without central decision',async()=>{
 const headers={'x-demo-sub':'dev:member'};
 assert.equal((await run('/v1/videos/rank001',headers)).status,403);
 assert.equal((await run('/v1/videos/rank001',{...headers,'x-demo-eligible':'true'})).status,200);
 const res=await handleRequest(new Request('https://learn.hglobal1985.com/v1/videos/rank001',{headers:{...headers,'x-demo-eligible':'true'}}),env);
 assert.equal(res.status,403);
});
test('deep links and signed playback honor view permissions',async()=>{
 assert.equal((await run('/v1/videos/member01')).status,403);
 assert.equal((await run('/v1/videos/member01/playback',{},'POST')).status,403);
 assert.equal((await run('/v1/videos/member01',{'x-demo-sub':'dev:member'})).status,200);
});
test('only uploader can create video draft',async()=>{
 assert.equal((await run('/v1/videos',{},'POST',{title:'bad'})).status,401);
 assert.equal((await run('/v1/videos',{'x-demo-sub':'dev:member'},'POST',{title:'bad'})).status,403);
 const r=await run('/v1/videos',{'x-demo-sub':'dev:owner'},'POST',{title:'新課程',description:'',category:'健康',source_type:'youtube',youtube_url:'https://youtu.be/dQw4w9WgXcQ',access_mode:'public'});
 assert.equal(r.status,201);assert.ok(r.json.share_url.startsWith('https://learn.hglobal1985.com/'));
});
test('underprivileged users cannot publish or grant admin',async()=>{
 assert.equal((await run('/v1/videos/public01/publish',{'x-demo-sub':'dev:member'},'POST')).status,403);
 assert.equal((await run('/v1/admin/grants',{'x-demo-sub':'dev:member'},'POST',{member_sub:'dev:a',permission:'upload',enabled:true})).status,403);
});
test('guest cannot read restricted comments or post',async()=>{
 assert.equal((await run('/v1/videos/member01/comments')).status,403);
 assert.equal((await run('/v1/videos/public01/comments',{},'POST',{body:'hi'})).status,401);
});
test('comment author identity is not exposed',async()=>{
 const r=await run('/v1/videos/public01/comments');assert.equal(r.status,200);
 assert.equal(r.json.comments[0].is_mine,false);assert.equal('author_sub'in r.json.comments[0],false);
 const mine=await run('/v1/videos/public01/comments',{'x-demo-sub':'dev:member'});
 assert.equal(mine.json.comments[0].is_mine,true);
});
test('only author can edit or delete own comments',async()=>{
 assert.equal((await run('/v1/comments/comment01',{'x-demo-sub':'dev:other'},'PATCH',{body:'改寫'})).status,403);
 assert.equal((await run('/v1/comments/comment01',{'x-demo-sub':'dev:member'},'PATCH',{body:'改寫'})).status,200);
 assert.equal((await run('/v1/comments/comment01',{'x-demo-sub':'dev:member'},'DELETE')).status,200);
});
test('unsafe browser origin is refused',async()=>{
 assert.equal((await run('/v1/videos',{'origin':'https://bad.example','x-demo-sub':'dev:owner'},'POST',{title:'bad'})).status,403);
});
test('verified Mux webhook bypasses browser Origin but not HMAC',async()=>{
 const raw=JSON.stringify({type:'video.asset.ready',data:{id:'asset01'}}),t=String(Math.floor(Date.now()/1000));
 const h=createHmac('sha256','test-secret').update(t+'.'+raw).digest('hex');
 const previous=env.MUX_WEBHOOK_SECRET;env.MUX_WEBHOOK_SECRET='test-secret';
 try{
  const good=await handleRequest(new Request(base+'/v1/webhooks/mux',{method:'POST',headers:{'mux-signature':'t='+t+',v1='+h},body:raw}),env);
  assert.equal(good.status,200);
  const bad=await handleRequest(new Request(base+'/v1/webhooks/mux',{method:'POST',headers:{'mux-signature':'t='+t+',v1='+('0'.repeat(64))},body:raw}),env);
  assert.equal(bad.status,401);
 }finally{env.MUX_WEBHOOK_SECRET=previous}
});
test('member progress cannot be read by guests',async()=>{
 assert.equal((await run('/v1/videos/member01/progress')).status,401);
 assert.equal((await run('/v1/videos/member01/progress',{'x-demo-sub':'dev:member'})).status,200);
});
test('only owner can list admin grants',async()=>{
 assert.equal((await run('/v1/admin/grants',{'x-demo-sub':'dev:member','x-demo-eligible':'true'})).status,403);
 assert.equal((await run('/v1/admin/grants',{'x-demo-sub':'dev:owner'})).status,200);
});
test('moderation actions require moderation grant',async()=>{
 assert.equal((await run('/v1/comments/comment01/moderate',{'x-demo-sub':'dev:member'},'POST',{action:'hide'})).status,403);
 assert.equal((await run('/v1/comments/comment01/moderate',{'x-demo-sub':'dev:owner'},'POST',{action:'hide'})).status,200);
});
