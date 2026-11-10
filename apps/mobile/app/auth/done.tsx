import {useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import {Page,H} from '../../src/components/Ui';
import {finishWebReturn} from '../../src/lib/central-auth';
export default function AuthDone(){
 const [message,setMessage]=useState('正在驗證登入…');
 useEffect(()=>{let active=true;finishWebReturn().then(path=>{
  if(path&&active)window.location.replace(path);
 }).catch(()=>{if(active)setMessage('登入未完成，請返回重新登入')});return()=>{active=false}},[]);
 return <Page><View style={{padding:24,gap:14}}><H>{message}</H><Text>請勿分享登入驗證網址。</Text></View></Page>;
}
