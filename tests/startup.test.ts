import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';
import {EventEmitter} from 'node:events';

const source=readFileSync(new URL('../server.cjs',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function startup(){
 let request:any,healthReady!:(value:any)=>void,apiReady!:(value:any)=>void,apiFailed!:(error:Error)=>void,nextReady!:()=>void,nextFailed!:(error:Error)=>void;
 const health=new Promise(resolve=>{healthReady=resolve});
 const initialized=new Promise((resolve,reject)=>{apiReady=resolve;apiFailed=reject});
 const prepared=new Promise<void>((resolve,reject)=>{nextReady=resolve;nextFailed=reject});
 const events:string[]=[],exits:number[]=[],forwarded:any[]=[];
 const server={on(){},listen(){events.push('listen')},close(done:()=>void){events.push('close');done()}};
 const app={prepare:()=>{events.push('prepare');return prepared},getRequestHandler:()=> (req:any,res:any)=>{forwarded.push(req);res.writeHead(200);res.end('ready')},close:async()=>{}};
 const deps:Record<string,any>={
  './packages/runtime/http-diagnostics.cjs':{observeHttp:(req:any,res:any,options:any)=>createRequire(import.meta.url)('../packages/runtime/http-diagnostics.cjs').observeHttp(req,res,{...options,log(){}})},
  './packages/runtime/public-request.cjs':createRequire(import.meta.url)('../packages/runtime/public-request.cjs'),
  'node:http':{createServer:(handler:any)=>{request=handler;return server}},
  './apps/api/runtime.ts':{startApi:()=>{events.push('api-start');return initialized}},
  'node:path':path,
  next:()=>app,
  'tsx/cjs':{},
  './packages/runtime/private-api.cjs':{installLocalApi:()=>{events.push('private-api-installed');return ()=>health}},
  './packages/runtime/config.ts':{productionConfig:()=>({apiPort:4000,apiUrl:'http://127.0.0.1:4000'})},
 };
 runInNewContext(source,{require:(name:string)=>{assert.ok(name in deps,name);return deps[name]},__dirname:process.cwd(),process:{env:{APP_MODE:'application',PORT:'3000',SITE_URL:'https://folloopy.example'},on(){},exit:(code:number)=>exits.push(code)},console:{log(){},error(){}},fetch:()=>health,AbortSignal,setTimeout,clearTimeout});
 const response=(req:any={method:'GET',url:'/'})=>{const result:any={status:0,headers:{},body:''};const res:any=Object.assign(new EventEmitter(),{headersSent:false,statusCode:200,writableFinished:false,writeHead:(status:number,headers:any={})=>{result.status=status;result.headers=headers;res.statusCode=status;res.headersSent=true},end:(body:string)=>{result.body=body;res.writableFinished=true;res.emit('finish')}});request({...req,headers:{host:'folloopy.example',...(req.method==='POST'?{origin:'https://folloopy.example'}:{}),...req.headers}},res);return result};
 return {events,exits,forwarded,response,healthReady,apiReady:()=>apiReady({app:{},close:async()=>{events.push('api-close')}}),apiFailed,nextReady,nextFailed};
}

test('Cold-start GET and login POST wait for API and web readiness instead of receiving a transient 503',async()=>{
 const boot=startup();
 assert.deepEqual(boot.events,['listen','api-start']);
 const get=boot.response();
 const postRequest={method:'POST',url:'/giris',body:'untouched-request-stream'};
 const post=boot.response(postRequest);
 await tick();assert.equal(get.status,0);assert.equal(post.status,0);
 boot.apiReady();await tick();boot.healthReady({ok:true});await tick();
 assert.deepEqual(boot.events,['listen','api-start','private-api-installed','prepare']);
 assert.equal(get.status,0);assert.equal(post.status,0);
 boot.nextReady();await tick();
 assert.equal(get.status,200);assert.equal(post.status,200);
 assert.equal(boot.forwarded[1].body,postRequest.body);
 assert.deepEqual(boot.exits,[]);
});

test('Failed initialization releases queued requests with an uncached error and never serves application content',async()=>{
 const boot=startup();const queued=boot.response();
 boot.apiReady();await tick();boot.healthReady({ok:true});await tick();boot.nextFailed(Error('startup failure'));await tick();
 assert.equal(queued.status,503);
 assert.equal(queued.headers['Cache-Control'],'no-store');
 assert.deepEqual(boot.forwarded,[]);assert.deepEqual(boot.exits,[1]);
});

test('A failed database/API initialization exits without exposing the application or waiting for a child handshake',async()=>{
 const boot=startup(),queued=boot.response();
 boot.apiFailed(Error('database unavailable'));await tick();
 assert.equal(queued.status,503);assert.deepEqual(boot.forwarded,[]);
 assert.deepEqual(boot.events,['listen','api-start','close']);assert.deepEqual(boot.exits,[1]);
});

test('Untrusted hosts and cross-origin POSTs are rejected before cold-start queuing or Next execution',async()=>{
 const boot=startup();const host=boot.response({method:'GET',url:'/panel',headers:{host:'attacker.example'}});assert.equal(host.status,421);const origin=boot.response({method:'POST',url:'/giris',headers:{origin:'https://attacker.example','x-forwarded-host':'attacker.example'}});assert.equal(origin.status,403);assert.deepEqual(boot.forwarded,[]);
 boot.apiReady();await tick();boot.healthReady({ok:true});await tick();boot.nextReady();await tick();assert.deepEqual(boot.forwarded,[]);
});

test('Public www GET navigation redirects to the canonical site before cold start, without weakening POST checks',async()=>{
 const boot=startup();const page=boot.response({method:'GET',url:'/kayit?plan=team',headers:{host:'www.folloopy.example'}});assert.equal(page.status,308);assert.equal(page.headers.Location,'https://folloopy.example/kayit?plan=team');assert.equal(boot.response({method:'POST',url:'/giris',headers:{host:'www.folloopy.example'}}).status,421);
 boot.apiReady();await tick();boot.healthReady({ok:true});await tick();boot.nextReady();await tick();assert.deepEqual(boot.forwarded,[]);
});
