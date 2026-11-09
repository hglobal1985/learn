export interface QueryResult<T>{results:T[];success:boolean}
export interface PreparedStatement {
 bind(...values:unknown[]):PreparedStatement;
 first<T=Record<string,unknown>>(column?:string):Promise<T|null>;
 all<T=Record<string,unknown>>():Promise<QueryResult<T>>;
 run():Promise<unknown>;
}
export interface Db{prepare(sql:string):PreparedStatement;}
export interface Env{
 DB:Db;
 OWNER_SUB?:string;
 CENTRAL_API_BASE?:string;
 MUX_TOKEN_ID?:string;
 MUX_TOKEN_SECRET?:string;
 MUX_SIGNING_KEY_ID?:string;
 MUX_SIGNING_PRIVATE_KEY?:string;
 MUX_WEBHOOK_SECRET?:string;
 MOCK_AUTH?:string;
 WEB_ORIGIN?:string;
}
export const SECURITY_HEADERS={
 'X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer',
 'Cross-Origin-Resource-Policy':'same-origin',
 'Cache-Control':'private, no-store',
 'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
};
export function json(data:unknown,status=200,headers:Record<string,string>={}):Response{
 return new Response(JSON.stringify(data),{status,headers:{...SECURITY_HEADERS,'Content-Type':'application/json; charset=utf-8',...headers}});
}
export class HttpError extends Error { constructor(public status:number,public code:string,message:string){super(message);} }
export function assert(condition:unknown,status:number,code:string,message:string):asserts condition{
 if(!condition)throw new HttpError(status,code,message);
}
export async function bodyJson(req:Request):Promise<Record<string,unknown>>{
 const type=req.headers.get('content-type')||'';
 assert(type.includes('application/json'),415,'invalid_content_type','請傳送 JSON');
 const raw=await req.text();assert(raw.length<=16384,413,'too_large','資料太大');
 let value:unknown;try{value=JSON.parse(raw)}catch{throw new HttpError(400,'invalid_json','JSON 格式錯誤')}
 assert(!!value&&typeof value==='object'&&!Array.isArray(value),400,'invalid_json','需要 JSON 物件');
 return value as Record<string,unknown>;
}
export function cleanText(v:unknown,max:number,min=1):string{
 assert(typeof v==='string',422,'invalid_field','欄位應為文字');
 const s=v.trim();assert(s.length>=min&&s.length<=max,422,'invalid_field',`文字長度需介於 ${min}～${max}`);
 return s;
}
export function asString(v:unknown):string{return typeof v==='string'?v:'';}
export function httpErrorResponse(error:unknown,id:string):Response{
 if(error instanceof HttpError)return json({error:{code:error.code,message:error.message,request_id:id}},error.status);
 return json({error:{code:'server_error',message:'服務暫時無法使用',request_id:id}},500);
}
