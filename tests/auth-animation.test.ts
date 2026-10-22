import test from 'node:test';
import assert from 'node:assert/strict';
import {withAuthAnimation} from '../apps/web/app/auth-animation';

test('Account animation keeps a fast result pending without repeating the operation',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
 let calls=0,settled=false;
 const result=withAuthAnimation(async()=>{calls++;return {ok:true}}).then(value=>{settled=true;return value});
 await Promise.resolve();
 t.mock.timers.tick(1999);await Promise.resolve();assert.equal(settled,false);
 t.mock.timers.tick(1);assert.deepEqual(await result,{ok:true});assert.equal(calls,1);
});
test('Account animation preserves redirect and error signals',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
 const redirect=new Error('NEXT_REDIRECT');
 const result=withAuthAnimation(async()=>{throw redirect});
 const assertion=assert.rejects(result,error=>error===redirect);
 await Promise.resolve();t.mock.timers.tick(2000);await assertion;
});
test('A slow account operation gets no additional animation delay',async t=>{
 t.mock.timers.enable({apis:['Date','setTimeout'],now:0});
 const result=withAuthAnimation(async()=>{await new Promise(resolve=>setTimeout(resolve,3000));return 'complete'});
 t.mock.timers.tick(3000);assert.equal(await result,'complete');assert.equal(Date.now(),3000);
});
