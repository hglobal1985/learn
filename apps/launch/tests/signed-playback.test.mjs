import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify,createSign} from 'node:crypto';
import {muxPlayback,parseMuxSigningPrivateKey,MuxSigningError} from '../access/mux.mjs';
import {AUTH_BROWSER_JS} from '../auth/web-client.mjs';
import worker from '../worker.mjs';

const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const pkcs8=privateKey.export({type:'pkcs8',format:'pem'});
const pkcs1=privateKey.export({type:'pkcs1',format:'pem'});
const muxFormatPem=text=>Buffer.from(text,'utf8').toString('base64');
const video={source_type:'mux',source_id:'signedPlaybackId0000',access_mode:'rank',mux_playback_policy:'signed',duration_seconds:7358,status:'published'};
const env=key=>({MUX_SIGNING_KEY_ID:'muxSigningKey123',MUX_SIGNING_PRIVATE_KEY:key});
const signatureValid=value=>{
 const [header,payload,sig]=value.playback_token.split('.');
 const h=JSON.parse(Buffer.from(header,'base64url').toString('utf8'));
 const p=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
 assert.equal(h.alg,'RS256');
 assert.equal(h.kid,'muxSigningKey123');
 assert.equal(p.sub,'signedPlaybackId0000');
 assert.equal(p.aud,'v');
 assert.ok(p.exp>Math.floor(Date.now()/1000)+7358);
 assert.ok(verify('RSA-SHA256',Buffer.from(header+'.'+payload),publicKey,Buffer.from(sig,'base64url')));
};
test('official Mux Base64(PEM PKCS#8) signs correctly',async()=>{
 const jwt=await muxPlayback(env(muxFormatPem(pkcs8)),video);
 assert.equal(jwt.type,'mux');
 assert.equal(jwt.public,undefined);
 signatureValid(jwt);
});
test('Mux Base64(PEM RSA PRIVATE KEY PKCS#1) signs correctly',async()=>{
 const jwt=await muxPlayback(env(muxFormatPem(pkcs1)),video);
 signatureValid(jwt);
});
test('PEM PKCS#8, PEM PKCS#1, escaped line breaks, raw DER Base64 all sign correctly',async()=>{
 const rawDer=privateKey.export({type:'pkcs8',format:'der'}).toString('base64');
 const formats=[pkcs8,pkcs1,pkcs8.replace(/\n/g,'\\n'),rawDer];
 for(const format of formats){
  assert.ok(parseMuxSigningPrivateKey(format).byteLength>0);
  signatureValid(await muxPlayback(env(format),video));
 }
});
test('malformed Mux signing private key rejects without revealing any key material',async()=>{
 const secret='THIS_IS_NOT_A_VALID_PRIVATE_KEY_77309';
 await assert.rejects(()=>muxPlayback(env(secret),video),error=>
  error instanceof MuxSigningError&&error.code==='mux_signing_key_invalid'&&!error.message.includes(secret));
 await assert.rejects(()=>muxPlayback(env('%%%'),video),MuxSigningError);
});
test('public sources never require signing material and private sources cannot downgrade to public',async()=>{
 const pub=await muxPlayback({}, {...video,access_mode:'public',mux_playback_policy:'public'});
 assert.equal(pub.public,true);
 assert.equal((await muxPlayback({},video)),null);
 assert.equal((await muxPlayback(env(muxFormatPem(pkcs8)),{...video,access_mode:'rank',mux_playback_policy:'public'})),null);
});
test('browser shows returned safe status by the player and a retry button',()=>{
 assert.doesNotThrow(()=>new Function(AUTH_BROWSER_JS));
 assert.match(AUTH_BROWSER_JS,/player-error/);
 assert.match(AUTH_BROWSER_JS,/重新嘗試播放/);
 assert.match(AUTH_BROWSER_JS,/notice\.textContent=error instanceof Error/);
});
const issuer='https://id.hglobal1985.com';
const keyJwk=publicKey.export({format:'jwk'});keyJwk.kid='signed-test-jwks';keyJwk.use='sig';keyJwk.alg='RS256';
const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function token(){
 const h=e({alg:'RS256',typ:'at+jwt',kid:keyJwk.kid});
 const p=e({iss:issuer,aud:issuer,app_id:'learn',sub:'central-admin-sub',exp:Math.floor(Date.now()/1000)+180});
 const input=h+'.'+p;
 return input+'.'+createSign('RSA-SHA256').update(input).end().sign(privateKey).toString('base64url');
}
test('the signed playback endpoint returns safe 503 when stored key is invalid, without leaking secrets',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  const u=String(url);
  if(u===issuer+'/oauth/jwks')return Response.json({keys:[keyJwk]});
  if(u===issuer+'/v1/apps/learn/config')return Response.json({app_id:'learn',status:'active'});
  if(u===issuer+'/v1/apps/learn/handoff')return Response.json({app_id:'learn',up_to_date:true});
  if(u===issuer+'/v1/eligibility/check')return Response.json({allowed:false});
  throw Error('unexpected mock external request');
 };
 const secret='not-a-real-private-key-secret';
 const db={prepare(){return {bind(){return this},async first(){return {...video,id:'jade20261108'}},async all(){return {results:[]}}}}};
 try{
  const request=new Request('https://learn.hglobal1985.com/v1/videos/jade20261108/playback',{
   method:'POST',headers:{Authorization:'Bearer '+token()}
  });
  const response=await worker.fetch(request,{DB:db,MUX_SIGNING_KEY_ID:'muxSigningKey123',MUX_SIGNING_PRIVATE_KEY:secret});
  assert.equal(response.status,503);
  const body=await response.json();
  assert.equal(body.error.code,'mux_signing_key_invalid');
  assert.match(body.error.message,/金鑰格式/);
  assert.doesNotMatch(JSON.stringify(body),new RegExp(secret));
 }finally{globalThis.fetch=original}
});
