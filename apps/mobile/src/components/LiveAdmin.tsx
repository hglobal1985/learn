import {useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Page,H,P,Button,Field} from './Ui';
import {C} from '../lib/theme';
import {request} from '../lib/api';
import {useSession} from '../lib/session';
type Source='mux'|'youtube';
type Mode='public'|'members'|'rank';
type Video={id:string;title:string;status:string;source_type:string;access_mode:string;category:string};
type MuxAsset={id:string;title:string;status:string;playback_policy:string};
type Rank={value:string;label:string};
function Selector<T extends string>({selected,items,onChange}:{selected:T;items:{value:T;label:string}[];onChange:(value:T)=>void}){
 return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{items.map(o=>
  <Pressable key={o.value} accessibilityRole="button" onPress={()=>onChange(o.value)}
   style={{borderColor:selected===o.value?C.blue:C.border,borderWidth:1,paddingVertical:12,paddingHorizontal:15,
    minHeight:44,borderRadius:9,backgroundColor:selected===o.value?'#E6F1FF':'white'}}>
   <Text style={{color:C.ink,fontWeight:selected===o.value?'700':'400'}}>{o.label}</Text>
  </Pressable>
 )}</View>;
}
export function LiveAdmin(){
 const {loggedIn}=useSession();
 const [allowed,setAllowed]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [videos,setVideos]=useState<Video[]>([]),[assets,setAssets]=useState<MuxAsset[]>([]),[ranks,setRanks]=useState<Rank[]>([]);
 const [muxConnected,setMuxConnected]=useState(false),[message,setMessage]=useState('');
 const [source,setSource]=useState<Source>('mux'),[mode,setMode]=useState<Mode>('rank');
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState('培訓');
 const [muxId,setMuxId]=useState(''),[youtubeUrl,setYoutubeUrl]=useState('');
 const [visibility,setVisibility]=useState<'public'|'unlisted'>('public'),[risk,setRisk]=useState(false),[minRank,setMinRank]=useState('');
 async function load(){
  const list=await request<{videos:Video[]}>('admin/videos');setVideos(list.videos||[]);
 }
 useEffect(()=>{
  let alive=true;
  (async()=>{
   if(!loggedIn){setAllowed(false);setLoading(false);return}
   try{
    const session=await request<{is_super_admin:boolean}>('admin/session');
    if(!session.is_super_admin)throw Error('not_admin');
    if(!alive)return;
    setAllowed(true);
    const [list,mux,rank]=await Promise.allSettled([
     request<{videos:Video[]}>('admin/videos'),
     request<{connected:boolean;assets:MuxAsset[]}>('admin/mux/assets'),
     request<{ranks:Rank[]}>('admin/ranks')
    ]);
    if(!alive)return;
    if(list.status==='fulfilled')setVideos(list.value.videos||[]);
    if(mux.status==='fulfilled'){setMuxConnected(mux.value.connected);setAssets(mux.value.assets||[])}
    if(rank.status==='fulfilled')setRanks(rank.value.ranks||[]);
   }catch{if(alive)setAllowed(false)}
   finally{if(alive)setLoading(false)}
  })();
  return()=>{alive=false};
 },[loggedIn]);
 async function save(){
  if(!allowed||busy||!title.trim())return;
  setBusy(true);setMessage('正在建立草稿…');
  try{
   const body={
    source_type:source,asset_id:source==='mux'?muxId.trim():undefined,
    youtube_url:source==='youtube'?youtubeUrl.trim():undefined,
    title:title.trim(),description:description.trim(),category:category.trim(),access_mode:mode,
    audience:'hglobal_verified',min_rank_code:mode==='rank'?minRank||null:null,
    youtube_visibility:visibility,accept_unlisted_risk:risk
   };
   const result=await request<{video_id:string;needs_mux_connection:boolean}>('admin/videos','POST',body);
   setMessage('草稿建立成功'+(result.needs_mux_connection?'；需完成 Mux API 設定後才能發布':''));
   setTitle('');setDescription('');setMuxId('');setYoutubeUrl('');
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:'儲存失敗')}
  finally{setBusy(false)}
 }
 async function changeStatus(video:Video){
  setBusy(true);setMessage('');
  try{
   const next=video.status==='published'?'unpublish':'publish';
   await request('admin/videos/'+encodeURIComponent(video.id)+'/'+next,'POST');
   setMessage(next==='publish'?'發布成功':'已下架');
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:'狀態更新失敗')}
  finally{setBusy(false)}
 }
 if(!loggedIn)return <Page><H>影片管理</H><P>請先到「我的學習與帳號設定」使用 H-Global1985 登入。</P></Page>;
 if(loading)return <Page><H>影片管理</H><P>正在確認超級管理員身分…</P></Page>;
 if(!allowed)return <Page><H>影片管理</H><P>只有經中央會員確認的超級管理員可以新增或發布影片。</P></Page>;
 return <Page>
  <H>影片管理</H><P>新增來源為 Mux 已上傳影片，或 YouTube 影片連結。新影片先儲存為草稿。</P>
  <View style={{backgroundColor:C.white,borderRadius:12,padding:16,gap:13}}>
   <Text style={{fontSize:19,color:C.ink,fontWeight:'700'}}>新增影片草稿</Text>
   <Text style={{color:C.ink,fontWeight:'700'}}>影片來源</Text>
   <Selector selected={source} items={[{value:'mux',label:'Mux 已上傳影片'},{value:'youtube',label:'YouTube 連結'}]}
    onChange={v=>{setSource(v);setMode(v==='youtube'?'public':'rank')}}/>
   {source==='mux'?<>
    <P>{muxConnected?'選擇 Mux 清單中的影片，或貼上 Asset ID：':'Mux API 尚未連線，請先貼入 Mux Asset ID 儲存草稿。'}</P>
    {assets.filter(x=>x.status==='ready').slice(0,20).map(item=>
     <Pressable key={item.id} onPress={()=>{setMuxId(item.id);if(!title)setTitle(item.title)}}
      style={{padding:12,borderRadius:10,borderWidth:1,borderColor:muxId===item.id?C.blue:C.border}}>
      <Text style={{color:C.ink}}>{item.title}（{item.playback_policy}）</Text>
     </Pressable>
    )}
    <Field value={muxId} onChangeText={setMuxId} placeholder="Mux Asset ID"/>
   </>:<>
    <Field value={youtubeUrl} onChangeText={setYoutubeUrl} placeholder="https://youtu.be/影片代碼"/>
    <Text style={{color:C.ink,fontWeight:'700'}}>YouTube 可見度</Text>
    <Selector selected={visibility} onChange={setVisibility} items={[{value:'public',label:'公開'},{value:'unlisted',label:'不公開'}]}/>
   </>}
   <Field value={title} onChangeText={setTitle} placeholder="影片標題"/>
   <Field value={description} onChangeText={setDescription} placeholder="影片介紹" multiline/>
   <Field value={category} onChangeText={setCategory} placeholder="分類"/>
   <Text style={{color:C.ink,fontWeight:'700'}}>觀看權限</Text>
   <Selector selected={mode} onChange={v=>{setMode(v);if(v!=='public'&&source==='youtube')setVisibility('unlisted')}}
    items={[{value:'public',label:'公開'},{value:'members',label:'登入會員'},{value:'rank',label:'獎銜限定'}]}/>
   {mode==='rank'&&<><P>最低獎銜（來自中央會員）</P>
    <Selector selected={minRank} onChange={setMinRank}
     items={[{value:'',label:'無最低要求'},...ranks.map(x=>({value:x.value,label:x.label}))]}/></>}
   {source==='youtube'&&mode!=='public'&&
    <Pressable onPress={()=>setRisk(!risk)} style={{minHeight:48,justifyContent:'center'}}>
     <Text style={{color:C.ink}}>{risk?'☑':'□'} 我知道 YouTube 不公開連結仍能被轉傳</Text>
    </Pressable>}
   <Button title={busy?'儲存中…':'儲存影片草稿'} onPress={()=>void save()} disabled={busy||!title.trim()}/>
  </View>
  {!!message&&<P>{message}</P>}
  <View style={{backgroundColor:C.white,borderRadius:12,padding:16,gap:12}}>
   <Text style={{fontSize:19,fontWeight:'700',color:C.ink}}>影片清單（{videos.length}）</Text>
   <Button title="重新整理" onPress={()=>void load()} outline/>
   {videos.map(v=><View key={v.id} style={{gap:7,borderWidth:1,borderColor:C.border,borderRadius:10,padding:12}}>
    <Text style={{color:C.ink,fontWeight:'700'}}>{v.title}</Text>
    <P>{v.source_type==='mux'?'Mux':'YouTube'} · {v.status==='published'?'已發布':'草稿'} · {v.category}</P>
    <Button title={v.status==='published'?'下架':'發布'} onPress={()=>void changeStatus(v)} disabled={busy} outline/>
   </View>)}
  </View>
 </Page>;
}
