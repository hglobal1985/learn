import type {AccessMode, VideoRecord} from '../../../../packages/shared/src/index';
export type DemoIdentity='guest'|'member'|'verified';
export type CatalogItem=Pick<VideoRecord,'id'|'title'|'description'|'access_mode'|'category'|'source_type'> & {source_id?:string;youtube_url?:string;youtube_visibility?:'public'|'unlisted';accept_unlisted_risk?:boolean};
export const demoDrafts:CatalogItem[]=[];
export const demoPublished:CatalogItem[]=[];
export const DEMO_VIDEOS:CatalogItem[]=[
 {id:'nutrition101',title:'營養概論｜建立健康的基礎',description:'從每天的飲食開始，理解均衡營養的重要觀念。',access_mode:'public',category:'營養健康',source_type:'mux'},
 {id:'learnhabit',title:'高效率學習與行動養成',description:'把知識變成習慣，打造可持續的學習節奏。',access_mode:'members',category:'個人成長',source_type:'youtube'},
 {id:'leadership',title:'領導力進階培訓',description:'以真實情境練習團隊溝通、規劃與執行。',access_mode:'rank',category:'事業培訓',source_type:'mux'},
 {id:'practicelife',title:'生活中的健康管理',description:'將健康管理實踐在每天的生活安排。',access_mode:'public',category:'營養健康',source_type:'youtube'}
];
export function demoCanView(mode:AccessMode,user:DemoIdentity):boolean{
 return mode==='public'||(mode==='members'&&user!=='guest')||(mode==='rank'&&user==='verified');
}
export type DemoComment={id:string;video_id:string;author_sub?:string;is_mine?:boolean;parent_comment_id:string|null;body:string;created_at:string};
export const demoComments:DemoComment[]=[];
export function addDemoComment(video_id:string,author_sub:string,body:string,parent_comment_id:string|null):DemoComment{
 const comment={id:Math.random().toString(36).slice(2,10),video_id,author_sub,body,parent_comment_id,created_at:new Date().toISOString()};
 demoComments.push(comment);return comment;
}
