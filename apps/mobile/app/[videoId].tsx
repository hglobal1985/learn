import {useEffect,useState} from 'react';
import {useLocalSearchParams} from 'expo-router';
import {Alert,Platform,Share,Text,View} from 'react-native';
import {Page,H,P,Button,Tag} from '../src/components/Ui';
import {Comments} from '../src/components/Comments';
import {MuxPlayer,YouTubePlayer} from '../src/components/Player';
import {getCatalogVideo,getPlayback} from '../src/lib/api';
import type {CatalogItem} from '../src/lib/demo';
import {DEMO_MODE,useSession} from '../src/lib/session';
import {C} from '../src/lib/theme';
export default function VideoDetail(){
 const {videoId}=useLocalSearchParams<{videoId:string}>();const {identity}=useSession();
 const [video,setVideo]=useState<CatalogItem|null>(null),[playback,setPlayback]=useState<{type:'mux'|'youtube';url?:string;video_id?:string}|null>(null),[error,setError]=useState('');
 useEffect(()=>{setVideo(null);setPlayback(null);setError('');
  if(!videoId)return;
  getCatalogVideo(videoId,identity).then(v=>{setVideo(v);if(!DEMO_MODE)return getPlayback(videoId).then(setPlayback)}).catch(e=>setError(e.message))
 },[videoId,identity]);
 async function share(){const url='https://learn.hglobal1985.com/'+videoId;
  try{if(Platform.OS==='web'){
   const nav=navigator as Navigator&{share?:(data:{title?:string;url:string})=>Promise<void>};
   if(nav.share)await nav.share({title:video?.title,url});else if(nav.clipboard)await nav.clipboard.writeText(url);else Alert.alert('分享網址',url);
  }else await Share.share({message:url,url,title:video?.title});
  }catch{/* user canceled */}
 }
 return <Page>
  {!video?<View style={{padding:28,backgroundColor:C.white,borderRadius:12,gap:8}}><H>{error?'無法瀏覽此影片':'載入中…'}</H>{!!error&&<P>{error}</P>}</View>:
   <>
    <View style={{borderRadius:14,overflow:'hidden',backgroundColor:C.navy,minHeight:220,justifyContent:'center',alignItems:'center'}}>
     {playback?.type==='mux'&&playback.url?<MuxPlayer url={playback.url}/>:playback?.type==='youtube'&&playback.video_id?<YouTubePlayer videoId={playback.video_id}/>:
      <View style={{alignItems:'center',gap:12,padding:18}}><Text style={{fontSize:42,color:C.white}}>▶</Text><Text style={{color:C.white}}>影片播放區</Text></View>}
    </View>
    <H>{video.title}</H>
    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}><Tag text={video.category}/><Tag text={video.access_mode==='public'?'公開影片':video.access_mode==='members'?'登入會員':'獎銜限定'}/></View>
    <P>{video.description}</P>
    <Button title="分享這部影片" onPress={()=>void share()}/>
    <Comments videoId={videoId||''}/>
   </>}
 </Page>;
}
