import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import path from 'node:path';

const source=readFileSync(new URL('../server.cjs',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function startup(){
 let request:any,healthReady!:(value:any)=>void,nextReady!:()=>void,nextFailed!:(error:Error)=>void;
 const health=new Promise(resolve=>{healthReady=resolve});
 const prepared=new Promise<void>((resolve,reject)=>{nextReady=resolve;nextFailed=reject});
 const events:string[]=[],exits:number[]=[],forwarded:any[]=[];
 const server={on(){},listen(){events.push('listen')},close(done:()=>void){events.push('close');done()}};
 const app={prepare:()=>{events.push('prepare');return prepared},getRequestHandler:()=> (req:any,res:any)=>{forwarded.push(req);res.writeHead(200);res.end('ready')},close:async()=>{}};
 const deps:Record<string,any>={
  'node:http':{createServer:(handler:any)=>{request=handler;return server}},
  'node:child_process':{spawn:()=>{events.push('spawn');return {on(){},kill(){events.push('kill')}}}},
  'node:path':path,
  next:()=>app,
  'tsx/cjs':{},
  './packages/runtime/private-api.cjs':{installPrivateApi:()=>()=>health},
  './packages/runtime/config.ts':{productionConfig:()=>({apiPort:4000,apiUrl:'http://127.0.0.1:4000'})},
 };
 runInNewContext(source,{require:(name:string)=>{assert.ok(name in deps,name);return deps[name]},__dirname:process.cwd(),process:{env:{APP_MODE:'application',PORT:'3000'},on(){},exit:(code:number)=>exits.push(code)},console:{log(){},error(){}},fetch:()=>health,AbortSignal,setTimeout,clearTimeout});
 const response=(req:any={method:'GET',url:'/'})=>{const result:any={status:0,headers:{},body:''};request(req, {headersSent:false,writeHead:(status:number,headers:any={})=>{result.status=status;result.headers=headers},end:(body:string)=>{result.body=body}});return result};
 return {events,exits,forwarded,response,healthReady,nextReady,nextFailed};
}

test('Cold-start GET and login POST wait for API and web readiness instead of receiving a transient 503',async()=>{
 const boot=startup();
 assert.deepEqual(boot.events,['listen','spawn']);
 const get=boot.response();
 const postRequest={method:'POST',url:'/giris',body:'untouched-request-stream'};
 const post=boot.response(postRequest);
 await tick();assert.equal(get.status,0);assert.equal(post.status,0);
 boot.healthReady({ok:true});await tick();
 assert.deepEqual(boot.events,['listen','spawn','prepare']);
 assert.equal(get.status,0);assert.equal(post.status,0);
 boot.nextReady();await tick();
 assert.equal(get.status,200);assert.equal(post.status,200);
 assert.equal(boot.forwarded[1],postRequest);
 assert.deepEqual(boot.exits,[]);
});

test('Failed initialization releases queued requests with an uncached error and never serves application content',async()=>{
 const boot=startup();const queued=boot.response();
 boot.healthReady({ok:true});await tick();boot.nextFailed(Error('startup failure'));await tick();
 assert.equal(queued.status,503);
 assert.equal(queued.headers['Cache-Control'],'no-store');
 assert.deepEqual(boot.forwarded,[]);assert.deepEqual(boot.exits,[1]);
});
