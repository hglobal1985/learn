/** Admin interactions run only after server-side Central superadmin permission checks. */
export const ADMIN_BROWSER_JS=String.raw`
(()=>{
 let currentRoot=null;
 const byId=id=>document.getElementById(id);
 const say=(id,message)=>{const el=byId(id);if(el){el.textContent=message;el.hidden=false}};
 const api=()=>window.__learnApi;
 const button=(label,action)=>{
  const b=document.createElement('button');b.type='button';b.className='pill';b.textContent=label;
  b.addEventListener('click',async()=>{
   b.disabled=true;
   try{await action()}catch(e){say('save-result',e instanceof Error?e.message:'操作失敗')}
   finally{b.disabled=false}
  });return b;
 };
 function updateForm(){
  const source=byId('source-type')?.value||'mux',access=byId('access-mode')?.value||'rank';
  const mux=source==='mux';
  if(byId('mux-source'))byId('mux-source').hidden=!mux;
  if(byId('youtube-source'))byId('youtube-source').hidden=mux;
  if(byId('rank-fields'))byId('rank-fields').hidden=access!=='rank';
  const risk=byId('youtube-risk');
  if(risk)risk.hidden=mux||access==='public';
  if(!mux&&access!=='public'){
   const vis=byId('youtube-visibility');if(vis)vis.value='unlisted';
  }
 }
 async function loadMux(){
  try{
   const data=await api().protectedCall('/v1/admin/mux/assets');
   const select=byId('mux-library');
   if(!select)return;
   select.textContent='';
   const blank=document.createElement('option');blank.value='';
   blank.textContent=data.connected?'選擇 Mux 影片（或輸入 Asset ID）':'尚未連線 Mux API，請輸入 Asset ID';
   select.append(blank);
   for(const item of data.assets||[]){
    if(!item.id)continue;
    const opt=document.createElement('option');opt.value=item.id;
    opt.textContent=item.title+' · '+item.status+' · '+item.playback_policy;
    opt.dataset.title=item.title;select.append(opt);
   }
   say('mux-status',data.connected?'從已上傳的 Mux 影片選取，不會重新上傳原檔。':
    '尚未連接 Mux API：可貼 Asset ID 儲存草稿。要瀏覽所有 Mux 影片及發布，需完成安全的 Mux 連線設定。');
  }catch{say('mux-status','暫時無法讀取 Mux 清單，可以貼上 Asset ID 建立草稿')}
 }
 async function loadRanks(){
  try{
   const data=await api().protectedCall('/v1/admin/ranks');
   const select=byId('min-rank');if(!select)return;
   const prior=select.value;select.textContent='';
   const blank=document.createElement('option');blank.value='';blank.textContent='無最低獎銜要求';select.append(blank);
   for(const item of data.ranks||[]){
    const option=document.createElement('option');option.value=item.value;option.textContent=item.label;
    select.append(option);
   }
   select.value=prior;
  }catch{say('save-result','獎銜選單暫時無法讀取；可先選擇其他觀看權限')}
 }
 function textItem(label,value){
  const p=document.createElement('p');p.className='muted';p.textContent=label+': '+String(value??'');
  return p;
 }
 async function loadVideos(){
  const container=byId('admin-videos');if(!container)return;
  container.textContent='正在讀取影片清單…';
  try{
   const data=await api().protectedCall('/v1/admin/videos');
   container.textContent='';
   if(!data.videos?.length){container.textContent='目前尚未新增影片';return}
   for(const v of data.videos){
    const row=document.createElement('article');row.className='video-item';
    const title=document.createElement('h3');title.textContent=v.title;
    const meta=textItem('來源',v.source_type==='mux'?'Mux':'YouTube');
    const status=textItem('狀態',v.status==='published'?'已發布':'草稿');
    const scope=textItem('觀看權限',v.access_mode==='public'?'公開':v.access_mode==='members'?'登入會員':'獎銜限定');
    const controls=document.createElement('div');controls.className='admin-controls';
    if(v.status==='published'){
     controls.append(button('下架',async()=>{
      await api().protectedCall('/v1/admin/videos/'+encodeURIComponent(v.id)+'/unpublish','POST');
      say('save-result','已下架為草稿');await loadVideos();
     }));
    }else{
     controls.append(button('發布影片',async()=>{
      await api().protectedCall('/v1/admin/videos/'+encodeURIComponent(v.id)+'/publish','POST');
      say('save-result','發布成功');await loadVideos();
     }));
    }
    const link=document.createElement('a');link.className='pill';link.href='/'+encodeURIComponent(v.id);
    link.textContent='影片頁面';controls.append(link);
    row.append(title,meta,status,scope,controls);container.append(row);
   }
  }catch{container.textContent='無法讀取影片清單，請重新登入後再試'}
 }
 async function bootAdmin(){
  const panel=byId('admin-panel');
  if(!panel||panel===currentRoot)return;
  currentRoot=panel;
  if(!api())return;
  try{
   const owner=await api().protectedCall('/v1/admin/session');
   if(owner?.is_super_admin!==true)throw Error('只有超級管理員可以使用影片管理');
   const status=byId('admin-status');if(status)status.hidden=true;
   panel.hidden=false;
   const form=byId('new-video');
   byId('source-type')?.addEventListener('change',()=>{
    if(byId('source-type').value==='youtube')byId('access-mode').value='public';
    else byId('access-mode').value='rank';
    updateForm();
   });
   byId('access-mode')?.addEventListener('change',updateForm);
   byId('mux-library')?.addEventListener('change',e=>{
    const select=e.currentTarget;
    const value=select.value||'';
    byId('mux-asset-id').value=value;
    const title=select.selectedOptions[0]?.dataset.title;
    if(title&&title!=='Mux 影片')form.elements.title.value=title;
   });
   byId('reload-videos')?.addEventListener('click',()=>void loadVideos());
   form?.addEventListener('submit',async e=>{
    e.preventDefault();
    const save=byId('save-video');
    if(save.disabled)return;
    save.disabled=true;say('save-result','正在儲存草稿…');
    try{
     const data=new FormData(form);
     const source=String(data.get('source_type')||'mux');
     const access=String(data.get('access_mode')||'rank');
     const body={
      source_type:source,title:String(data.get('title')||''),description:String(data.get('description')||''),
      category:String(data.get('category')||'一般'),access_mode:access,
      audience:'hglobal_verified',min_rank_code:access==='rank'?String(data.get('min_rank_code')||'')||null:null,
      asset_id:source==='mux'?String(data.get('asset_id')||''):'',
      youtube_url:source==='youtube'?String(data.get('youtube_url')||''):'',
      youtube_visibility:String(data.get('youtube_visibility')||'public'),
      accept_unlisted_risk:form.elements.accept_unlisted_risk.checked
     };
     const res=await api().protectedCall('/v1/admin/videos','POST',body);
     say('save-result','草稿已儲存。'+(res.needs_mux_connection?' Mux API 尚未連線，完成設定後才能發布。':''));
     form.reset();updateForm();await loadVideos();
    }catch(e){say('save-result',e instanceof Error?e.message:'影片資料儲存失敗')}
    finally{save.disabled=false}
   });
   updateForm();
   await Promise.all([loadVideos(),loadMux(),loadRanks()]);
  }catch{
   say('admin-status','只有已登入的 H-Global1985 超級管理員可以上傳與發布影片。請先登入並重新開啟本頁。');
  }
 }
 window.__learnAdminInit=bootAdmin;
 void bootAdmin();
})();
`;
