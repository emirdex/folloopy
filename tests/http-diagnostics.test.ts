import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
const {observeHttp}=createRequire(import.meta.url)('../packages/runtime/http-diagnostics.cjs');
function fixture(url='/panel?member=private@example.invalid'){
 let now=0,pending:(()=>void)|undefined;const logs:string[]=[],res=Object.assign(new EventEmitter(),{statusCode:200,writableFinished:false});
 observeHttp({url,method:'GET',headers:{authorization:'secret'},body:'private message'},res,{now:()=>now,schedule:(fn:()=>void)=>{pending=fn;return 1},clear:()=>{pending=undefined},log:(tag:string,value:string)=>logs.push(tag+' '+value)});
 return {res,logs,time:(ms:number)=>{now=ms},tick:()=>pending?.(),end:()=>{res.writableFinished=true;res.emit('finish');res.emit('close')},hasTimer:()=>!!pending};
}
test('normal requests leave no log entries or timers; failed assets are recorded',()=>{
 const f=fixture();f.time(500);f.end();assert.equal(f.logs.length,0);assert.equal(f.hasTimer(),false);assert.equal(f.res.listenerCount('close'),0);
 const a=fixture('/_next/static/chunks/old.js?dpl=old');a.res.statusCode=404;a.end();assert.equal(a.logs.length,1);assert.match(a.logs[0],/"status":404/);
});
test('stalled and aborted requests identify duration without changing their response',()=>{
 const f=fixture();f.time(10000);f.tick();assert.equal(f.logs.length,1);assert.match(f.logs[0],/"event":"pending"/);assert.equal(f.res.statusCode,200);assert.equal(f.res.writableFinished,false);
 f.time(15000);f.res.emit('close');assert.match(f.logs[1],/"event":"aborted"/);assert.match(f.logs[1],/"durationMs":15000/);assert.equal(f.hasTimer(),false);
});
test('diagnostics never retain query secrets, user identifiers, credentials or message contents',()=>{
 for(const url of ['/baglantilar/google/callback?code=secret','/blog/private-identifier','/t/o/secret-token.gif','/unknown/private-path?password=secret']){
  const f=fixture(url);f.res.statusCode=503;f.end();assert.equal(f.logs.length,1);assert.doesNotMatch(f.logs[0],/secret|private|password|authorization|code=|member=/);
 }
});
