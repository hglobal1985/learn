import {View} from 'react-native';
import {VideoView,useVideoPlayer} from 'expo-video';
import WebView from 'react-native-webview';
export function MuxPlayer({url}:{url:string}){
 const player=useVideoPlayer(url,(v)=>{v.play()});
 return <VideoView player={player} nativeControls contentFit="contain" style={{width:'100%',height:220,backgroundColor:'black'}}/>;
}
export function YouTubePlayer({videoId}:{videoId:string}){
 return <View style={{height:220,backgroundColor:'black'}}><WebView source={{uri:'https://www.youtube-nocookie.com/embed/'+encodeURIComponent(videoId)}} allowsFullscreenVideo javaScriptEnabled/></View>;
}
