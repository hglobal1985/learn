import {getViewer} from '../auth/backend.mjs';
import {getMuxAsset,listMuxAssets,safeMuxPlayback,videoForm} from './media.mjs';

const CENTRAL='https://id.hglobal1985.com';
const OWNER_CHECK='/v1/apps/learn/handoff?integrated=2026-11-10.2';
const ID=/^[A-Za-z0-9_-]{3,64}$/;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'
}});
const fail=(code,status,message)=>json({error:{code,message,request_id:crypto.randomUUID()}},status);
const refreshWait=()=>AbortSignal.timeout(6000);
async function readBody(request){
 if(!request.headers.get('content-type')?.includes('application/json'))throw Error('invalid_json');
 const raw=await request.text();
 if(raw.length>8192)throw Error('too_large');
 let body;try{body=JSON.parse(raw)}catch{throw Error('invalid_json')}
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid_json');
 return body;
}
async function requireOwner(request){
 const viewer=await getViewer(request);
 if(!viewer?.sub)return {status:401};
 const authorization=request.headers.get('authorization');
 if(!authorization?.startsWith('Bearer '))return {status:401};
 try{
  const [settings,owner]=await Promise.all([
   fetch(CENTRAL+'/v1/apps/learn/config',{signal:refreshWait()}),
   fetch(CENTRAL+OWNER_CHECK,{headers:{Authorization:authorization},signal:refreshWait()})
  ]);
  if(!settings.ok)return {status:503};
  const app=await settings.json();
  if(app.status!=='active')return {status:403};
  if(owner.status===401)return {status:401};
  if(!owner.ok)return {status:403};
  return {status:200,sub:viewer.sub,authorization};
 }catch{return {status:503}}
}
async function inspectIfConnected(env,assetId,mode){
 if(!env.MUX_TOKEN_ID||!env.MUX_TOKEN_SECRET)return null;
 const data=await getMuxAsset(env,assetId);
 return safeMuxPlayback(data,mode);
}
async function publish(env,id){
 const v=await env.DB.prepare('SELECT * FROM videos WHERE id=?').bind(id).first();
 if(!v)return fail('not_found',404,'找不到影片');
 if(v.status==='published')return json({ok:true,status:'published'});
 if(v.source_type==='youtube'){
  if(!/^[A-Za-z0-9_-]{11}$/.test(v.source_id))return fail('invalid_youtube',422,'YouTube 連結無效');
  if(v.access_mode!=='public'&&(v.youtube_visibility!=='unlisted'||Number(v.accepted_unlisted_risk)!==1))return fail('youtube_not_private',409,'限定影片須使用不公開連結並確認轉傳風險');
 }else if(v.source_type==='mux'){
  if(!v.mux_asset_id)return fail('mux_not_ready',422,'缺少 Mux Asset ID');
  if(!env.MUX_TOKEN_ID||!env.MUX_TOKEN_SECRET)return fail('mux_not_configured',503,'尚未設定 Mux API 連線，影片已保存草稿');
  let playback;
  try{playback=await inspectIfConnected(env,v.mux_asset_id,v.access_mode)}catch{return fail('mux_not_ready',422,'Mux 影片未就緒或播放政策不安全')}
  if(playback.policy==='signed'&&(!env.MUX_SIGNING_KEY_ID||!env.MUX_SIGNING_PRIVATE_KEY))return fail('mux_signing_unavailable',503,'Signed 影片尚未設定播放簽章金鑰');
  await env.DB.prepare("UPDATE videos SET source_id=?,mux_playback_policy=?,duration_seconds=?,status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?")
   .bind(playback.playback_id,playback.policy,playback.duration_seconds,id).run();
  return json({ok:true,status:'published'});
 }else return fail('invalid_source',422,'影片來源不支援');
 await env.DB.prepare("UPDATE videos SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
 return json({ok:true,status:'published'});
}
export async function adminRoute(request,env){
 const method=request.method,path=new URL(request.url).pathname;
 if(!['GET','POST','PATCH'].includes(method))return fail('method_not_allowed',405,'操作不支援');
 if(method!=='GET'){
  const origin=request.headers.get('origin');
  if(origin&&origin!=='https://learn.hglobal1985.com')return fail('origin_denied',403,'不允許此來源');
 }
 const actor=await requireOwner(request);
 if(actor.status!==200)return fail(actor.status===401?'unauthenticated':actor.status===503?'central_unavailable':'forbidden',
  actor.status,actor.status===401?'請先登入':actor.status===503?'管理權限驗證服務暫時無法使用':'沒有超級管理員權限');

 if(path==='/v1/admin/session'&&method==='GET')return json({is_super_admin:true});
 if(path==='/v1/admin/videos'&&method==='GET'){
  const results=await env.DB.prepare("SELECT id,title,description,category,access_mode,audience,min_rank_code,source_type,mux_asset_id,mux_playback_policy,youtube_visibility,accepted_unlisted_risk,status,duration_seconds,created_at FROM videos ORDER BY created_at DESC LIMIT 100").all();
  return json({videos:results.results||[]});
 }
 if(path==='/v1/admin/mux/assets'&&method==='GET'){
  if(!env.MUX_TOKEN_ID||!env.MUX_TOKEN_SECRET)return json({connected:false,assets:[],message:'Mux API 尚未連線；可以輸入 Asset ID 建立草稿'});
  try{const assets=await listMuxAssets(env);return json({connected:true,assets:assets||[]})}
  catch{return fail('mux_unavailable',503,'Mux 影片清單暫時無法讀取')}
 }
 if(path==='/v1/admin/ranks'&&method==='GET'){
  try{
   const r=await fetch(CENTRAL+'/v1/amway/field-definitions',{headers:{Authorization:actor.authorization},signal:refreshWait()});
   if(!r.ok)return fail('ranks_unavailable',503,'目前無法讀取獎銜選項');
   const data=await r.json(),rank=data.fields?.find?.(f=>f.key==='rank');
   return json({ranks:(rank?.options||[]).filter(x=>x&&typeof x.value==='string'&&typeof x.label==='string')
    .map(x=>({value:x.value,label:x.label}))});
  }catch{return fail('ranks_unavailable',503,'目前無法讀取獎銜選項')}
 }
 if(path==='/v1/admin/videos'&&method==='POST'){
  let data;
  try{data=videoForm(await readBody(request))}
  catch(e){return fail(e.message||'invalid_fields',422,'請檢查影片資料、來源與觀看權限')}
  let playback=null;
  if(data.source_type==='mux'){
   const exists=await env.DB.prepare('SELECT id FROM videos WHERE mux_asset_id=?').bind(data.asset_id).first();
   if(exists)return fail('already_imported',409,'這部 Mux 影片已匯入，請在下方影片清單管理');
   try{playback=await inspectIfConnected(env,data.asset_id,data.access_mode)}
   catch{return fail('mux_not_ready',422,'Mux 影片未就緒或播放政策不安全')}
  }
  const id='v'+crypto.randomUUID().replace(/-/g,'').slice(0,15);
  try{
   await env.DB.prepare("INSERT INTO videos(id,title,description,category,access_mode,audience,min_rank_code,source_type,source_id,mux_asset_id,mux_playback_policy,youtube_visibility,accepted_unlisted_risk,duration_seconds,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft')")
    .bind(id,data.title,data.description,data.category,data.access_mode,data.audience,data.min_rank_code,
     data.source_type,playback?.playback_id||data.source_id,data.asset_id,playback?.policy||null,data.visibility,data.accepted_unlisted_risk,playback?.duration_seconds||null).run();
  }catch{return fail('already_imported',409,'影片可能已存在，請重新整理清單')}
  return json({video_id:id,status:'draft',needs_mux_connection:data.source_type==='mux'&&!playback},201);
 }
 const match=path.match(/^\/v1\/admin\/videos\/([A-Za-z0-9_-]{3,64})\/(publish|unpublish)$/);
 if(match&&method==='POST'){
  if(match[2]==='publish')return publish(env,match[1]);
  const existing=await env.DB.prepare('SELECT id FROM videos WHERE id=?').bind(match[1]).first();
  if(!existing)return fail('not_found',404,'找不到影片');
  await env.DB.prepare("UPDATE videos SET status='draft',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(match[1]).run();
  return json({ok:true,status:'draft'});
 }
 if(path.match(/^\/v1\/admin\/videos\/([A-Za-z0-9_-]{3,64})$/)&&method==='PATCH'){
  const id=path.split('/').at(-1),existing=await env.DB.prepare('SELECT * FROM videos WHERE id=?').bind(id).first();
  if(!existing)return fail('not_found',404,'找不到影片');
  if(existing.status!=='draft')return fail('not_draft',409,'請先下架再編輯影片');
  let b;try{b=await readBody(request)}catch{return fail('invalid_json',422,'資料格式不正確')}
  const title=String(b.title??existing.title).trim(),description=String(b.description??existing.description).trim();
  const category=String(b.category??existing.category).trim();
  if(!title||title.length>120||description.length>3000||!category||category.length>60)return fail('invalid_fields',422,'影片資料有誤');
  await env.DB.prepare("UPDATE videos SET title=?,description=?,category=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
   .bind(title,description,category,id).run();
  return json({ok:true});
 }
 return fail('not_found',404,'找不到管理功能');
}
