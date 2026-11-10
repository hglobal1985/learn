import {useState} from 'react';
import {Platform,Pressable,Text,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {Page,H,P,Button,Field} from '../src/components/Ui';
import {C} from '../src/lib/theme';
import {DEMO_MODE,useSession} from '../src/lib/session';
import {demoDrafts,demoPublished} from '../src/lib/demo';
import {youtubeId} from '../../../packages/shared/src/index';
import {request} from '../src/lib/api';
import {LiveAdmin} from '../src/components/LiveAdmin';
type Mode='public'|'members'|'rank';type Source='youtube'|'mux';
const MODES:{value:Mode;label:string}[]=[{value:'public',label:'公開'},{value:'members',label:'登入會員'},{value:'rank',label:'獎銜限定'}];
function Choice<T extends string>({value,options,onSelect}:{value:T;options:{value:T;label:string}[];onSelect:(v:T)=>void}){
 return <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{options.map(o=><Pressable key={o.value} onPress={()=>onSelect(o.value)} style={{padding:11,borderWidth:1,borderColor:value===o.value?C.blue:C.border,backgroundColor:value===o.value?'#E8F2FE':'white',borderRadius:9}}><Text style={{color:C.ink}}>{o.label}</Text></Pressable>)}</View>
}
export default function Admin(){
 const {demoOwner}=useSession();const [,setRevision]=useState(0);
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState('一般');
 const [source,setSource]=useState<Source>('youtube'),[url,setUrl]=useState(''),[mode,setMode]=useState<Mode>('rank'),[audience,setAudience]=useState<'everyone'|'hglobal_verified'>('hglobal_verified'),[minRank,setMinRank]=useState('');
 const [visibility,setVisibility]=useState<'public'|'unlisted'>('public'),[risk,setRisk]=useState(false);
 const [muxAssetId,setMuxAssetId]=useState('');
 const [selected,setSelected]=useState<DocumentPicker.DocumentPickerAsset|null>(null),[progress,setProgress]=useState<number|null>(null),[info,setInfo]=useState(''),[busy,setBusy]=useState(false);
 async function chooseFile(){const result=await DocumentPicker.getDocumentAsync({type:'video/*',copyToCacheDirectory:true});if(!result.canceled)setSelected(result.assets[0]||null)}
 async function uploadMux(uploadUrl:string,asset:DocumentPicker.DocumentPickerAsset){
  if(Platform.OS==='web'){
   const file=asset.file;if(!file)throw Error('瀏覽器沒有取得影片檔案');
   await new Promise<void>((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('PUT',uploadUrl);xhr.setRequestHeader('Content-Type',file.type||'application/octet-stream');
    xhr.upload.onprogress=e=>{if(e.lengthComputable)setProgress(Math.round(e.loaded/e.total*100))};
    xhr.onerror=()=>reject(Error('影片上傳失敗'));
    xhr.onload=()=>xhr.status>=200&&xhr.status<300?resolve():reject(Error('影片上傳失敗 '+xhr.status));
    xhr.send(file);
   });
  }else{
   const task=FileSystem.createUploadTask(uploadUrl,asset.uri,{
    httpMethod:'PUT',uploadType:FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers:{'Content-Type':asset.mimeType||'application/octet-stream'}
   },event=>{if(event.totalBytesExpectedToSend>0)setProgress(Math.round(event.totalBytesSent/event.totalBytesExpectedToSend*100))});
   const result=await task.uploadAsync();if(!result||result.status<200||result.status>=300)throw Error('影片上傳失敗');
  }
 }
 function publish(id:string){
  const index=demoDrafts.findIndex(v=>v.id===id);if(index<0)return;
  const v=demoDrafts[index]!;
  if(v.source_type==='mux'){setInfo('Mux 影片尚未安全上傳，不能發布');return}
  if(!youtubeId(v.youtube_url||'')){setInfo('YouTube 影片網址無效');return}
  if(v.youtube_visibility==='unlisted'&&v.access_mode!=='public'&&!v.accept_unlisted_risk){setInfo('請確認不公開影片連結可以被轉傳');return}
  demoDrafts.splice(index,1);demoPublished.unshift(v);setInfo('已發布');setRevision(x=>x+1);
 }
 function unpublish(id:string){const index=demoPublished.findIndex(v=>v.id===id);if(index<0)return;
  demoDrafts.unshift(demoPublished.splice(index,1)[0]!);setInfo('已下架');setRevision(x=>x+1);
 }
 async function importMux(){
  if(!muxAssetId.trim()||!title.trim()||busy)return;
  if(DEMO_MODE){setInfo('Mux 匯入需連接正式服務，模擬模式不會匯入');return;}
  setBusy(true);setInfo('');
  try{
   const imported=await request<{video_id:string}>('videos/mux/import','POST',{
    asset_id:muxAssetId.trim(),title,description,category,access_mode:mode,
    audience:mode==='rank'?audience:'everyone',min_rank_code:mode==='rank'&&audience==='hglobal_verified'?(minRank||null):null
   });
   setInfo('已匯入為草稿：'+imported.video_id);
   setMuxAssetId('');
  }catch(e){setInfo(e instanceof Error?e.message:'匯入失敗')}
  finally{setBusy(false)}
 }
 async function save(){if(!title.trim()||busy)return;setBusy(true);setInfo('');try{
  if(DEMO_MODE){
   const id='demo'+Math.random().toString(36).slice(2,9);
   demoDrafts.unshift({id,title,description,category,source_type:source,access_mode:mode,youtube_url:source==='youtube'?url:undefined,youtube_visibility:visibility,accept_unlisted_risk:risk});
   setRevision(x=>x+1);setInfo('草稿已建立');
  }else{
   const body={title,description,category,source_type:source,access_mode:mode,audience:mode==='rank'?audience:'everyone',min_rank_code:mode==='rank'&&audience==='hglobal_verified'?(minRank||null):null,
    youtube_url:source==='youtube'?url:undefined,youtube_visibility:visibility,accept_unlisted_risk:risk};
   const draft=await request<{video_id:string}>('videos','POST',body);
   if(source==='mux'){
    if(!selected)throw Error('請先選取影片檔案，草稿編號：'+draft.video_id);
    const signed=await request<{upload_url:string}>('uploads/mux','POST',{video_id:draft.video_id});
    await uploadMux(signed.upload_url,selected);
    setInfo('影片已上傳，正在轉檔；完成安全檢查後可以發布。');
   }else setInfo('YouTube 草稿已建立');
  }
 }catch(e){setInfo(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 if(!DEMO_MODE)return <LiveAdmin/>;
 if(!demoOwner)return <Page><H>管理後台</H><P>沒有管理權限</P></Page>;
 return <Page><H>影片管理</H>
 <View style={{padding:18,gap:16,backgroundColor:C.white,borderRadius:12}}>
  <Text style={{fontSize:18,fontWeight:'700',color:C.ink}}>新增影片草稿</Text>
  <Field value={title} onChangeText={setTitle} placeholder="影片標題"/>
  <Field value={description} onChangeText={setDescription} placeholder="影片介紹" multiline/>
  <Field value={category} onChangeText={setCategory} placeholder="分類"/>
  <Text style={{fontWeight:'600',color:C.ink}}>影片來源</Text>
  <Choice value={source} options={[{value:'youtube',label:'YouTube'},{value:'mux',label:'Mux'}]} onSelect={setSource}/>
  {source==='youtube'?<><Field value={url} onChangeText={setUrl} placeholder="貼上 YouTube 網址"/>
   <Text style={{color:C.ink}}>來源可見度</Text><Choice value={visibility} options={[{value:'public',label:'公開'},{value:'unlisted',label:'不公開'}]} onSelect={setVisibility}/>
   {visibility==='unlisted'&&mode!=='public'&&<Pressable onPress={()=>setRisk(!risk)}><Text style={{color:'#925829'}}>{risk?'☑':'□'} 我知道 YouTube 不公開影片的來源網址仍可被轉傳</Text></Pressable>}
  </>:<><Button title={selected?'重新選取影片':'選擇影片檔案'} onPress={()=>void chooseFile()} outline/>{selected&&<P>{selected.name}</P>}
  {progress!==null&&<P>上傳進度：{progress}%</P>}
  <Field value={muxAssetId} onChangeText={setMuxAssetId} placeholder="既有 Mux Asset ID"/>
  <Button title="匯入既有 Mux 影片" outline disabled={busy||!muxAssetId.trim()||!title.trim()} onPress={()=>void importMux()}/>
  </>}
  <Text style={{fontWeight:'600',color:C.ink}}>觀看權限</Text><Choice value={mode} options={MODES} onSelect={setMode}/>
  {mode==='rank'&&<><Text style={{color:C.ink}}>限定對象</Text><Choice value={audience} options={[{value:'hglobal_verified',label:'已審核會員'},{value:'everyone',label:'所有登入會員'}]} onSelect={setAudience}/>{audience==='hglobal_verified'&&<Field value={minRank} onChangeText={setMinRank} placeholder="最低獎銜代碼（模擬）"/>}</>}
  <Button title={busy?'處理中…':'儲存草稿'} disabled={busy||!title.trim()||(visibility==='unlisted'&&mode!=='public'&&!risk&&source==='youtube')} onPress={()=>void save()}/>
  {!!info&&<P>{info}</P>}
 </View>
 <View style={{backgroundColor:C.white,padding:18,borderRadius:12,gap:12}}><Text style={{fontSize:18,color:C.ink,fontWeight:'700'}}>草稿（{demoDrafts.length}）</Text>
  {demoDrafts.map(v=><View key={v.id} style={{paddingVertical:10,borderBottomWidth:1,borderColor:C.border,gap:8}}><Text style={{color:C.ink,fontWeight:'600'}}>{v.title}</Text>
   <View style={{flexDirection:'row',gap:10}}><Button title="發布" onPress={()=>publish(v.id)}/><Button title="刪除" outline onPress={()=>{demoDrafts.splice(demoDrafts.findIndex(d=>d.id===v.id),1);setRevision(x=>x+1)}}/></View></View>)}
 </View>
 <View style={{backgroundColor:C.white,padding:18,borderRadius:12,gap:12}}><Text style={{fontSize:18,color:C.ink,fontWeight:'700'}}>已發布（{demoPublished.length}）</Text>
  {demoPublished.map(v=><View key={v.id} style={{paddingVertical:10,borderBottomWidth:1,borderColor:C.border,gap:8}}><Text style={{color:C.ink,fontWeight:'600'}}>{v.title}</Text><Button title="下架" outline onPress={()=>unpublish(v.id)}/></View>)}
 </View>
 </Page>;
}
