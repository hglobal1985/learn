// Browser-only login relay; this literal is placed in the same-origin nonce-protected page.
export const AUTH_BROWSER_JS=String.raw`
(()=>{
 const BASE='https://id.hglobal1985.com',APP_ID='learn',VERSION='2026-11-10.2';
 const REF='hglobal.learn.refresh',PENDING='hglobal.learn.pending';
 let access=null,until=0,refreshing=null;
 const byId=id=>document.getElementById(id);
 const safePath=path=>path&&path.startsWith('/')&&!path.startsWith('//')&&!path.includes('\\')?path:'/';
 const show=message=>{const el=byId('auth-message');if(el)el.textContent=message;};
 document.addEventListener('click',e=>{
  const a=e.target&&e.target.closest&&e.target.closest('a[href="/login"]');
  if(a&&location.pathname!=='/login'&&location.pathname!=='/auth/done'){
   sessionStorage.setItem('hglobal.learn.return',location.pathname+location.search);
  }
 });
 async function visit(url,replace=false){
  const u=new URL(url,location.href);
  try{
   const response=await fetch(u.pathname+u.search,{credentials:'omit'});
   if(response.status>=500)throw Error('navigation_unavailable');
   const doc=new DOMParser().parseFromString(await response.text(),'text/html');
   if(!doc.body||!doc.querySelector('main'))throw Error('invalid_page');
   const nodes=Array.from(doc.body.childNodes).filter(node=>node.nodeType!==1||node.tagName!=='SCRIPT');
   document.body.replaceChildren(...nodes);
   document.title=doc.title;
   if(replace)history.replaceState({},'',u.pathname+u.search);
   else history.pushState({},'',u.pathname+u.search);
   window.scrollTo(0,0);
   await bootstrap();
   if(u.pathname==='/admin')void window.__learnAdminInit?.();
  }catch{location.assign(u.pathname+u.search)}
 }
 document.addEventListener('click',e=>{
  const button=e.target&&e.target.closest&&e.target.closest('#share');
  if(button){
   e.preventDefault();
   const url=location.href;
   if(navigator.share)void navigator.share({url,title:document.title}).catch(()=>{});
   else if(navigator.clipboard)void navigator.clipboard.writeText(url).then(()=>{button.textContent='已複製網址'}).catch(()=>{});
   return;
  }
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.altKey||e.shiftKey)return;
  const a=e.target&&e.target.closest&&e.target.closest('a[href]');
  if(!a||a.target||a.download)return;
  const u=new URL(a.href,location.href);
  if(u.origin!==location.origin||u.pathname==='/login'||u.pathname==='/auth/done')return;
  e.preventDefault();void visit(u.href);
 });
 window.addEventListener('popstate',()=>void visit(location.href,true));
 async function call(path,opts={}){
  const r=await fetch(BASE+path,{...opts,credentials:'omit'});
  if(!r.ok){const e=await r.json().catch(()=>({}));const error=new Error(e.error&&e.error.message||'中央會員暫時無法使用');error.status=r.status;error.code=e.error&&e.error.code;throw error;}
  return r.status===204?null:r.json();
 }
 function remember(d){sessionStorage.setItem(REF,d.refresh_token);access=d.access_token;until=Date.now()+Math.max(0,d.expires_in-30)*1000}
 function clear(){access=null;until=0;sessionStorage.removeItem(REF);sessionStorage.removeItem(PENDING)}
 async function rotate(){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   const old=sessionStorage.getItem(REF);if(!old)return false;
   try{const data=await call('/v1/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:old})});remember(data);return true;}
   catch{clear();return false;}
  })();
  try{return await refreshing}finally{refreshing=null}
 }
 async function token(){return access&&Date.now()<until?access:await rotate()?access:null}
 async function protectedCall(path,method='GET',body){
  let t=await token();if(!t)throw Error('請先登入');
  const isLocal=/^\/v1\/(?:videos(?:\/|\?|$)|admin(?:\/|\?|$))/.test(path);
  const send=t=>fetch(isLocal?path:BASE+path,{method,headers:{Authorization:'Bearer '+t,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  let r=await send(t);
  if(r.status===401&&await rotate())r=await send(access);
  if(!r.ok)throw Error('目前沒有瀏覽資格');
  return r.json();
 }
 window.__learnApi=Object.freeze({protectedCall});
 async function start(){
  try{
   const conf=await call('/v1/apps/learn/config');
   if(conf.status!=='active'){show('目前正在維護中');return}
   const info=await call('/v1/auth/nonce',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:APP_ID})});
   const bytes=crypto.getRandomValues(new Uint8Array(24));const state=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(info.nonce));
   const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
   let returnTo='/';
   try{const p=sessionStorage.getItem('hglobal.learn.return');if(p)returnTo=safePath(p)}catch{}
   sessionStorage.setItem(PENDING,JSON.stringify({nonce:info.nonce,state,time:Date.now(),returnTo}));
   const u=new URL(BASE+'/auth/google/start');
   u.searchParams.set('app_id',APP_ID);u.searchParams.set('nonce',hex);
   u.searchParams.set('return','https://learn.hglobal1985.com/auth/done');u.searchParams.set('state',state);
   location.assign(u.toString());
  }catch{show('登入服務暫時無法使用')}
 }
 async function complete(){
  const frag=location.hash;history.replaceState(null,'',location.pathname);
  const raw=sessionStorage.getItem(PENDING);sessionStorage.removeItem(PENDING);
  if(!raw){show('缺少登入驗證資料');return}
  try{
   const p=JSON.parse(raw),q=new URLSearchParams(frag.slice(1));
   if(!p.nonce||Date.now()-p.time>600000||q.get('state')!==p.state||q.has('error'))throw Error();
   const id=q.get('id_token');if(!id)throw Error();
   const d=await call('/v1/auth/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({app_id:APP_ID,id_token:id,nonce:p.nonce})});
   if(d.user.status!=='active'||!d.user.member_id)throw Error();
   remember(d);location.replace(safePath(p.returnTo));
  }catch{clear();show('登入未完成，請重新登入')}
 }
 async function signOut(){
  try{const t=await token();if(t)await call('/v1/auth/logout',{method:'POST',headers:{Authorization:'Bearer '+t}})}catch{}
  clear();location.replace('/');
 }
 async function bootstrap(){
  const path=location.pathname;
  if(path==='/auth/done'){await complete();return}
  if(path==='/login'){await start();return}
  let status='offline';
  try{
   const cfg=await call('/v1/apps/learn/config');
   status=cfg.status;
   const min=cfg.min_version.split('.').map(Number),cur=[0,1,0];
   for(let i=0;i<3;i++){if((cur[i]||0)!==(min[i]||0)){if((cur[i]||0)<(min[i]||0))status='upgrade';break}}
  }catch{}
  if(status==='paused'||status==='killed'||status==='upgrade'){
   const h=document.querySelector('main');if(h){h.textContent='';const t=document.createElement('h1');t.textContent=status==='paused'?'維護中':status==='killed'?'這款 App 目前已停止服務':'請更新 App';h.append(t)}
   return;
  }
  if(status==='offline'){show('會員服務暫時無法連線，公開課程仍可使用');return}
  const t=await token();
  if(t){
   try{
    const profile=await protectedCall('/v1/me/profile');
    const authLink=byId('auth-link');if(authLink)authLink.hidden=true;
    const settingsLogin=byId('settings-login');if(settingsLogin)settingsLogin.hidden=true;
    const member=byId('member-id');if(member)member.textContent=profile.member_id;
    const signout=byId('logout');if(signout)signout.hidden=false;
    try{
     const admin=await protectedCall('/v1/admin/session');
     if(admin?.is_super_admin===true){
      for(const key of ['admin-nav-link','admin-tab','manage-link']){const el=byId(key);if(el)el.hidden=false}
     }
    }catch{}
    if(path==='/'){
     const params=new URLSearchParams(location.search);
     const q=new URLSearchParams({q:params.get('q')||'',category:params.get('category')||''});
     const data=await protectedCall('/v1/videos?'+q);
     const container=byId('catalog');
     if(container&&Array.isArray(data.videos)){
      container.textContent='';
      if(!data.videos.length){const e=document.createElement('div');e.className='empty';e.textContent='目前尚未上架符合資格的課程';container.append(e)}
      else{
       const grid=document.createElement('div');grid.className='grid';
       for(const v of data.videos){
        const a=document.createElement('a');a.className='course';a.href='/'+encodeURIComponent(v.id);
        const thumb=document.createElement('div');thumb.className='thumb';thumb.textContent='▶';
        const details=document.createElement('div');details.className='course-body';
        const title=document.createElement('div');title.className='course-title';title.textContent=v.title;
        const desc=document.createElement('p');desc.className='course-description';desc.textContent=v.description||'';
        details.append(title,desc);a.append(thumb,details);grid.append(a);
       }
       container.append(grid);
      }
     }
    }
    const id=path.slice(1);
    if(/^[-_A-Za-z0-9]{3,64}$/.test(id)&&path!=='/settings'&&path!=='/admin'){
     try{
      const info=await protectedCall('/v1/videos/'+id);
      const restricted=byId('restricted-video');
      if(restricted){
       restricted.textContent='';
       const h=document.createElement('h1');h.className='title';h.textContent=info.video.title;
       const desc=document.createElement('p');desc.textContent=info.video.description||'';
       restricted.append(h,desc);
       const player=document.createElement('div');player.className='video';player.textContent='正在取得播放授權…';
       restricted.append(player);
       try{
        const playback=await protectedCall('/v1/videos/'+id+'/playback','POST');
        if(playback.type==='youtube'&&/^[-_A-Za-z0-9]{11}$/.test(playback.video_id)){
         const iframe=document.createElement('iframe');iframe.title=info.video.title;
         iframe.src='https://www.youtube-nocookie.com/embed/'+playback.video_id;iframe.allowFullscreen=true;
         player.textContent='';player.append(iframe);
        }else if(playback.type==='mux'&&/^[A-Za-z0-9]+$/.test(playback.playback_id)&&
          (playback.public||playback.playback_token)){
         const iframe=document.createElement('iframe');iframe.title=info.video.title;
         iframe.src='https://player.mux.com/'+playback.playback_id+
           (playback.playback_token?'?playback-token='+encodeURIComponent(playback.playback_token):'?preload=none');
         iframe.allowFullscreen=true;iframe.referrerPolicy='no-referrer';
         player.textContent='';player.append(iframe);
        }else player.textContent='影片尚未提供播放';
       }catch{player.textContent='影片播放服務尚未準備好'}

      }
     }catch{}
    }
   if(path==='/admin')void window.__learnAdminInit?.();
   }catch{clear()}
  }
  const signout=byId('logout');
  if(signout)signout.addEventListener('click',()=>void signOut());
 }
 void bootstrap();
})();
`;
