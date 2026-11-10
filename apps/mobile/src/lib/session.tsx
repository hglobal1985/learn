import React,{createContext,useContext,useMemo,useState} from 'react';
import type {DemoIdentity} from './demo';
export const DEMO_MODE=process.env.EXPO_PUBLIC_DEMO_MODE==='true';
type Session={identity:DemoIdentity;setIdentity:(v:DemoIdentity)=>void;demoOwner:boolean;setDemoOwner:(v:boolean)=>void;loggedIn:boolean;isDemo:boolean};
const SessionContext=createContext<Session|null>(null);
export function SessionProvider({children}:{children:React.ReactNode}){
 const [identity,setIdentity]=useState<DemoIdentity>('guest');
 const [demoOwner,setDemoOwner]=useState(false);
 const value=useMemo(()=>({identity,setIdentity,demoOwner,setDemoOwner,loggedIn:identity!=='guest',isDemo:DEMO_MODE}),[identity,demoOwner]);
 return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession(){const v=useContext(SessionContext);if(!v)throw Error('missing SessionProvider');return v}
