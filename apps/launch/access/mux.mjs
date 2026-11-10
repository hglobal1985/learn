/** Mux signed playback JWTs are minted only inside the Worker after authorization. */
const b64=value=>btoa(JSON.stringify(value)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export async function muxPlayback(env,video){
 if(video.source_type==='youtube')return {type:'youtube',video_id:video.source_id};
 if(!/^[A-Za-z0-9]+$/.test(video.source_id||''))return null;
 if(video.mux_playback_policy==='public'){
  if(video.access_mode!=='public')return null;
  return {type:'mux',playback_id:video.source_id,public:true};
 }
 if(video.mux_playback_policy!=='signed'||!env.MUX_SIGNING_KEY_ID||!env.MUX_SIGNING_PRIVATE_KEY)return null;
 const content=env.MUX_SIGNING_PRIVATE_KEY.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 const binary=atob(content);
 const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(binary,x=>x.charCodeAt(0)).buffer,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 const now=Math.floor(Date.now()/1000);
 const seconds=Math.min(21600,Math.max(7200,Math.ceil(video.duration_seconds||0)+900));
 const payload={sub:video.source_id,aud:'v',exp:now+seconds,iat:now};
 const unsigned=b64({alg:'RS256',typ:'JWT',kid:env.MUX_SIGNING_KEY_ID})+'.'+b64(payload);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
 const jwt=unsigned+'.'+btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 return {type:'mux',playback_id:video.source_id,playback_token:jwt,expires_in:seconds};
}
