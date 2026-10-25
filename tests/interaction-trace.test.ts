import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {interactionTraceScript} from '../apps/web/app/interaction-trace';
function fixture(enabled=false){
 const listeners=new Map<string,((event:any)=>void)[]>(),logs:string[]=[];let timers=0;
 const storage=new Map<string,string>(),listen=(name:string,fn:(event:any)=>void)=>listeners.set(name,[...(listeners.get(name)||[]),fn]);
 class Element{constructor(public href='https://folloopy.example/panel?id=private-member&password=secret'){}closest(){return {href:this.href}}}
 vm.runInNewContext(interactionTraceScript,{URL,Date,Set,Element,location:{href:'https://folloopy.example/?'+(enabled?'__interaction_trace=1':''),pathname:'/',origin:'https://folloopy.example'},sessionStorage:{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)},window:{addEventListener:listen},document:{addEventListener:listen,hidden:false,readyState:'interactive'},console:{warn:(tag:string,line:string)=>logs.push(tag+' '+line)},setTimeout:()=>{},performance:{getEntriesByType:()=>[{name:"https://folloopy.example/_next/static/chunks/page.js?private=secret",responseStatus:404,duration:200,decodedBodySize:0}]},setInterval:()=>{timers++},queueMicrotask});
 return {logs,timers,Element,emit:(name:string,event:any)=>listeners.get(name)?.forEach(fn=>fn(event))};
}
test('normal visitors get no tracing, listeners or heartbeat timer',()=>{const f=fixture();assert.equal(f.timers,0);assert.deepEqual(f.logs,[])});
test('opted-in trace records completed clicks without query or user data',async()=>{
 const f=fixture(true);for(const href of [undefined,'mailto:private@example.invalid','https://outside.example/private-id','https://folloopy.example/private-id'])f.emit('click',{target:new f.Element(href),defaultPrevented:false});await new Promise<void>(resolve=>queueMicrotask(resolve));
 f.emit('load',{});f.emit('error',{target:{src:'https://outside.example/private-id',tagName:'SCRIPT'}});assert.ok(f.logs.some(line=>line.includes('page.js')&&line.includes('404')));assert.equal(f.timers,1);assert.ok(f.logs.some(line=>line.includes('click:end')));assert.doesNotMatch(f.logs.join('\n'),/private-member|password|secret/);
});
