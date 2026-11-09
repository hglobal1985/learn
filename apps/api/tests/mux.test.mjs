import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHmac,createVerify} from 'node:crypto';
import {signedPlaybackToken,verifyWebhook,createDirectUpload} from '../../../.build-tests/apps/api/src/mux.js';
test('signed playback JWT uses RSA signature and correct Mux audience',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const pem=privateKey.export({format:'pem',type:'pkcs8'}).toString();
 const token=await signedPlaybackToken({MUX_SIGNING_KEY_ID:'kid123',MUX_SIGNING_PRIVATE_KEY:pem},'playback123','v',7200);
 const [h,p,s]=token.split('.');
 const d=JSON.parse(Buffer.from(p,'base64url').toString());assert.equal(d.sub,'playback123');assert.equal(d.aud,'v');
 const meta=JSON.parse(Buffer.from(h,'base64url').toString());assert.equal(meta.kid,'kid123');
 const verify=createVerify('RSA-SHA256');verify.update(`${h}.${p}`);verify.end();
 assert.equal(verify.verify(publicKey,Buffer.from(s,'base64url')),true);
});
test('webhook signatures reject forged and stale payloads',async()=>{
 const secret='test-secret';const b='{"type":"video.asset.ready"}';const ts=Math.floor(Date.now()/1000);
 const sig=createHmac('sha256',secret).update(`${ts}.${b}`).digest('hex');
 assert.equal(await verifyWebhook(b,`t=${ts},v1=${sig}`,secret),true);
 assert.equal(await verifyWebhook(b+'x',`t=${ts},v1=${sig}`,secret),false);
 assert.equal(await verifyWebhook(b,`t=${ts-800},v1=${sig}`,secret),false);
});
test('Mux direct upload creation requests signed playback only',async()=>{
 const prev=globalThis.fetch;let captured=null;
 globalThis.fetch=async(url,opts)=>{
  captured=JSON.parse(opts.body);
  assert.match(opts.headers.Authorization,/^Basic /);
  return new Response(JSON.stringify({data:{id:'upload123',url:'https://storage.mux.test/upload'}}),{status:200});
 };
 try{
  const result=await createDirectUpload({MUX_TOKEN_ID:'test-id',MUX_TOKEN_SECRET:'test-secret'},'video001','https://learn.hglobal1985.com');
  assert.equal(result.id,'upload123');assert.deepEqual(captured.new_asset_settings.playback_policies,['signed']);
 }finally{globalThis.fetch=prev}
});
