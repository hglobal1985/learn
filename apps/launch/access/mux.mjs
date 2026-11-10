/** Mux signed playback JWTs are minted only inside the Worker after authorization.
 * Mux's Dashboard/API private_key is usually Base64(PEM), NOT raw DER.
 * Supported: Mux Base64(PEM), PEM PKCS#8, PEM PKCS#1 and raw PKCS#8 DER Base64.
 * No signing key content or tokens are ever logged.
 */
const b64=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const decoder=new TextDecoder();
export class MuxSigningError extends Error{
 constructor(code){super(code);this.name='MuxSigningError';this.code=code}
}
function fromB64(value){
 const clean=String(value).replace(/\s/g,'').replace(/-/g,'+').replace(/_/g,'/');
 if(!clean||!/^[A-Za-z0-9+/]*={0,2}$/.test(clean))throw new MuxSigningError('mux_signing_key_invalid');
 try{return Uint8Array.from(atob(clean+'='.repeat((4-clean.length%4)%4)),c=>c.charCodeAt(0))}
 catch{throw new MuxSigningError('mux_signing_key_invalid')}
}
function concat(...chunks){
 const out=new Uint8Array(chunks.reduce((total,x)=>total+x.length,0));
 let offset=0;for(const bytes of chunks){out.set(bytes,offset);offset+=bytes.length}return out;
}
function derLength(size){
 if(size<128)return Uint8Array.of(size);
 const bytes=[];let n=size;
 while(n){bytes.unshift(n&255);n=Math.floor(n/256)}
 return Uint8Array.of(0x80|bytes.length,...bytes);
}
function der(tag,value){return concat(Uint8Array.of(tag),derLength(value.length),value)}
function pkcs1ToPkcs8(pkcs1){
 // PKCS#8 PrivateKeyInfo: version=0, rsaEncryption AlgorithmIdentifier, OCTET STRING PKCS#1.
 const algorithm=Uint8Array.of(0x30,0x0d,0x06,0x09,0x2a,0x86,0x48,0x86,0xf7,0x0d,0x01,0x01,0x01,0x05,0x00);
 const version=Uint8Array.of(0x02,0x01,0x00);
 return der(0x30,concat(version,algorithm,der(0x04,pkcs1)));
}
export function parseMuxSigningPrivateKey(secret){
 if(typeof secret!=='string'||!secret.trim())throw new MuxSigningError('mux_signing_key_missing');
 let text=secret.trim().replace(/\\n/g,'\n');
 if(!text.includes('-----BEGIN ')){
  const decoded=fromB64(text);
  const maybePem=decoder.decode(decoded);
  if(!maybePem.includes('-----BEGIN '))return decoded;
  text=maybePem;
 }
 const match=text.match(/-----BEGIN (RSA )?PRIVATE KEY-----([\s\S]*?)-----END (RSA )?PRIVATE KEY-----/);
 if(!match||(match[1]||'')!==(match[3]||''))throw new MuxSigningError('mux_signing_key_invalid');
 const derBytes=fromB64(match[2]);
 return match[1]?pkcs1ToPkcs8(derBytes):derBytes;
}
async function signingKey(privateValue){
 let derBytes;
 try{derBytes=parseMuxSigningPrivateKey(privateValue)}
 catch{throw new MuxSigningError('mux_signing_key_invalid')}
 try{
  return await crypto.subtle.importKey('pkcs8',derBytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 }catch{throw new MuxSigningError('mux_signing_key_invalid')}
}
export async function muxPlayback(env,video){
 if(video.source_type==='youtube')return {type:'youtube',video_id:video.source_id};
 if(!/^[A-Za-z0-9]+$/.test(video.source_id||''))return null;
 if(video.mux_playback_policy==='public'){
  if(video.access_mode!=='public')return null;
  return {type:'mux',playback_id:video.source_id,public:true};
 }
 if(video.mux_playback_policy!=='signed'||!env.MUX_SIGNING_KEY_ID||!env.MUX_SIGNING_PRIVATE_KEY)return null;
 const key=await signingKey(env.MUX_SIGNING_PRIVATE_KEY);
 const now=Math.floor(Date.now()/1000);
 const seconds=Math.min(21600,Math.max(7200,Math.ceil(video.duration_seconds||0)+900));
 const payload={sub:video.source_id,aud:'v',exp:now+seconds,iat:now};
 const unsigned=b64({alg:'RS256',typ:'JWT',kid:env.MUX_SIGNING_KEY_ID})+'.'+b64(payload);
 let signature;
 try{signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned))}
 catch{throw new MuxSigningError('mux_signing_failed')}
 const jwt=unsigned+'.'+btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 return {type:'mux',playback_id:video.source_id,playback_token:jwt,expires_in:seconds};
}
