import {getViewer,allowed} from './auth/backend.mjs';
import {AUTH_BROWSER_JS} from './auth/web-client.mjs';
import {ADMIN_BROWSER_JS} from './admin/browser.mjs';
import {ADMIN_PAGE} from './admin/page.mjs';
import {adminRoute} from './admin/routes.mjs';
import {muxPlayback} from './access/mux.mjs';
import {canViewPublic} from './access/policy.mjs';
const BASE = 'https://learn.hglobal1985.com';
const CSS = `
:root{color-scheme:light;--ink:#18283d;--muted:#57687c;--blue:#2459a6;--paper:#f5f7fb;--line:#dbe5ee;--navy:#182e49}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Noto Sans TC","Microsoft JhengHei",sans-serif}
a{color:inherit;text-decoration:none}.wrap{max-width:1090px;padding:0 24px;margin:0 auto}.top{background:white;border-bottom:1px solid var(--line)}
.nav{display:flex;align-items:center;justify-content:space-between;min-height:84px;gap:20px}.brand{display:flex;gap:13px;align-items:center;font-weight:850;font-size:21px}
.mark{width:43px;height:43px;display:grid;place-items:center;background:var(--navy);color:white;border-radius:12px;font-size:24px}
.actions{display:flex;gap:16px;align-items:center;flex-wrap:wrap}.navlink{color:#2a5d9c;font-weight:700}
.pill{border:1px solid #c8d7e8;border-radius:9px;padding:9px 15px;font:inherit;font-weight:700;background:white;color:var(--blue)}
.pill:disabled{opacity:.55;cursor:not-allowed}.hero{background:linear-gradient(120deg,#172a46,#254d77);color:white;padding:50px 0}
.hero h1{font-size:clamp(31px,4vw,49px);margin:0 0 10px;line-height:1.2}.hero p{font-size:18px;margin:0;color:#e5edf7}
.main{padding:35px 0 70px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:15px;flex-wrap:wrap}
h2{font-size:25px;margin:0 0 20px}h1.title{font-size:clamp(26px,4vw,39px);margin:16px 0}
.search{display:flex;gap:10px;margin-bottom:20px}.search input{width:100%;min-width:0;padding:13px 15px;border:1px solid #cad8e7;border-radius:10px;background:white;font:inherit}
.btn{border:0;border-radius:10px;background:var(--blue);color:white;padding:12px 21px;font:inherit;font-weight:750;cursor:pointer;white-space:nowrap}
.filters{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:26px}.chip{background:white;border:1px solid var(--line);padding:8px 16px;border-radius:999px;font-weight:650}
.chip.active{background:var(--navy);border-color:var(--navy);color:white}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}.course{background:white;border:1px solid var(--line);border-radius:15px;overflow:hidden;transition:transform .15s}
.course:hover{transform:translateY(-3px)}.thumb{aspect-ratio:16/9;background:linear-gradient(135deg,#1f4168,#357b96);display:grid;place-items:center;color:white;font-size:44px}
.thumb img{width:100%;height:100%;object-fit:cover}.course-body{padding:21px}.course-title{font-size:19px;font-weight:800;line-height:1.4;margin-bottom:8px}
.course-description{color:var(--muted);margin:0 0 15px}.category{display:inline-block;background:#e9f2fc;color:#2f6295;padding:4px 11px;border-radius:6px;font-size:14px;font-weight:750}
.empty{border:1px dashed #becddd;background:#fff;padding:45px 24px;border-radius:15px;font-size:20px;text-align:center}
.back{display:inline-block;color:var(--blue);font-weight:750;margin-bottom:8px}.video{background:#14243b;aspect-ratio:16/9;display:grid;place-items:center;color:white;border-radius:15px;overflow:hidden}
.video iframe,.video video{width:100%;height:100%;border:0;display:block}.placeholder{font-weight:750}
.details{padding:30px;background:white;border:1px solid var(--line);border-radius:15px;margin-top:22px}.desc{font-size:17px;color:var(--muted);white-space:pre-wrap}
.comments{background:white;border:1px solid var(--line);padding:26px;margin-top:22px;border-radius:15px}.comment{border-top:1px solid var(--line);padding:16px 0}
.comment-name{font-weight:750}.muted{color:var(--muted)}.share-row{margin-top:20px}
.footer{padding:24px 0;border-top:1px solid var(--line);background:white;color:var(--muted)}
[hidden]{display:none!important}
.mobile-tabs{display:none}
.admin-form{display:grid;gap:17px}.field-label{font-weight:700;display:grid;gap:7px}
.field-label input,.field-label select,.field-label textarea{display:block;width:100%;font:inherit;padding:12px;border-radius:10px;border:1px solid #becddd;background:#fff;color:var(--ink);min-width:0}
.field-label input,.field-label select{min-height:48px}.field-label textarea{resize:vertical}
.source-box{display:grid;gap:12px;padding:16px;background:var(--paper);border:1px solid var(--line);border-radius:12px}
.check-row{display:flex;gap:12px;align-items:flex-start;line-height:1.45}.check-row input{width:22px;height:22px;flex:none}
.admin-submit{min-height:49px}.admin-submit:disabled{opacity:.55}.notice{margin:14px 0;padding:13px;border-radius:10px;background:#edf4fb;color:#244971}
.video-list{display:grid;gap:13px}.video-item{border:1px solid var(--line);border-radius:12px;background:#fbfdff;padding:16px}
.video-item h3{margin:0 0 8px;line-height:1.35}.video-item p{margin:5px 0}.admin-controls{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
.admin-controls .pill{min-height:44px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}
.admin-controls .pill:disabled{opacity:.6}
.publish-status{display:block;margin:12px 0 0;line-height:1.55}
.publish-status[hidden]{display:none!important}
@media(max-width:680px){
 .wrap{padding:0 17px}.nav{min-height:72px}.brand{font-size:17px}.mark{width:38px;height:38px;font-size:21px}
 .hero{padding:36px 0}.main{padding:27px 0 calc(110px + env(safe-area-inset-bottom))}
 .search{flex-wrap:wrap}.search .btn{width:100%}.details,.comments{padding:20px}.actions{gap:8px}
 .actions #account-link,.actions #admin-nav-link{display:none}
 .actions #auth-link{font-size:13px;padding:8px 10px}
 .mobile-tabs{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:50;background:white;border-top:1px solid var(--line);padding:9px 7px calc(10px + env(safe-area-inset-bottom));box-shadow:0 -3px 15px rgba(0,0,0,.05);justify-content:space-evenly}
 .mobile-tabs a{display:flex;flex:1;min-height:48px;align-items:center;justify-content:center;font-size:14px;text-align:center;font-weight:750;color:var(--blue);padding:5px 9px}
 .footer{padding-bottom:calc(90px + env(safe-area-inset-bottom))}
 .admin-controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}
 .admin-controls .pill{padding:9px 12px;min-width:0;white-space:normal}
}
`;
const esc=(v)=>String(v==null?'':v).replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ID=/^[A-Za-z0-9_-]{3,64}$/;
const head=(nonce,title)=>'<!doctype html><html lang="zh-Hant-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#182e49"><title>'+esc(title)+'｜寰宇行動大學</title><style nonce="'+nonce+'">'+CSS+'</style></head><body>';
const nav='<header class="top"><div class="wrap nav"><a href="/" class="brand"><span class="mark">▶</span>寰宇行動大學</a><div class="actions"><a class="navlink" href="/">所有課程</a><a class="pill" id="auth-link" href="/login">使用 H-Global1985 登入</a><a class="navlink" id="account-link" href="/settings">我的學習／帳號設定</a><a class="navlink" id="admin-nav-link" href="/admin" hidden>影片管理</a></div></div></header>';
const foot='<footer class="footer"><div class="wrap">寰宇行動大學</div></footer><nav class="mobile-tabs" aria-label="手機快速導覽"><a href="/">探索課程</a><a href="/settings">我的學習／帳號</a><a id="admin-tab" href="/admin" hidden>影片管理</a></nav>';
const nonce=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/=+$/,'');
const headers=(n)=>({'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','strict-transport-security':'max-age=31536000; includeSubDomains','cache-control':'no-store','content-security-policy':"default-src 'none'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; style-src 'nonce-"+n+"'; script-src 'nonce-"+n+"'; img-src 'self' https://i.ytimg.com https://image.mux.com data:; frame-src https://www.youtube-nocookie.com https://player.mux.com; media-src https://stream.mux.com; connect-src 'self' https://stream.mux.com https://id.hglobal1985.com"});
const render=(markup,title,status=200,script='')=>{
 const n=nonce(); const js='<script nonce="'+n+'">'+AUTH_BROWSER_JS+'\n'+ADMIN_BROWSER_JS+'\n'+script+'</script>';
 return new Response(head(n,title)+nav+markup+foot+js+'</body></html>',{status,headers:headers(n)});
};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
const filter=(request)=>{const u=new URL(request.url);return {q:(u.searchParams.get('q')||'').trim().slice(0,100),category:(u.searchParams.get('category')||'').trim().slice(0,60)}};
async function queryCatalog(env,request){
 const {q,category}=filter(request);
 const viewer=await getViewer(request);
 const sql="SELECT id,title,description,category,access_mode,audience,min_rank_code,source_type,source_id,mux_playback_policy,status FROM videos WHERE status='published'"+(viewer?"":" AND access_mode='public'")+" AND (?='' OR title LIKE ? OR description LIKE ?) AND (?='' OR category=?) ORDER BY created_at DESC LIMIT 100";
 const qlike='%'+q+'%';
 const rows=await env.DB.prepare(sql).bind(q,qlike,qlike,category,category).all();
 const candidates=rows.results||[];
 const flags=await Promise.all(candidates.map(v=>allowed(request,v,viewer)));
 return {videos:candidates.filter((_,i)=>flags[i]),q,category};
}
function courseCard(v){
 const title=esc(v.title),description=esc(v.description||''),category=esc(v.category),url='/'+encodeURIComponent(v.id);
 const muxPublic=v.source_type==='mux'&&v.mux_playback_policy==='public'&&/^[A-Za-z0-9]+$/.test(v.source_id);
 const thumb=v.source_type==='youtube'&&/^[A-Za-z0-9_-]{11}$/.test(v.source_id)?'<img alt="" loading="lazy" src="https://i.ytimg.com/vi/'+v.source_id+'/hqdefault.jpg">':
  muxPublic?'<img alt="" loading="lazy" src="https://image.mux.com/'+v.source_id+'/thumbnail.webp?width=640">':'▶';
 return '<a class="course" href="'+url+'"><div class="thumb">'+thumb+'</div><div class="course-body"><div class="course-title">'+title+'</div><p class="course-description">'+description.slice(0,150)+'</p><span class="category">'+category+'</span></div></a>';
}
async function homepage(env,req){
 const {videos,q,category}=await queryCatalog(env,req);
 const catRows=await env.DB.prepare("SELECT DISTINCT category FROM videos WHERE status='published' AND access_mode='public' ORDER BY category LIMIT 50").all();
 const cats=(catRows.results||[]).map(x=>String(x.category));
 const urlFor=(cat)=>'/?'+new URLSearchParams({q,category:cat}).toString();
 const chips='<a class="chip'+(!category?' active':'')+'" href="'+esc(urlFor(''))+'">全部</a>'+cats.map(c=>'<a class="chip'+(c===category?' active':'')+'" href="'+esc(urlFor(c))+'">'+esc(c)+'</a>').join('');
 const markup='<section class="hero"><div class="wrap"><h1>寰宇行動大學</h1><p>隨時隨地，讓學習持續發生。</p></div></section>'+
 '<main class="wrap main"><h2>探索課程</h2><form class="search" method="get" action="/"><input aria-label="搜尋課程" name="q" placeholder="搜尋課程" maxlength="100" value="'+esc(q)+'"><input type="hidden" name="category" value="'+esc(category)+'"><button class="btn" type="submit">搜尋</button></form>'+
 '<div class="filters">'+chips+'</div><div id="catalog">'+(videos.length?'<div class="grid">'+videos.map(courseCard).join('')+'</div>':'<div class="empty">目前尚未上架公開課程</div>')+'</div></main>';
 return render(markup,'探索課程');
}
async function findVideo(env,id){
 if(!ID.test(id))return null;
 return env.DB.prepare('SELECT * FROM videos WHERE id=?').bind(id).first();
}
async function detail(env,req,id){
 const v=await findVideo(env,id);
 if(!v)return render('<main class="wrap main"><h1 class="title">找不到影片</h1><a class="back" href="/">返回課程</a></main>','找不到影片',404);
 if(!canViewPublic(v))return render('<main class="wrap main" id="restricted-video"><h1 class="title">需要符合資格才能瀏覽此內容</h1><a class="pill" href="/login">使用 H-Global1985 登入</a><p id="auth-message" class="muted"></p><a class="back" href="/">返回課程</a></main>','沒有觀看資格',403);
 let player='<div class="placeholder">影片尚未提供播放</div>';
 if(v.source_type==='youtube'&&/^[A-Za-z0-9_-]{11}$/.test(v.source_id)){
  player='<iframe title="'+esc(v.title)+'" src="https://www.youtube-nocookie.com/embed/'+v.source_id+'?rel=0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
 } else if(v.source_type==='mux'&&v.mux_playback_policy==='public'&&/^[A-Za-z0-9]+$/.test(v.source_id)){
  player='<iframe title="'+esc(v.title)+'" src="https://player.mux.com/'+v.source_id+'?preload=none" allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="no-referrer"></iframe>';
 }
 const rows=await env.DB.prepare("SELECT id,body,parent_comment_id,created_at FROM comments WHERE video_id=? AND status='visible' ORDER BY created_at ASC LIMIT 200").bind(id).all();
 const comments=(rows.results||[]).map(c=>'<div class="comment"><div class="comment-name">會員</div><div>'+esc(c.body)+'</div></div>').join('')||'<p class="muted">目前沒有留言</p>';
 const markup='<main class="wrap main"><a class="back" href="/">← 返回課程</a><div class="video">'+player+'</div><div class="details"><span class="category">'+esc(v.category)+'</span><h1 class="title">'+esc(v.title)+'</h1><div class="desc">'+esc(v.description||'')+'</div><div class="share-row"><button id="share" class="btn">分享影片</button></div></div>'+
 '<section class="comments"><h2>學習心得與討論</h2>'+comments+'<button class="pill" disabled>登入後留言</button></section></main>';
 return render(markup,esc(v.title));
}
async function publicApi(req,env,path){
 if(path==='/v1/health')return json({status:'ok',project:'learn',phase:'central-relay',central_auth:'relay',contract_version:'2026-11-10.2'});
 const viewer=await getViewer(req);
 if(path==='/v1/session')return json({authenticated:!!viewer,member_sub:viewer?.sub||null});
 if(path==='/v1/videos'){
  const data=await queryCatalog(env,req);
  return json({videos:data.videos.map(v=>({id:v.id,title:v.title,description:v.description,category:v.category,source_type:v.source_type,access_mode:v.access_mode})),total:data.videos.length});
 }
 if(path==='/v1/admin/handoff'&&req.method==='GET'){
  if(!viewer)return json({error:{code:'unauthenticated',message:'請先登入'}},401);
  try{
   const central=await fetch('https://id.hglobal1985.com/v1/apps/learn/handoff?integrated=2026-11-10.2',{headers:{Authorization:req.headers.get('authorization')},signal:AbortSignal.timeout(5000)});
   if(!central.ok)return json({error:{code:'forbidden',message:'沒有管理權限'}},403);
   return json(await central.json());
  }catch{return json({error:{code:'central_unavailable',message:'服務暫時無法使用'}},503)}
 }
 const m=path.match(/^\/v1\/videos\/([A-Za-z0-9_-]{3,64})(?:\/(comments|playback))?$/);
 if(!m)return json({error:{code:'not_found',message:'找不到此功能'}},404);
 const v=await findVideo(env,m[1]);
 if(!v)return json({error:{code:'not_found',message:'影片不存在'}},404);
 if(!await allowed(req,v,viewer))return json({error:{code:'forbidden',message:'需要符合資格才能瀏覽此內容'}},403);
 if(m[2]==='comments'){
  if(req.method!=='GET')return json({error:{code:'unauthenticated',message:'尚未開放留言'}},401);
  const rs=await env.DB.prepare("SELECT id,body,parent_comment_id,created_at FROM comments WHERE video_id=? AND status='visible' ORDER BY created_at ASC LIMIT 200").bind(v.id).all();
  return json({comments:(rs.results||[]).map(x=>({id:x.id,body:x.body,parent_comment_id:x.parent_comment_id,created_at:x.created_at,is_mine:false}))});
 }
 if(m[2]==='playback'){
  if(req.method!=='POST')return json({error:{code:'invalid_method',message:'請求方式無效'}},405);
  try{
   const playback=await muxPlayback(env,v);
   if(!playback)return json({error:{code:'not_available',message:'影片串流功能尚未啟用'}},503);
   return json(playback);
  }catch{return json({error:{code:'not_available',message:'影片串流功能尚未啟用'}},503)}
 }
 if(req.method!=='GET')return json({error:{code:'invalid_method',message:'請求方式無效'}},405);
 return json({video:{id:v.id,title:v.title,description:v.description,source_type:v.source_type,source_id:v.source_type==='youtube'?v.source_id:undefined,category:v.category,access_mode:v.access_mode,created_at:v.created_at},share_url:BASE+'/'+v.id});
}
export default{
 async fetch(request,env){
  const u=new URL(request.url),path=u.pathname;
  try{
   if(!env.DB)return json({error:{code:'db_unavailable',message:'資料庫未連線'}},503);
   if(path.startsWith('/v1/admin/')&&path!=='/v1/admin/handoff')return adminRoute(request,env);
   if(request.method==='GET'||request.method==='HEAD'){
    if(path==='/favicon.ico')return new Response(null,{status:204});
    if(path==='/login')return render('<main class="wrap main"><h1 class="title">使用 H-Global1985 登入</h1><p id="auth-message">正在開啟中央會員登入…</p></main>','會員登入');
    if(path==='/auth/done')return render('<main class="wrap main"><h1 class="title">正在驗證登入</h1><p id="auth-message">請勿分享登入網址</p></main>','登入驗證');
    if(path==='/settings')return render('<main class="wrap main"><a class="back" href="/">← 返回課程</a><h1 class="title">我的學習與帳號設定</h1><div class="details"><p id="auth-message" class="muted"></p><p>會員識別碼：<span id="member-id">尚未登入</span></p><p><a class="pill" id="settings-login" href="/login">使用 H-Global1985 登入</a></p><p><button class="pill" id="logout" hidden>登出此裝置</button></p><p><a class="pill" id="manage-link" href="/admin" hidden>超級管理員｜影片管理與上傳</a></p></div><div class="details"><h2>帳號與隱私</h2><p><a class="navlink" href="https://id.hglobal1985.com/me">修改會員資料／申請刪除帳號</a></p><p><a class="navlink" href="https://id.hglobal1985.com/privacy">隱私權政策</a></p><p><a class="navlink" href="https://id.hglobal1985.com/privacy/amway">完整隱私說明</a></p></div></main>','我的學習與帳號設定');
    if(path==='/admin')return render(ADMIN_PAGE,'影片管理');
    if(path.startsWith('/v1/'))return publicApi(request,env,path);
    if(path==='/')return homepage(env,request);
    if(/^\/[A-Za-z0-9_-]{3,64}\/?$/.test(path))return detail(env,request,path.slice(1).replace(/\/$/,''));
   }
   if(path.startsWith('/v1/')){
    if(request.method==='POST'&&/^\/v1\/videos\/[A-Za-z0-9_-]{3,64}\/playback$/.test(path))return publicApi(request,env,path);
    return json({error:{code:'unauthenticated',message:'請先登入'}},401);
   }
   return render('<main class="wrap main"><h1>找不到頁面</h1><a class="back" href="/">返回課程</a></main>','找不到頁面',404);
  }catch{
   return path.startsWith('/v1/')?json({error:{code:'server_error',message:'暫時無法使用'}},503):
   render('<main class="wrap main"><h1>服務暫時無法使用</h1></main>','服務狀態',503);
  }
 }
};
