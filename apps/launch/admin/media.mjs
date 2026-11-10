/** Server-side content-source validation; never fetches arbitrary YouTube URLs. */
export function youtubeId(input){
 if(typeof input!=='string'||input.length>400)return null;
 try{
  const url=new URL(input.trim());
  if(url.protocol!=='https:')return null;
  const h=url.hostname.toLowerCase();
  let id=null;
  if(h==='youtu.be')id=url.pathname.split('/')[1];
  else if(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(h)){
   const p=url.pathname.split('/').filter(Boolean);
   if(p[0]==='watch')id=url.searchParams.get('v');
   else if(['shorts','live','embed','v'].includes(p[0]))id=p[1];
  }
  return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
 }catch{return null}
}
export function videoForm(body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid_body');
 const title=String(body.title||'').trim(),description=String(body.description||'').trim();
 const category=String(body.category||'一般').trim();
 if(!title||title.length>120||description.length>3000||!category||category.length>60)throw Error('invalid_fields');
 const source=body.source_type;
 if(!['youtube','mux'].includes(source))throw Error('invalid_source');
 const access=body.access_mode??(source==='mux'?'rank':'public');
 if(!['public','members','rank'].includes(access))throw Error('invalid_access');
 const audience=access==='rank'?(body.audience||'hglobal_verified'):'everyone';
 if(!['hglobal_verified','everyone'].includes(audience))throw Error('invalid_audience');
 const rank=access==='rank'&&audience==='hglobal_verified'&&body.min_rank_code?String(body.min_rank_code).trim():null;
 if(rank&&!/^[A-Za-z0-9_-]{1,40}$/.test(rank))throw Error('invalid_rank');
 if(audience==='everyone'&&body.min_rank_code)throw Error('invalid_rank');
 if(source==='youtube'){
  const id=youtubeId(body.youtube_url);
  if(!id)throw Error('invalid_youtube');
  const visibility=body.youtube_visibility??'public';
  if(!['public','unlisted'].includes(visibility))throw Error('invalid_visibility');
  const risk=body.accept_unlisted_risk===true;
  if(access!=='public'&&(visibility!=='unlisted'||!risk))throw Error('youtube_not_private');
  return {title,description,category,access_mode:access,audience,min_rank_code:rank,source_type:source,source_id:id,asset_id:null,visibility,accepted_unlisted_risk:risk?1:0};
 }
 const asset=String(body.asset_id||'').trim();
 if(!/^[a-zA-Z0-9]{16,128}$/.test(asset))throw Error('invalid_asset_id');
 return {title,description,category,access_mode:access,audience,min_rank_code:rank,source_type:source,source_id:'',asset_id:asset,visibility:null,accepted_unlisted_risk:0};
}
function credentials(env){
 if(!env.MUX_TOKEN_ID||!env.MUX_TOKEN_SECRET)return null;
 return 'Basic '+btoa(env.MUX_TOKEN_ID+':'+env.MUX_TOKEN_SECRET);
}
async function muxGet(env,path){
 const auth=credentials(env);
 if(!auth)return null;
 const response=await fetch('https://api.mux.com/video/v1/'+path,{
  headers:{Authorization:auth,Accept:'application/json'},signal:AbortSignal.timeout(6000)
 });
 if(!response.ok)throw Error('mux_unavailable');
 const parsed=await response.json();
 return parsed.data||null;
}
export const hasMuxCredentials=env=>!!credentials(env);
export async function getMuxAsset(env,id){
 if(!/^[A-Za-z0-9]{16,128}$/.test(id))throw Error('invalid_asset_id');
 return muxGet(env,'assets/'+encodeURIComponent(id));
}
export async function listMuxAssets(env){
 const raw=await muxGet(env,'assets?limit=50');
 if(!raw)return null;
 return raw.map(v=>({
  id:v.id,title:typeof v.meta?.title==='string'?v.meta.title:'Mux 影片',
  status:v.status,duration_seconds:Math.ceil(Number(v.duration)||0),
  playback_policy:(v.playback_ids||[]).some(x=>x.policy==='signed')?'signed':(v.playback_ids||[]).some(x=>x.policy==='public')?'public':'none'
 })).filter(x=>/^[a-zA-Z0-9]{16,128}$/.test(x.id));
}
export function safeMuxPlayback(asset,mode){
 if(!asset||asset.status!=='ready')throw Error('mux_not_ready');
 const ids=Array.isArray(asset.playback_ids)?asset.playback_ids:[];
 if(mode!=='public'&&ids.some(x=>x.policy==='public'))throw Error('mux_public_playback_exists');
 const signed=ids.find(x=>x.policy==='signed'&&/^[A-Za-z0-9]+$/.test(x.id));
 const publicId=ids.find(x=>x.policy==='public'&&/^[A-Za-z0-9]+$/.test(x.id));
 const chosen=signed||(mode==='public'?publicId:null);
 if(!chosen)throw Error('mux_no_safe_playback');
 return {playback_id:chosen.id,policy:chosen.policy,duration_seconds:Math.ceil(Number(asset.duration)||0)};
}
