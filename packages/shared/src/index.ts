/** Shared permission logic. All rank checks must be decided by the central membership service. */
export type AccessMode='public'|'members'|'rank';
export type VideoSource='mux'|'youtube';
export type VideoStatus='draft'|'published'|'unlisted';
export type VideoRecord={
 id:string;title:string;description:string;access_mode:AccessMode;min_rank_code:string|null;
 source_type:VideoSource;source_id:string;youtube_visibility:'public'|'unlisted'|null;
 category:string;status:VideoStatus;accepted_unlisted_risk?:number;mux_asset_id?:string|null;
 mux_playback_policy?:'signed'|'public'|null;duration_seconds?:number|null;created_at?:string;
};
export type Viewer={sub:string}|null;
export type EligibilityCheck=(rule:{audience:'hglobal_verified';min_rank:string|null},sub:string)=>Promise<boolean>;
export async function canView(video:VideoRecord,viewer:Viewer,check:EligibilityCheck):Promise<boolean>{
 if(video.status!=='published')return false;
 if(video.access_mode==='public')return true;
 if(!viewer?.sub)return false;
 if(video.access_mode==='members')return true;
 try{return (await check({audience:'hglobal_verified',min_rank:video.min_rank_code},viewer.sub))===true;}
 catch{return false;}
}
export type AdminPermission='upload'|'videos.manage'|'videos.publish'|'videos.access'|'comments.moderate'|'admins.manage';
export function hasPermission(grants:ReadonlySet<AdminPermission>,permission:AdminPermission):boolean{return grants.has(permission)}
export const VIDEO_ID=/^[a-zA-Z0-9_-]{3,64}$/;
export function shareUrl(videoId:string,base='https://learn.hglobal1985.com'):string{
 if(!VIDEO_ID.test(videoId))throw new Error('invalid_video_id');
 return base.replace(/\/$/,'')+'/'+encodeURIComponent(videoId);
}
export function youtubeId(input:string):string|null{
 try{
  const u=new URL(input);const host=u.hostname.toLowerCase();let value:string|null=null;
  if(host==='youtu.be')value=u.pathname.split('/')[1]||null;
  else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)){
   if(u.pathname==='/watch')value=u.searchParams.get('v');
   else if(/^\/(embed|shorts|live)\//.test(u.pathname))value=u.pathname.split('/')[2]||null;
  }
  return value&&/^[a-zA-Z0-9_-]{11}$/.test(value)?value:null;
 }catch{return null;}
}
export function isMuxPublishable(video:VideoRecord,actualPlaybackPolicies:readonly string[]):boolean{
 if(video.source_type!=='mux')return true;
 if(video.access_mode!=='public')return actualPlaybackPolicies.includes('signed')&&!actualPlaybackPolicies.includes('public')&&actualPlaybackPolicies.every(p=>p==='signed');
 return actualPlaybackPolicies.includes('signed')||actualPlaybackPolicies.includes('public');
}
export type CatalogList={visible:VideoRecord[];total:number};
export async function visibleCatalog(videos:VideoRecord[],viewer:Viewer,check:EligibilityCheck):Promise<CatalogList>{
 const decision=await Promise.all(videos.map(v=>canView(v,viewer,check)));
 const visible=videos.filter((_,i)=>decision[i]);
 return {visible,total:visible.length};
}
