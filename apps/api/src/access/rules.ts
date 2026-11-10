import {assert,cleanText} from '../http.js';
import type {AccessMode} from '../../../../packages/shared/src/index.js';
export type Audience='everyone'|'hglobal_verified';
/** Validate the content rule before storing it. Never trust client-side UI constraints. */
export function accessFields(mode:AccessMode,audience:unknown,minRank:unknown):{audience:Audience;minRank:string|null}{
 if(mode!=='rank')return {audience:'everyone',minRank:null};
 const a=audience===undefined?'hglobal_verified':audience;
 assert(a==='everyone'||a==='hglobal_verified',422,'invalid_audience','觀看對象無效');
 if(a==='everyone'){
  assert(minRank===null||minRank===undefined||minRank==='',422,'invalid_rank','所有會員不可設定最低獎銜');
  return {audience:'everyone',minRank:null};
 }
 return {audience:'hglobal_verified',minRank:minRank===null||minRank===undefined||minRank===''?null:cleanText(minRank,32)};
}
