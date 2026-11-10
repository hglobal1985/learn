import {Pressable,Text,View} from 'react-native';
import {Page,H} from '../src/components/Ui';
import {C} from '../src/lib/theme';
import {DEMO_MODE,useSession} from '../src/lib/session';
import type {DemoIdentity} from '../src/lib/demo';
const modes:{key:DemoIdentity;label:string}[]=[
 {key:'guest',label:'訪客'},
 {key:'member',label:'登入會員（模擬）'},
 {key:'verified',label:'符合資格會員（模擬）'}
];
export default function Settings(){
 const {identity,setIdentity,demoOwner,setDemoOwner}=useSession();
 return <Page><H>我的學習</H>
 {DEMO_MODE?<View style={{gap:14,backgroundColor:'white',padding:18,borderRadius:12}}>
  {modes.map(m=><Pressable key={m.key} onPress={()=>setIdentity(m.key)} style={{padding:14,backgroundColor:identity===m.key?'#E6F1FF':'white',borderWidth:1,borderColor:identity===m.key?C.blue:C.border,borderRadius:9}}>
   <Text style={{fontWeight:'700',color:C.ink}}>{identity===m.key?'● ':'○ '}{m.label}</Text>
  </Pressable>)}
  <Pressable onPress={()=>setDemoOwner(!demoOwner)} style={{padding:14,backgroundColor:'#FAFAFA',borderRadius:8}}>
   <Text style={{color:C.ink,fontWeight:'600'}}>{demoOwner?'☑':'□'} 模擬管理員身份</Text>
  </Pressable>
 </View>:<View style={{padding:20,backgroundColor:'white',gap:10,borderRadius:12}}><H>登入尚未開放</H></View>}
 </Page>;
}
