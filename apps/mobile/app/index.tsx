import {useEffect,useState} from 'react';
import {Link} from 'expo-router';
import {Pressable,Text,View} from 'react-native';
import {Page,H,P,Field,VideoTile} from '../src/components/Ui';
import {useSession} from '../src/lib/session';
import {listCatalog,request} from '../src/lib/api';
import type {CatalogItem} from '../src/lib/demo';
import {C} from '../src/lib/theme';
const categories=['全部','營養健康','個人成長','事業培訓'];
export default function Home(){
 const {identity,loggedIn}=useSession();
 const [canManage,setCanManage]=useState(false);const [items,setItems]=useState<CatalogItem[]>([]),[q,setQ]=useState(''),[category,setCategory]=useState('全部'),[error,setError]=useState('');
 useEffect(()=>{listCatalog(identity,q,category==='全部'?'':category).then(x=>{setItems(x);setError('')}).catch(e=>setError(String(e.message)))},[identity,q,category]);
 useEffect(()=>{let active=true;if(!loggedIn){setCanManage(false);return}
  request<{is_super_admin:boolean}>('admin/session').then(x=>{if(active)setCanManage(x.is_super_admin===true)}).catch(()=>{if(active)setCanManage(false)});
  return()=>{active=false};
 },[loggedIn]);
 return <Page>
  <View style={{paddingVertical:20,gap:9}}><H>寰宇行動大學</H></View>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}><Text style={{fontSize:20,color:C.ink,fontWeight:'700'}}>探索課程</Text><View style={{flexDirection:'row',gap:14}}><Link href="/settings" style={{color:C.blue,fontWeight:'600'}}>我的學習／帳號設定</Link>{canManage&&<Link href="/admin" style={{color:C.blue,fontWeight:'600'}}>影片管理</Link>}</View></View>
  <Field value={q} onChangeText={setQ} placeholder="搜尋課程名稱或介紹"/>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{categories.map(c=><Pressable key={c} onPress={()=>setCategory(c)} style={{padding:10,borderRadius:8,backgroundColor:category===c?C.navy:C.white,borderWidth:1,borderColor:C.border}}><Text style={{color:category===c?C.white:C.ink,fontSize:14}}>{c}</Text></Pressable>)}</View>
  {error&&<P>{error}</P>}
  {items.map(v=><VideoTile key={v.id} {...v}/>)}
  {!items.length&&<View style={{backgroundColor:C.white,padding:24,borderRadius:12}}><Text style={{fontWeight:'700',color:C.ink}}>目前沒有符合條件的課程</Text></View>}
 </Page>
}
