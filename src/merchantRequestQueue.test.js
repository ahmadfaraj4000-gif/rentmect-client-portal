import test from 'node:test';
import assert from 'node:assert/strict';
import {createMerchantRequestQueue} from './merchantRequestQueue.js';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
test('availability runs one request at a time and only the newest queued schedule',async()=>{
 const run=createMerchantRequestQueue(),first=deferred(),started=deferred(),calls=[];
 const a=run(()=>{calls.push('first');started.resolve();return first.promise;});await started.promise;
 const b=run(()=>{calls.push('superseded');return 'old';});
 const c=run(()=>{calls.push('latest');return 'new';});
 assert.deepEqual(calls,['first']);first.resolve('initial');
 assert.deepEqual(await Promise.all([a,b,c]),['initial',undefined,'new']);
 assert.deepEqual(calls,['first','latest']);
});
test('failed availability requests release the queue for a fresh read',async()=>{
 const run=createMerchantRequestQueue(),first=deferred();
 const a=run(()=>first.promise);const failure=assert.rejects(a,/offline/);
 const b=run(()=>['available car']);first.reject(new Error('offline'));
 await failure;assert.deepEqual(await b,['available car']);
});
