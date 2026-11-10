import {canView,isMuxPublishable,VIDEO_ID,youtubeId,visibleCatalog,type AccessMode,type VideoRecord} from '../../../packages/shared/src/index.js';
import {assert,asString,bodyJson,cleanText,httpErrorResponse,json,type Env} from './http.js';
import {centralCheck,getViewer,requirePermission,validateMutationOrigin,validPermission,isOwnedComment} from './security.js';
import {createDirectUpload,inspectMuxAsset,signedPlaybackToken,verifyWebhook} from './mux.js';

type Viewer=Awaited<ReturnType<typeof getViewer>>;
type Comment={id:string;video_id:string;author_sub:string;parent_comment_id:string|null;body:string;status:string;created_at:string};
const isMode=(m:unknown):m is AccessMode=>m==='public'||m==='members'||m==='rank';
const id=()=>crypto.randomUUID().replace(/-/g,'').slice(0,16);
const pick=(v:unknown,allowed:readonly string[],fallback='')=>typeof v==='string'&&allowed.includes(v)?v:fallback;
async function getVideo(env:Env,vid:string):Promise<VideoRecord|null>{
 if(!VIDEO_ID.test(vid))return null;
 return env.DB.prepare('SELECT * FROM videos WHERE id=?').bind(vid).first<VideoRecord>();
}
async function requireVideo(req:Request,env:Env,vid:string,viewer:Viewer):Promise<VideoRecord>{
 const video=await getVideo(env,vid);
 assert(video,404,'not_found','找不到影片');
 const ok=await canView(video,viewer,(rule,sub)=>centralCheck(req,env,rule,sub));
 assert(ok,403,'forbidden','需要符合資格才能瀏覽此內容');
 return video;
}
async function listVideos(req:Request,env:Env,viewer:Viewer):Promise<Response>{
 const u=new URL(req.url),q=(u.searchParams.get('q')||'').trim().slice(0,120).toLowerCase(),category=(u.searchParams.get('category')||'').trim().slice(0,60);
 const rows=await env.DB.prepare("SELECT * FROM videos WHERE status='published' ORDER BY created_at DESC LIMIT 200").all<VideoRecord>();
 const candidates=rows.results.filter(v=>(!q||(v.title+' '+v.description).toLowerCase().includes(q))&&(!category||v.category===category));
 const filtered=await visibleCatalog(candidates,viewer,(rule,sub)=>centralCheck(req,env,rule,sub));
 return json({videos:filtered.visible.map(v=>({id:v.id,title:v.title,description:v.description,access_mode:v.access_mode,category:v.category,source_type:v.source_type,created_at:v.created_at})),total:filtered.total});
}
async function createVideo(req:Request,env:Env,viewer:Viewer):Promise<Response>{
 await requirePermission(env,viewer,'upload');
 const b=await bodyJson(req);
 const title=cleanText(b.title,120),description=cleanText(b.description??'',3000,0),category=cleanText(b.category??'一般',60);
 const access=b.access_mode??'rank';assert(isMode(access),422,'invalid_access_mode','影片權限無效');
 const minRank=access==='rank'&&b.min_rank_code!=null?cleanText(b.min_rank_code,32):null;
 const source=pick(b.source_type,['mux','youtube']);assert(source,422,'invalid_source','影片來源無效');
 const sourceId=source==='youtube'?youtubeId(asString(b.youtube_url)):'';
 if(source==='youtube')assert(sourceId,422,'invalid_youtube_url','YouTube 網址無效');
 const visibility=source==='youtube'?pick(b.youtube_visibility,['public','unlisted'],'public'):null;
 const risk=b.accept_unlisted_risk===true;
 if(visibility==='unlisted'&&access!=='public')assert(risk,422,'unlisted_risk_unconfirmed','需確認來源網址可以被轉傳');
 const videoId=id();
 await env.DB.prepare("INSERT INTO videos(id,title,description,access_mode,min_rank_code,source_type,source_id,youtube_visibility,accepted_unlisted_risk,category,status) VALUES(?,?,?,?,?,?,?,?,?,?,'draft')")
  .bind(videoId,title,description,access,minRank,source,sourceId||'',visibility,risk?1:0,category).run();
 return json({video_id:videoId,status:'draft',share_url:'https://learn.hglobal1985.com/'+videoId},201);
}
async function updateVideo(req:Request,env:Env,vid:string,viewer:Viewer):Promise<Response>{
 await requirePermission(env,viewer,'videos.manage');
 const v=await getVideo(env,vid);assert(v,404,'not_found','影片不存在');
 const b=await bodyJson(req),updates:string[]=[],values:unknown[]=[];
 if('title'in b){updates.push('title=?');values.push(cleanText(b.title,120))}
 if('description'in b){updates.push('description=?');values.push(cleanText(b.description,3000,0))}
 if('category'in b){updates.push('category=?');values.push(cleanText(b.category,60))}
 if('access_mode'in b||'min_rank_code'in b){
  await requirePermission(env,viewer,'videos.access');
  const mode=b.access_mode??v.access_mode;assert(isMode(mode),422,'invalid_access_mode','影片權限無效');
  const rankCode=mode==='rank'?(b.min_rank_code===undefined?v.min_rank_code:b.min_rank_code):null;
  const minRank=rankCode==null?null:cleanText(rankCode,32);
  if(v.source_type==='mux'&&v.mux_asset_id&&mode!=='public'){
   const asset=await inspectMuxAsset(env,v.mux_asset_id);
   assert(isMuxPublishable({...v,access_mode:mode},asset.playback_ids?.map(p=>p.policy)||[]),409,'mux_public_playback_exists','Mux 仍有公開播放 ID');
  }
  if(v.source_type==='youtube'&&v.youtube_visibility==='unlisted'&&mode!=='public')assert(Number(v.accepted_unlisted_risk)===1,422,'unlisted_risk_unconfirmed','請先確認來源網址可以被轉傳');
  updates.push('access_mode=?','min_rank_code=?');values.push(mode,minRank);
 }
 assert(updates.length,422,'no_changes','沒有可更新的欄位');
 await env.DB.prepare('UPDATE videos SET '+updates.join(',')+',updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(...values,vid).run();
 return json({ok:true});
}
async function publishVideo(env:Env,vid:string,viewer:Viewer):Promise<Response>{
 await requirePermission(env,viewer,'videos.publish');
 const v=await getVideo(env,vid);assert(v,404,'not_found','影片不存在');
 if(v.source_type==='youtube'){
  assert(youtubeId('https://www.youtube.com/watch?v='+v.source_id),422,'invalid_source','來源影片無效');
  if(v.youtube_visibility==='unlisted'&&v.access_mode!=='public')assert(Number(v.accepted_unlisted_risk)===1,422,'unlisted_risk_unconfirmed','尚未確認來源轉傳風險');
 }else{
  assert(v.mux_asset_id,422,'mux_not_ready','Mux 影片尚未上傳完成');
  const asset=await inspectMuxAsset(env,v.mux_asset_id);
  assert(asset.status==='ready',422,'mux_not_ready','Mux 影片尚未轉檔完成');
  const playback=asset.playback_ids||[];
  assert(isMuxPublishable(v,playback.map(x=>x.policy)),409,'mux_public_playback_exists','Mux 影片播放權限不安全');
  const selected=playback.find(x=>x.policy==='signed')||playback.find(x=>x.policy==='public');
  assert(selected,422,'mux_no_playback','Mux 播放 ID 不存在');
  await env.DB.prepare('UPDATE videos SET source_id=?,mux_playback_policy=?,duration_seconds=? WHERE id=?').bind(selected.id,selected.policy,Math.ceil(asset.duration||0),vid).run();
 }
 await env.DB.prepare("UPDATE videos SET status='published',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(vid).run();
 return json({ok:true,video_id:vid});
}

async function importExistingMux(req:Request,env:Env,viewer:Viewer):Promise<Response>{
 await requirePermission(env,viewer,'upload');
 const b=await bodyJson(req);
 const title=cleanText(b.title,120);
 const description=cleanText(b.description??'',3000,0);
 const category=cleanText(b.category??'一般',60);
 const assetId=cleanText(b.asset_id,128);
 assert(/^[A-Za-z0-9]+$/.test(assetId),422,'invalid_asset_id','Mux 資產識別碼無效');
 const access=b.access_mode??'rank';
 assert(isMode(access),422,'invalid_access_mode','影片權限無效');
 const minRank=access==='rank'&&b.min_rank_code!=null?cleanText(b.min_rank_code,32):null;
 const existing=await env.DB.prepare('SELECT id FROM videos WHERE mux_asset_id=?').bind(assetId).first<{id:string}>();
 assert(!existing,409,'already_imported','這部 Mux 影片已經匯入');
 const asset=await inspectMuxAsset(env,assetId);
 assert(asset.status==='ready',422,'mux_not_ready','Mux 影片尚未完成處理');
 const playbackIds=asset.playback_ids||[];
 const candidate:VideoRecord={
  id:'checking',title,description,access_mode:access,min_rank_code:minRank,source_type:'mux',
  source_id:'',youtube_visibility:null,category,status:'draft',mux_asset_id:assetId
 };
 assert(isMuxPublishable(candidate,playbackIds.map(p=>p.policy)),409,'mux_public_playback_exists','限定影片仍有公開播放 ID，無法匯入');
 const selected=playbackIds.find(p=>p.policy==='signed')||playbackIds.find(p=>p.policy==='public');
 assert(selected?.id,422,'mux_no_playback','Mux 影片沒有可用的播放 ID');
 const videoId=id();
 await env.DB.prepare("INSERT INTO videos(id,title,description,access_mode,min_rank_code,source_type,source_id,mux_asset_id,mux_playback_policy,category,duration_seconds,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,'draft')")
  .bind(videoId,title,description,access,minRank,'mux',selected.id,assetId,selected.policy,category,Math.ceil(asset.duration||0)).run();
 return json({video_id:videoId,status:'draft',share_url:'https://learn.hglobal1985.com/'+videoId},201);
}

async function playback(req:Request,env:Env,vid:string,viewer:Viewer):Promise<Response>{
 const v=await requireVideo(req,env,vid,viewer);
 if(v.source_type==='youtube')return json({type:'youtube',video_id:v.source_id});
 assert(v.source_id,503,'mux_not_ready','影片尚未準備好');
 if(v.mux_playback_policy==='public'){
  assert(v.access_mode==='public',409,'unsafe_playback_policy','受限影片不可公開播放');
  return json({type:'mux',url:'https://stream.mux.com/'+v.source_id+'.m3u8'});
 }
 assert(v.mux_playback_policy==='signed',409,'unsafe_playback_policy','尚未確認影片授權');
 const seconds=Math.min(21600,Math.max(7200,Math.ceil(v.duration_seconds||0)+900));
 const token=await signedPlaybackToken(env,v.source_id,'v',seconds);
 return json({type:'mux',url:'https://stream.mux.com/'+v.source_id+'.m3u8?token='+token,expires_in:seconds});
}
async function getComments(req:Request,env:Env,vid:string,viewer:Viewer):Promise<Response>{
 await requireVideo(req,env,vid,viewer);
 const rows=await env.DB.prepare("SELECT id,video_id,author_sub,parent_comment_id,body,created_at FROM comments WHERE video_id=? AND status='visible' ORDER BY created_at ASC LIMIT 200").bind(vid).all<Comment>();
 return json({comments:rows.results.map(c=>({id:c.id,video_id:c.video_id,parent_comment_id:c.parent_comment_id,body:c.body,created_at:c.created_at,is_mine:!!viewer?.sub&&viewer.sub===c.author_sub}))});
}
async function postComment(req:Request,env:Env,vid:string,viewer:Viewer):Promise<Response>{
 assert(viewer?.sub,401,'unauthenticated','請先登入');
 await requireVideo(req,env,vid,viewer);
 const banned=await env.DB.prepare('SELECT member_sub FROM comment_bans WHERE member_sub=?').bind(viewer.sub).first();
 assert(!banned,403,'comment_banned','目前無法留言');
 const b=await bodyJson(req),text=cleanText(b.body,2000),parentId=b.parent_comment_id;
 if(parentId){
  assert(typeof parentId==='string',422,'invalid_parent','回覆對象無效');
  const p=await env.DB.prepare("SELECT id,parent_comment_id FROM comments WHERE id=? AND video_id=? AND status='visible'").bind(parentId,vid).first<{id:string;parent_comment_id:string|null}>();
  assert(p&&!p.parent_comment_id,422,'invalid_parent','只能回覆第一層留言');
 }
 const cid=id();
 await env.DB.prepare('INSERT INTO comments(id,video_id,author_sub,parent_comment_id,body) VALUES(?,?,?,?,?)').bind(cid,vid,viewer.sub,parentId||null,text).run();
 return json({id:cid,video_id:vid},201);
}
async function editComment(req:Request,env:Env,cid:string,viewer:Viewer):Promise<Response>{
 assert(viewer?.sub,401,'unauthenticated','請先登入');
 const c=await env.DB.prepare('SELECT * FROM comments WHERE id=?').bind(cid).first<Comment>();
 assert(c&&c.status==='visible',404,'not_found','留言不存在');
 await requireVideo(req,env,c.video_id,viewer);
 assert(isOwnedComment(c.author_sub,viewer.sub),403,'forbidden','只能修改自己的留言');
 if(req.method==='DELETE')await env.DB.prepare("UPDATE comments SET body='',status='deleted',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(cid).run();
 else{
  const b=await bodyJson(req);const text=cleanText(b.body,2000);
  await env.DB.prepare('UPDATE comments SET body=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(text,cid).run();
 }
 return json({ok:true});
}
async function reportComment(req:Request,env:Env,cid:string,viewer:Viewer):Promise<Response>{
 assert(viewer?.sub,401,'unauthenticated','請先登入');
 const c=await env.DB.prepare('SELECT * FROM comments WHERE id=?').bind(cid).first<Comment>();
 assert(c&&c.status==='visible',404,'not_found','留言不存在');
 await requireVideo(req,env,c.video_id,viewer);
 const b=await bodyJson(req),reason=pick(b.reason_code,['spam','abuse','privacy','copyright','other']);
 assert(reason,422,'invalid_reason','請選擇檢舉原因');
 await env.DB.prepare('INSERT INTO comment_reports(id,comment_id,reporter_sub,reason_code) VALUES(?,?,?,?)').bind(id(),cid,viewer.sub,reason).run();
 return json({ok:true},201);
}
async function moderate(req:Request,env:Env,cid:string,viewer:Viewer):Promise<Response>{
 const admin=await requirePermission(env,viewer,'comments.moderate');
 const c=await env.DB.prepare('SELECT * FROM comments WHERE id=?').bind(cid).first<Comment>();
 assert(c,404,'not_found','留言不存在');
 const b=await bodyJson(req),action=pick(b.action,['hide','restore','ban_author']);
 assert(action,422,'invalid_action','無效操作');
 // A user-deleted comment cannot be restored by moderation.
 assert(c.status!=='deleted'||action==='ban_author',409,'deleted_comment','已刪除留言不能還原');
 if(action==='ban_author')await env.DB.prepare('INSERT OR REPLACE INTO comment_bans(member_sub,banned_by_sub) VALUES(?,?)').bind(c.author_sub,admin).run();
 else await env.DB.prepare('UPDATE comments SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(action==='hide'?'hidden':'visible',cid).run();
 await env.DB.prepare('INSERT INTO moderation_actions(id,actor_sub,target_type,target_id,action) VALUES(?,?,?,?,?)').bind(id(),admin,'comment',cid,action).run();
 return json({ok:true});
}
async function handle(req:Request,env:Env):Promise<Response>{
 const u=new URL(req.url),path=u.pathname,method=req.method;
 if(method==='GET'&&path==='/v1/health')return json({status:'ok',version:'0.1.0',central_auth:'not_connected'});
 if(method==='OPTIONS')return new Response(null,{status:204});
 if(!(method==='POST'&&path==='/v1/webhooks/mux'))validateMutationOrigin(req,env);
 if(method==='POST'&&path==='/v1/webhooks/mux'){
  const raw=await req.text();
  assert(raw.length<=100000,413,'too_large','資料太大');
  assert(await verifyWebhook(raw,req.headers.get('mux-signature'),env.MUX_WEBHOOK_SECRET),401,'invalid_webhook','簽章無效');
  const evt=JSON.parse(raw) as {type?:string;data?:{id?:string;asset_id?:string}};
  if(evt.type==='video.upload.asset_created'&&evt.data?.id&&evt.data.asset_id){
   await env.DB.prepare('UPDATE uploads SET mux_asset_id=?,status=? WHERE mux_upload_id=?').bind(evt.data.asset_id,'processing',evt.data.id).run();
   await env.DB.prepare('UPDATE videos SET mux_asset_id=? WHERE id=(SELECT video_id FROM uploads WHERE mux_upload_id=?)').bind(evt.data.asset_id,evt.data.id).run();
  }
  if(evt.type==='video.asset.ready'&&evt.data?.id)await env.DB.prepare("UPDATE uploads SET status='ready' WHERE mux_asset_id=?").bind(evt.data.id).run();
  return json({ok:true});
 }
 const viewer=await getViewer(req,env);
 if(method==='GET'&&path==='/v1/session')return json({authenticated:!!viewer,member_sub:viewer?.sub||null,mock:!!viewer?.sub?.startsWith('dev:')});
 if(method==='GET'&&path==='/v1/videos')return listVideos(req,env,viewer);
 if(method==='POST'&&path==='/v1/videos')return createVideo(req,env,viewer);
 if(method==='GET'&&path==='/v1/admin/videos'){
  await requirePermission(env,viewer,'videos.manage');
  const rows=await env.DB.prepare('SELECT * FROM videos ORDER BY created_at DESC LIMIT 200').all();
  return json({videos:rows.results});
 }
 if(method==='GET'&&path==='/v1/admin/reports'){
  await requirePermission(env,viewer,'comments.moderate');
  const rows=await env.DB.prepare("SELECT r.id,r.comment_id,r.reason_code,r.updated_at,c.video_id,c.body FROM comment_reports r JOIN comments c ON r.comment_id=c.id WHERE r.status='open' ORDER BY r.updated_at DESC LIMIT 100").all();
  return json({reports:rows.results});
 }
 if(method==='GET'&&path==='/v1/admin/grants'){
  assert(env.OWNER_SUB&&viewer?.sub===env.OWNER_SUB,403,'forbidden','只有擁有者可以查看管理員');
  const rows=await env.DB.prepare('SELECT member_sub,permission,created_at FROM admin_grants ORDER BY member_sub,permission LIMIT 200').all();
  return json({grants:rows.results});
 }
 if(method==='POST'&&path==='/v1/admin/grants'){
  assert(env.OWNER_SUB&&viewer?.sub===env.OWNER_SUB,403,'forbidden','只有擁有者可以授權管理員');
  const b=await bodyJson(req),sub=cleanText(b.member_sub,128),permission=b.permission;
  assert(validPermission(permission),422,'invalid_permission','授權項目無效');
  assert(sub!==env.OWNER_SUB,409,'owner_immutable','不能修改擁有者');
  assert(typeof b.enabled==='boolean',422,'invalid_enabled','缺少授權選擇');
  if(b.enabled)await env.DB.prepare('INSERT OR REPLACE INTO admin_grants(member_sub,permission,granted_by_sub) VALUES(?,?,?)').bind(sub,permission,viewer.sub).run();
  else await env.DB.prepare('DELETE FROM admin_grants WHERE member_sub=? AND permission=?').bind(sub,permission).run();
  return json({ok:true});
 }
 if(method==='POST'&&path==='/v1/videos/mux/import')return importExistingMux(req,env,viewer);
 if(method==='POST'&&path==='/v1/uploads/mux'){
  const admin=await requirePermission(env,viewer,'upload');
  const b=await bodyJson(req),vid=cleanText(b.video_id,64);
  const v=await getVideo(env,vid);
  assert(v&&v.source_type==='mux',404,'not_found','Mux 草稿不存在');
  assert(v.status==='draft',409,'already_published','影片已發布');
  const upload=await createDirectUpload(env,vid,env.WEB_ORIGIN||'https://learn.hglobal1985.com');
  await env.DB.prepare('INSERT INTO uploads(id,video_id,initiator_sub,mux_upload_id,status) VALUES(?,?,?,?,?)').bind(id(),vid,admin,upload.id,'waiting').run();
  return json({upload_url:upload.url,upload_id:upload.id},201);
 }
 const vm=path.match(/^\/v1\/videos\/([a-zA-Z0-9_-]{3,64})(?:\/(playback|publish|unpublish|comments|progress))?$/);
 if(vm){
  const vid=vm[1]!,action=vm[2];
  if(!action&&method==='GET'){
   const v=await requireVideo(req,env,vid,viewer);
   return json({video:{id:v.id,title:v.title,description:v.description,source_type:v.source_type,source_id:v.source_type==='youtube'?v.source_id:undefined,youtube_visibility:v.youtube_visibility,category:v.category,access_mode:v.access_mode,duration_seconds:v.duration_seconds,created_at:v.created_at},share_url:'https://learn.hglobal1985.com/'+v.id});
  }
  if(!action&&method==='PATCH')return updateVideo(req,env,vid,viewer);
  if(action==='publish'&&method==='POST')return publishVideo(env,vid,viewer);
  if(action==='unpublish'&&method==='POST'){
   await requirePermission(env,viewer,'videos.publish');
   const v=await getVideo(env,vid);assert(v,404,'not_found','影片不存在');
   await env.DB.prepare("UPDATE videos SET status='unlisted',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(vid).run();
   return json({ok:true});
  }
  if(action==='playback'&&method==='POST')return playback(req,env,vid,viewer);
  if(action==='comments'&&method==='GET')return getComments(req,env,vid,viewer);
  if(action==='comments'&&method==='POST')return postComment(req,env,vid,viewer);
  if(action==='progress'&&(method==='GET'||method==='POST')){
   assert(viewer?.sub,401,'unauthenticated','請先登入');
   await requireVideo(req,env,vid,viewer);
   if(method==='GET'){
    const x=await env.DB.prepare('SELECT position_seconds,updated_at FROM video_progress WHERE member_sub=? AND video_id=?').bind(viewer.sub,vid).first<{position_seconds:number;updated_at:string}>();
    return json({position_seconds:x?.position_seconds??0,updated_at:x?.updated_at??null});
   }
   const b=await bodyJson(req),n=Number(b.position_seconds);
   assert(Number.isInteger(n)&&n>=0&&n<10000000,422,'invalid_progress','播放位置無效');
   await env.DB.prepare('INSERT INTO video_progress(member_sub,video_id,position_seconds) VALUES(?,?,?) ON CONFLICT(member_sub,video_id) DO UPDATE SET position_seconds=excluded.position_seconds,updated_at=CURRENT_TIMESTAMP').bind(viewer.sub,vid,n).run();
   return json({ok:true});
  }
 }
 const cm=path.match(/^\/v1\/comments\/([a-zA-Z0-9_-]{3,64})(?:\/(report|moderate))?$/);
 if(cm){
  const cid=cm[1]!,action=cm[2];
  if(!action&&(method==='PATCH'||method==='DELETE'))return editComment(req,env,cid,viewer);
  if(action==='report'&&method==='POST')return reportComment(req,env,cid,viewer);
  if(action==='moderate'&&method==='POST')return moderate(req,env,cid,viewer);
 }
 return json({error:{code:'not_found',message:'找不到此功能'}},404);
}
export async function handleRequest(req:Request,env:Env):Promise<Response>{
 const requestId=crypto.randomUUID();
 try{return await handle(req,env)}catch(e){return httpErrorResponse(e,requestId)}
}
export default {fetch:handleRequest};
