import React from 'react';
import {Link} from 'expo-router';
import {Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {C} from '../lib/theme';
export function Page({children}:{children:React.ReactNode}){
 return <ScrollView style={{backgroundColor:C.paper,flex:1}} contentContainerStyle={styles.outer}><View style={styles.max}>{children}</View></ScrollView>;
}
export function H({children}:{children:React.ReactNode}){return <Text style={styles.h}>{children}</Text>}
export function P({children}:{children:React.ReactNode}){return <Text style={styles.p}>{children}</Text>}
export function Button({title,onPress,outline=false,disabled=false}:{title:string;onPress:()=>void;outline?:boolean;disabled?:boolean}){
 return <Pressable onPress={onPress} disabled={disabled} style={[styles.button,outline&&styles.outline,disabled&&{opacity:.45}]}><Text style={[styles.buttonLabel,outline&&{color:C.blue}]}>{title}</Text></Pressable>
}
export function Field({value,onChangeText,placeholder,multiline=false}:{value:string;onChangeText:(s:string)=>void;placeholder:string;multiline?:boolean}){
 return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#5d6b62" multiline={multiline} style={[styles.field,multiline&&{minHeight:90,textAlignVertical:'top'}]}/>;
}
export function Tag({text}:{text:string}){return <View style={styles.tag}><Text style={styles.tagText}>{text}</Text></View>}
export function VideoTile({id,title,description,category,access_mode,source_type}:{id:string;title:string;description:string;category:string;access_mode:string;source_type:string}){
 return <Link href={{pathname:'/[videoId]',params:{videoId:id}}} asChild><Pressable style={styles.tile}>
  <View style={styles.poster}><Text style={styles.posterIcon}>▶</Text></View>
  <View style={{flex:1,gap:6}}><Text style={styles.tileTitle}>{title}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}><Tag text={access_mode==='public'?'公開':access_mode==='members'?'登入會員':'獎銜限定'}/></View></View>
 </Pressable></Link>;
}
const styles=StyleSheet.create({
 outer:{paddingHorizontal:18,paddingVertical:26},max:{width:'100%',maxWidth:960,alignSelf:'center',gap:18},
 h:{fontSize:26,fontWeight:'800',color:C.ink},p:{fontSize:14,color:C.muted,lineHeight:22},
 button:{backgroundColor:C.blue,alignSelf:'flex-start',paddingHorizontal:18,paddingVertical:12,borderRadius:10},
 outline:{backgroundColor:C.white,borderWidth:1,borderColor:C.blue},buttonLabel:{fontWeight:'700',color:'white',fontSize:14},
 field:{backgroundColor:'white',borderWidth:1,borderColor:C.border,borderRadius:10,fontSize:15,padding:12,color:C.ink},
 tag:{backgroundColor:'#e7f1ea',paddingHorizontal:8,paddingVertical:4,borderRadius:5},tagText:{fontSize:13,color:'#094a2e',fontWeight:'600'},
 tile:{backgroundColor:'white',borderWidth:1,borderColor:C.border,borderRadius:14,padding:12,gap:14,flexDirection:'row',alignItems:'center'},
 poster:{width:134,height:88,borderRadius:9,backgroundColor:C.navy,alignItems:'center',justifyContent:'center',gap:8},
 posterIcon:{color:C.white,fontSize:26},posterSmall:{fontSize:13,color:'#dbf6e7'},tileTitle:{fontSize:17,fontWeight:'700',color:C.ink},tileDesc:{fontSize:14,color:C.muted,lineHeight:20}
});
