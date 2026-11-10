import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createSign} from 'node:crypto';
import {verifyCentralAccessToken} from '../../../.build-tests/apps/api/src/auth/jwt.js';
import {getViewer} from '../../../.build-tests/apps/api/src/auth/session.js';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'});jwk.kid='test-2026-11';jwk.use='sig';jwk.alg='RS256';
const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const issuer='https://id.hglobal1985.com';
const sign=(payload,typ='at+jwt')=>{
 const data=enc({typ,alg:'RS256',kid:jwk.kid})+'.'+enc({iss:issuer,aud:issuer,app_id:'learn',sub:'owner-sub-123',exp:Math.floor(Date.now()/1000)+180,...payload});
 const s=createSign('RSA-SHA256').update(data).end().sign(privateKey).toString('base64url');
 return data+'.'+s;
};
const original=globalThis.fetch;
test('valid central JWT is checked with JWKS and gives sub',async()=>{
 globalThis.fetch=async(url)=>{assert.equal(url,issuer+'/oauth/jwks');return Response.json({keys:[jwk]})};
 try{
  const token=sign({});
  assert.equal((await verifyCentralAccessToken(token))?.sub,'owner-sub-123');
  const req=new Request('https://learn.hglobal1985.com/v1/session',{headers:{authorization:'Bearer '+token}});
  assert.deepEqual(await getViewer(req,{}),{sub:'owner-sub-123'});
 }finally{globalThis.fetch=original}
});
test('reject wrong issuer, audience, app, token typ and expiration',async()=>{
 for(const p of [{iss:'https://wrong.test'},{aud:'other'},{app_id:'other'},{exp:1},{nbf:Math.floor(Date.now()/1000)+999}]){
  assert.equal(await verifyCentralAccessToken(sign(p)),null);
 }
 assert.equal(await verifyCentralAccessToken(sign({},'JWT')),null);
 assert.equal(await verifyCentralAccessToken(sign({})+'tamper'),null);
 assert.equal(await getViewer(new Request('https://learn.hglobal1985.com/v1/session',{headers:{'x-demo-sub':'dev:owner'}}),{MOCK_AUTH:'local-only'}),null);
});
