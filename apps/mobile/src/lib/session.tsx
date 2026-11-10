import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {AppState,Platform} from 'react-native';
import type {DemoIdentity} from './demo';
import {authorized,clearLocal,config,currentMember,finishWebReturn,login as relayLogin,logout as relayLogout,outdated,refresh} from './central-auth';
import type {AppConfig,Profile} from '../../../../packages/shared/src/central-api.generated';
export const DEMO_MODE=process.env.EXPO_PUBLIC_DEMO_MODE==='true';
type Availability='active'|'paused'|'killed'|'upgrade'|'offline';
type Session={
 identity:DemoIdentity;setIdentity:(v:DemoIdentity)=>void;
 demoOwner:boolean;setDemoOwner:(v:boolean)=>void;
 loggedIn:boolean;isDemo:boolean;
 availability:Availability;loading:boolean;memberSub:string|null;
 login:()=>Promise<void>;logout:(all?:boolean)=>Promise<void>;checkConfig:()=>Promise<void>;
};
const SessionContext=createContext<Session|null>(null);
export function SessionProvider({children}:{children:React.ReactNode}){
 const [identity,setIdentity]=useState<DemoIdentity>('guest');
 const [demoOwner,setDemoOwner]=useState(false);
 const [memberSub,setMemberSub]=useState<string|null>(null);
 const [availability,setAvailability]=useState<Availability>('offline');
 const [loading,setLoading]=useState(true);
 async function checkConfig(){
  try{
   const app:AppConfig=await config();
   const version='0.1.0';
   setAvailability(outdated(version,app.min_version)?'upgrade':app.status);
  }catch{setAvailability('offline')}
 }
 async function restore(){
  if(!await refresh()){setMemberSub(null);return}
  try{
   const p=await authorized<Profile>('/v1/me/profile');
   setMemberSub(p.member_id||currentMember());
  }catch{await clearLocal();setMemberSub(null)}
 }
 useEffect(()=>{
  let alive=true;
  async function initialize(){
   await checkConfig();
   try{
    if(Platform.OS==='web'){
     const next=await finishWebReturn();
     if(next){window.location.replace(next);return}
    }
    await restore();
   }catch{await clearLocal();if(alive)setMemberSub(null)}
   if(alive)setLoading(false);
  }
  void initialize();
  const listener=AppState.addEventListener('change',state=>{if(state==='active')void checkConfig()});
  return()=>{alive=false;listener.remove()};
 },[]);
 async function login(){
  if(availability!=='active')throw Error('目前無法登入，請稍後再試');
  const done=await relayLogin();
  if(done==='ok'){
   const p=await authorized<Profile>('/v1/me/profile');
   setMemberSub(p.member_id);
  }
 }
 async function logout(all=false){try{await relayLogout(all)}finally{setMemberSub(null)}}
 const value=useMemo(()=>({
  identity,setIdentity,demoOwner,setDemoOwner,
  loggedIn:DEMO_MODE?identity!=='guest':!!memberSub,
  isDemo:DEMO_MODE,availability,loading,memberSub,login,logout,checkConfig
 }),[identity,demoOwner,availability,loading,memberSub]);
 return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession(){const v=useContext(SessionContext);if(!v)throw Error('missing SessionProvider');return v}
