import {useState} from 'react';
import {Linking,Pressable,Text,View} from 'react-native';
import {Page,H,Button,P} from '../src/components/Ui';
import {C} from '../src/lib/theme';
import {DEMO_MODE,useSession} from '../src/lib/session';
import type {DemoIdentity} from '../src/lib/demo';
const modes:{key:DemoIdentity;label:string}[]=[
 {key:'guest',label:'訪客'},
 {key:'member',label:'登入會員（模擬）'},
 {key:'verified',label:'符合資格會員（模擬）'}
];
const links=[
 ['編輯會員基本資料','https://id.hglobal1985.com/me'],
 ['隱私權政策','https://id.hglobal1985.com/privacy'],
 ['完整隱私說明','https://id.hglobal1985.com/privacy/amway'],
 ['申請刪除帳號','https://id.hglobal1985.com/me']
] as const;
export default function Settings(){
 const {identity,setIdentity,demoOwner,setDemoOwner,loggedIn,availability,loading,memberSub,login,logout}=useSession();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function act(action:()=>Promise<void>){
  setBusy(true);setMessage('');
  try{await action()}catch(e){setMessage(e instanceof Error?e.message:'操作未完成')}
  finally{setBusy(false)}
 }
 return <Page><H>我的學習</H>
 {DEMO_MODE?<View style={{gap:14,backgroundColor:'white',padding:18,borderRadius:12}}>
  {modes.map(m=><Pressable key={m.key} onPress={()=>setIdentity(m.key)} style={{padding:14,backgroundColor:identity===m.key?'#E6F1FF':'white',borderWidth:1,borderColor:identity===m.key?C.blue:C.border,borderRadius:9}}>
   <Text style={{fontWeight:'700',color:C.ink}}>{identity===m.key?'● ':'○ '}{m.label}</Text>
  </Pressable>)}
  <Pressable onPress={()=>setDemoOwner(!demoOwner)} style={{padding:14,backgroundColor:'#FAFAFA',borderRadius:8}}>
   <Text style={{color:C.ink,fontWeight:'600'}}>{demoOwner?'☑':'□'} 模擬管理員身份</Text>
  </Pressable>
 </View>:<View style={{padding:20,backgroundColor:'white',gap:12,borderRadius:12}}>
  {loading?<P>檢查登入狀態…</P>:availability==='paused'?<H>維護中</H>:availability==='killed'?<H>這款 App 目前已停止服務</H>:availability==='upgrade'?<H>請更新 App 才能繼續使用</H>:availability==='offline'?<P>會員服務暫時無法連線，公開課程仍可瀏覽</P>:null}
  {loggedIn?<><P>已使用 H-Global1985 帳號登入</P><P>會員識別碼：{memberSub}</P>
   <Button title="登出此裝置" onPress={()=>void act(()=>logout(false))} disabled={busy}/>
   <Button title="登出所有 H-Global1985 App" onPress={()=>void act(()=>logout(true))} disabled={busy} outline/>
  </>:<Button title="使用 H-Global1985 登入" disabled={busy||loading||availability!=='active'} onPress={()=>void act(login)}/>}
  {!!message&&<P>{message}</P>}
 </View>}
 <View style={{gap:12,padding:18,backgroundColor:'white',borderRadius:12}}>
  {links.map(([title,url])=><Pressable key={title} accessibilityRole="link" onPress={()=>void Linking.openURL(url)}>
   <Text style={{color:C.blue,fontWeight:'600'}}>{title}</Text>
  </Pressable>)}
 </View>
 </Page>;
}
