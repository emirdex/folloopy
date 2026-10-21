import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import path from 'node:path';

const source=readFileSync(new URL('../server.cjs',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function startup(){
 let request:any,healthReady!:(value:any)=>void,nextReady!:()=>void;
 const health=new Promise(resolve=>{healthReady=resolve});
 const prepared=new Promise<void>(resolve=>{nextReady=resolve});
 const events:string[]=[],exits:number[]=[];
 const server={on(){},listen(){events.push('listen')},close(done:()=>void){events.push('close');done()}};
 const app={prepare:()=>{events.push('prepare');return prepared},getRequestHandler:()=> (_req:any,res:any)=>{res.writeHead(200);res.end('ready')},close:async()=>{}};
 const deps:Record<string,any>={
  'node:http':{createServer:(handler:any)=>{request=handler;return server}},
  'node:child_process':{spawn:()=>{events.push('spawn');return {on(){},kill(){events.push('kill')}}}},
  'node:path':path,
  next:()=>app,
  'tsx/cjs':{},
  './packages/runtime/config.ts':{productionConfig:()=>({apiPort:4000,apiUrl:'http://127.0.0.1:4000'})},
 };
 runInNewContext(source,{require:(name:string)=>{assert.ok(name in deps,name);return deps[name]},__dirname:process.cwd(),process:{env:{APP_MODE:'application',PORT:'3000'},on(){},exit:(code:number)=>exits.push(code)},console:{log(){},error(){}},fetch:()=>health,AbortSignal,setTimeout,clearTimeout});
 const response=()=>{const result:any={status:0,headers:{},body:''};request({}, {headersSent:false,writeHead:(status:number,headers:any={})=>{result.status=status;result.headers=headers},end:(body:string)=>{result.body=body}});return result};
 return {events,exits,response,healthReady,nextReady};
}

test('Hostinger listener opens before slow private API; requests stay unavailable until API and web are ready',async()=>{
 const boot=startup();
 assert.deepEqual(boot.events,['listen','spawn']);
 assert.equal(boot.response().status,503);
 assert.equal(boot.response().headers['Cache-Control'],'no-store');
 boot.healthReady({ok:true});await tick();
 assert.deepEqual(boot.events,['listen','spawn','prepare']);
 assert.equal(boot.response().status,503);
 boot.nextReady();await tick();
 const ready=boot.response();await tick();
 assert.equal(ready.status,200);assert.equal(ready.body,'ready');
 assert.deepEqual(boot.exits,[]);
});
