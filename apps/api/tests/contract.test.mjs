import test from 'node:test';
import assert from 'node:assert/strict';
import {getViewer} from '../../../.build-tests/apps/api/src/auth/session.js';
import {centralCheck,demoEligible} from '../../../.build-tests/apps/api/src/access/eligibility.js';
import {accessFields} from '../../../.build-tests/apps/api/src/access/rules.js';

const local=new Request('http://localhost:8787/v1/session',{headers:{'x-demo-sub':'dev:tester','x-demo-eligible':'true'}});
const prod=new Request('https://learn.hglobal1985.com/v1/session',{headers:{'x-demo-sub':'dev:tester','x-demo-eligible':'true'}});
const env={MOCK_AUTH:'local-only',HGLOBAL_ID_CLIENT_SECRET:'inert-legacy-secret'};
test('authentication boundary only accepts explicit localhost demos',async()=>{
 assert.deepEqual(await getViewer(local,env),{sub:'dev:tester'});
 assert.equal(await getViewer(prod,env),null);
 assert.equal(await getViewer(local,{}),null);
});
test('legacy client secret cannot enable production login or central eligibility',async()=>{
 assert.equal(await getViewer(prod,env),null);
 assert.equal(await centralCheck(prod,env,{audience:'hglobal_verified',min_rank:'r21'},'dev:tester'),false);
 assert.equal(demoEligible(prod,env),false);
});
test('eligibility is fail closed and only local demos can simulate permission',async()=>{
 assert.equal(await centralCheck(local,env,{audience:'hglobal_verified',min_rank:'r21'},'dev:tester'),true);
 assert.equal(await centralCheck(local,env,{audience:'everyone',min_rank:'r21'},'dev:tester'),false);
 assert.equal(await centralCheck(local,env,{audience:'everyone',min_rank:null},''),false);
});
test('audience and min rank rules are validated on the server',()=>{
 assert.deepEqual(accessFields('rank','everyone',null),{audience:'everyone',minRank:null});
 assert.deepEqual(accessFields('rank','hglobal_verified','r21'),{audience:'hglobal_verified',minRank:'r21'});
 assert.deepEqual(accessFields('members','hglobal_verified','r21'),{audience:'everyone',minRank:null});
 assert.throws(()=>accessFields('rank','everyone','r21'),{code:'invalid_rank'});
 assert.throws(()=>accessFields('rank','unknown',null),{code:'invalid_audience'});
});
