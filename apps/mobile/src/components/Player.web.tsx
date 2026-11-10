import React from 'react';
import {View} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
function HlsPlayer({url}:{url:string}){
 const player=useVideoPlayer(url,(v)=>{v.play()});
 return <VideoView player={player} nativeControls contentFit="contain" style={{width:'100%',height:320,backgroundColor:'black'}}/>;
}
export function MuxPlayer({url}:{url:string}){
 if(url.startsWith('https://player.mux.com/')){
  return <View style={{height:320,backgroundColor:'black'}}>
   {React.createElement('iframe',{src:url,title:'Mux Player',allow:'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture',allowFullScreen:true,style:{width:'100%',height:'100%',border:0},referrerPolicy:'no-referrer'})}
  </View>;
 }
 return <HlsPlayer url={url}/>;
}
export function YouTubePlayer({videoId}:{videoId:string}){
 return <View style={{height:320,overflow:'hidden',borderRadius:12,backgroundColor:'#111'}}>
  {React.createElement('iframe',{src:'https://www.youtube-nocookie.com/embed/'+encodeURIComponent(videoId),title:'YouTube Player',allow:'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture',allowFullScreen:true,style:{width:'100%',height:'100%',border:0}})}
 </View>;
}
