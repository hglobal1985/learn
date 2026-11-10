import {DEMO_VIDEOS,demoPublished,demoCanView,demoComments,addDemoComment,type CatalogItem,type DemoComment} from './demo';
import {DEMO_MODE} from './session';
import type {DemoIdentity} from './demo';
import {token,refresh} from './central-auth';
export const API_ORIGIN=process.env.EXPO_PUBLIC_API_ORIGIN||'https://learn.hglobal1985.com';
export async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const send=async(bearer:string|null)=>fetch(`${API_ORIGIN}/v1/${path}`,{
  method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(bearer?{Authorization:'Bearer '+bearer}:{})},
  body:body?JSON.stringify(body):undefined
 });
 let bearer=await token();
 let r=await send(bearer);
 if(r.status===401&&bearer&&await refresh()){bearer=await token();r=await send(bearer)}
 const value=await r.json();
 if(!r.ok)throw Error(value?.error?.message||`請求失敗：${r.status}`);
 return value as T;
}
export async function listCatalog(identity:DemoIdentity,search='',category=''):Promise<CatalogItem[]>{
 if(DEMO_MODE)return [...demoPublished,...DEMO_VIDEOS].filter(x=>demoCanView(x.access_mode,identity)&&(!search||(x.title+x.description).includes(search))&&(!category||x.category===category));
 const q=new URLSearchParams({q:search,category});
 return (await request<{videos:CatalogItem[]}>(`videos?${q.toString()}`)).videos;
}
export async function getCatalogVideo(id:string,identity:DemoIdentity):Promise<CatalogItem>{
 if(DEMO_MODE){const v=[...demoPublished,...DEMO_VIDEOS].find(x=>x.id===id);if(!v||!demoCanView(v.access_mode,identity))throw Error('需要符合資格才能瀏覽此內容');return v;}
 return (await request<{video:CatalogItem}>(`videos/${encodeURIComponent(id)}`)).video;
}
export async function getPlayback(videoId:string):Promise<{type:'mux'|'youtube';url?:string;video_id?:string}>{
 if(DEMO_MODE)throw Error('目前尚未連接正式影片來源');
 return request(`videos/${encodeURIComponent(videoId)}/playback`,'POST');
}
export async function listComments(videoId:string):Promise<DemoComment[]>{
 if(DEMO_MODE)return demoComments.filter(c=>c.video_id===videoId);
 return (await request<{comments:DemoComment[]}>(`videos/${encodeURIComponent(videoId)}/comments`)).comments;
}
export async function postComment(videoId:string,author:string,body:string,parent_comment_id:string|null):Promise<void>{
 if(DEMO_MODE){addDemoComment(videoId,author,body,parent_comment_id);return}
 await request(`videos/${encodeURIComponent(videoId)}/comments`,'POST',{body,parent_comment_id});
}
