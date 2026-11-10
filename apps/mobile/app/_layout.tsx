import {Stack} from 'expo-router';
import {SessionProvider} from '../src/lib/session';
import {C} from '../src/lib/theme';
export default function RootLayout(){
 return <SessionProvider><Stack screenOptions={{headerStyle:{backgroundColor:C.white},headerTintColor:C.ink,headerTitleStyle:{fontWeight:'700'}}}>
  <Stack.Screen name="index" options={{title:'寰宇行動大學'}}/>
  <Stack.Screen name="[videoId]" options={{title:'課程內容'}}/>
  <Stack.Screen name="admin" options={{title:'影片管理'}}/>
  <Stack.Screen name="settings" options={{title:'我的學習'}}/>
 </Stack></SessionProvider>;
}
