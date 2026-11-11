import {createContext,useContext,useState,type ReactNode} from 'react';
import {initialState,storageKey,type State} from './domain';
const Context=createContext<{state:State;update:(f:(s:State)=>State)=>void}>({state:initialState(),update:()=>{}});
export function Store({children}:{children:ReactNode}){const [state,setState]=useState<State>(()=>{try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');return saved?.version===1&&Array.isArray(saved.courses)&&Array.isArray(saved.orders)&&Array.isArray(saved.notices)?saved:initialState()}catch{return initialState()}});function update(f:(s:State)=>State){setState(s=>{const next=f(s);try{localStorage.setItem(storageKey,JSON.stringify(next))}catch{/* Keep this tab usable if storage is unavailable. */}return next})}return <Context.Provider value={{state,update}}>{children}</Context.Provider>}
export const useStore=()=>useContext(Context);
