import {useEffect,useState} from 'react';
import {Alert,Pressable,Text,View} from 'react-native';
import {C} from '../lib/theme';
import {Field,Button,P} from './Ui';
import {listComments,postComment,request} from '../lib/api';
import {DEMO_MODE,useSession} from '../lib/session';
import {demoComments,type DemoComment} from '../lib/demo';

export function Comments({videoId}:{videoId:string}){
 const {loggedIn,identity}=useSession();
 const [comments,setComments]=useState<DemoComment[]>([]),[text,setText]=useState(''),[reply,setReply]=useState<string|null>(null),
 [editing,setEditing]=useState<string|null>(null),[editBody,setEditBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function refresh(){try{setComments(await listComments(videoId));setError('')}catch(e){setError(e instanceof Error?e.message:'無法載入留言')}}
 useEffect(()=>{void refresh()},[videoId,identity]);
 async function submit(){if(!loggedIn||!text.trim()||busy)return;setBusy(true);try{
  await postComment(videoId,DEMO_MODE?'dev:'+identity:'',text.trim(),reply);
  setText('');setReply(null);await refresh();
 }catch(e){setError(e instanceof Error?e.message:'留言失敗')}finally{setBusy(false)}}
 async function saveEdit(){if(!editing||!editBody.trim()||busy)return;setBusy(true);try{
  if(DEMO_MODE){const c=demoComments.find(x=>x.id===editing);if(c)c.body=editBody.trim()}
  else await request('comments/'+editing,'PATCH',{body:editBody.trim()});
  setEditing(null);setEditBody('');await refresh();
 }catch(e){setError(e instanceof Error?e.message:'修改失敗')}finally{setBusy(false)}}
 async function remove(id:string){
  try{if(DEMO_MODE){const i=demoComments.findIndex(x=>x.id===id);if(i>=0)demoComments.splice(i,1)}
   else await request('comments/'+id,'DELETE');await refresh()}
  catch(e){setError(e instanceof Error?e.message:'刪除失敗')}
 }
 async function report(id:string){
  try{if(DEMO_MODE){Alert.alert('已檢舉（模擬）')}else {await request('comments/'+id+'/report','POST',{reason_code:'other'});Alert.alert('已檢舉')}}
  catch(e){setError(e instanceof Error?e.message:'檢舉失敗')}
 }
 return <View style={{gap:14,backgroundColor:C.white,borderRadius:12,padding:18}}>
  <Text style={{color:C.ink,fontWeight:'800',fontSize:20}}>學習心得與討論</Text>
  {comments.map(c=>{
   const mine=loggedIn&&(DEMO_MODE?c.author_sub==='dev:'+identity:c.is_mine===true);
   return <View key={c.id} style={{marginLeft:c.parent_comment_id?20:0,paddingVertical:12,borderBottomWidth:1,borderColor:C.border,gap:7}}>
    <Text style={{fontSize:14,fontWeight:'600',color:C.ink}}>{mine?'我的留言':'會員'}</Text>
    {editing===c.id?<View style={{gap:10}}><Field value={editBody} onChangeText={setEditBody} placeholder="修改留言" multiline/>
     <View style={{flexDirection:'row',alignItems:'center',gap:16}}><Button title="儲存" disabled={busy||!editBody.trim()} onPress={()=>void saveEdit()}/>
      <Pressable onPress={()=>setEditing(null)}><Text style={{color:C.blue}}>取消</Text></Pressable></View></View>:
     <Text style={{fontSize:14,color:C.ink,lineHeight:23}}>{c.body}</Text>}
    <View style={{flexDirection:'row',gap:18,flexWrap:'wrap'}}>
     {loggedIn&&!c.parent_comment_id&&<Pressable onPress={()=>setReply(c.id)}><Text style={{color:C.blue}}>回覆</Text></Pressable>}
     {loggedIn&&!mine&&<Pressable onPress={()=>void report(c.id)}><Text style={{color:C.muted}}>檢舉</Text></Pressable>}
     {mine&&editing!==c.id&&<Pressable onPress={()=>{setEditing(c.id);setEditBody(c.body)}}><Text style={{color:C.blue}}>編輯</Text></Pressable>}
     {mine&&<Pressable onPress={()=>void remove(c.id)}><Text style={{color:C.muted}}>刪除</Text></Pressable>}
    </View>
   </View>
  })}
  {loggedIn?<View style={{gap:10}}>
   {reply&&<View style={{flexDirection:'row',gap:15}}><Text style={{color:C.ink,fontWeight:'600'}}>回覆留言</Text><Pressable onPress={()=>setReply(null)}><Text style={{color:C.blue}}>取消</Text></Pressable></View>}
   <Field value={text} onChangeText={setText} placeholder="寫下學習心得……" multiline/>
   <Button title={busy?'送出中':'發表留言'} disabled={!text.trim()||busy} onPress={()=>void submit()}/>
  </View>:<Button title="登入後留言" outline onPress={()=>Alert.alert('登入尚未開放')}/>}
  {error&&<P>{error}</P>}
 </View>;
}
