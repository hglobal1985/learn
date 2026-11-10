import test from 'node:test';
import assert from 'node:assert/strict';
import {canView, visibleCatalog, shareUrl, youtubeId, isMuxPublishable, hasPermission} from '../dist/index.js';

const base={id:'abc123',title:'示範',description:'',min_rank_code:null,source_type:'youtube',source_id:'dQw4w9WgXcQ',youtube_visibility:'unlisted',category:'一般',status:'published',access_mode:'public'};
const make=(mode)=>({...base,access_mode:mode,min_rank_code:mode==='rank'?'15':null});

test('guest only sees public video',async()=>{
 assert.equal(await canView(make('public'),null,async()=>false),true);
 assert.equal(await canView(make('members'),null,async()=>true),false);
 assert.equal(await canView(make('rank'),null,async()=>true),false);
});
test('logged in member sees member video',async()=>{
 assert.equal(await canView(make('members'),{sub:'s1'},async()=>false),true);
});
test('rank decisions belong exclusively to central API and fail closed',async()=>{
 let rule;
 assert.equal(await canView(make('rank'),{sub:'s1'},async(r)=>{rule=r;return true}),true);
 assert.deepEqual(rule,{audience:'hglobal_verified',min_rank:'15'});
 assert.equal(await canView(make('rank'),{sub:'s1'},async()=>false),false);
 assert.equal(await canView(make('rank'),{sub:'s1'},async()=>{throw Error('unavailable')}),false);
});
test('rank audience everyone is separately checked and never trusts the caller',async()=>{
 let rule;
 const v={...make('rank'),audience:'everyone',min_rank_code:null};
 assert.equal(await canView(v,{sub:'s1'},async r=>{rule=r;return true}),true);
 assert.deepEqual(rule,{audience:'everyone',min_rank:null});
 assert.equal(await canView({...v,min_rank_code:'r21'},{sub:'s1'},async()=>true),false);
 assert.equal(await canView({...v,audience:'unexpected'},{sub:'s1'},async()=>true),false);
 assert.equal(await canView(v,null,async()=>true),false);
});
test('draft and unlisted video are invisible',async()=>{
 assert.equal(await canView({...make('public'),status:'draft'},null,async()=>true),false);
 assert.equal(await canView({...make('public'),status:'unlisted'},null,async()=>true),false);
});
test('catalog totals exclude restricted results',async()=>{
 const r=await visibleCatalog([make('public'),make('members'),make('rank')],null,async()=>true);
 assert.equal(r.total,1);
});
test('sharing link has root path',()=>{
 assert.equal(shareUrl('abc123'),'https://learn.hglobal1985.com/abc123');
 assert.throws(()=>shareUrl('../etc'));
});
test('YouTube links reject impostor domain',()=>{
 assert.equal(youtubeId('https://youtu.be/dQw4w9WgXcQ'),'dQw4w9WgXcQ');
 assert.equal(youtubeId('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'),null);
});
test('restricted Mux video rejects public playback ID',()=>{
 const v={...make('rank'),source_type:'mux'};
 assert.equal(isMuxPublishable(v,['signed']),true);
 assert.equal(isMuxPublishable(v,['signed','public']),false);
 assert.equal(isMuxPublishable(v,['public']),false);
});
test('admin permissions are independent of video eligibility',()=>{
 assert.equal(hasPermission(new Set(['comments.moderate']),'upload'),false);
 assert.equal(hasPermission(new Set(['upload']),'upload'),true);
});
