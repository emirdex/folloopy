import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {once} from 'node:events';
import {installPrivateApi} from '../packages/runtime/private-api.cjs';

test('Private IPC preserves authorization, JSON and binary responses without a TCP listener',async()=>{
 const child=fork(new URL('./fixtures/private-api.cjs',import.meta.url),[],{stdio:['ignore','ignore','inherit','ipc'],execArgv:[]});
 const request=installPrivateApi(child,'http://127.0.0.1:4000');
 try{
  await once(child,'message');
  const unauthorized=await request('http://127.0.0.1:4000/echo',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
  assert.equal(unauthorized.status,401);
  const [a,b]=await Promise.all(['İletişim','Folloopy'].map(name=>request('http://127.0.0.1:4000/echo',{method:'POST',headers:{Authorization:'Bearer test-private-token','Content-Type':'application/json'},body:JSON.stringify({name})}).then(r=>r.json())));
  assert.deepEqual(a,{name:'İletişim'});assert.deepEqual(b,{name:'Folloopy'});
  const binary=await request('http://127.0.0.1:4000/binary',{headers:{Authorization:'Bearer test-private-token'}});
  assert.deepEqual([...new Uint8Array(await binary.arrayBuffer())],[0,255,10,200]);
  await assert.rejects(request('https://example.com/api'),/ORIGIN_INVALID/);
  await assert.rejects(request('http://127.0.0.1:4000/slow',{headers:{Authorization:'Bearer test-private-token'},signal:AbortSignal.timeout(10)}));
 }finally{child.kill();await once(child,'exit');}
 await assert.rejects(request('http://127.0.0.1:4000/echo'),/UNAVAILABLE/);
});

test('Same-process private API retains authentication, concurrent requests, binary data, aborts and origin isolation',async()=>{
 const {default:Fastify}=await import('fastify');const {installLocalApi}=await import('../packages/runtime/private-api.cjs');
 const app=Fastify();
 app.addHook('onRequest',async(req,reply)=>{if(req.headers.authorization!=='Bearer synthetic-key')return reply.code(401).send({code:'UNAUTHORIZED'})});
 app.post('/echo',async req=>req.body);
 app.get('/binary',async(_req,reply)=>reply.type('application/octet-stream').send(Buffer.from([0,255,10,200])));
 app.get('/slow',async()=>{await new Promise(resolve=>setTimeout(resolve,60));return {ok:true}});
 await app.ready();const request=installLocalApi(app,'http://127.0.0.1:4000');
 try{
  assert.equal((await request('http://127.0.0.1:4000/echo',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  const headers={Authorization:'Bearer synthetic-key','Content-Type':'application/json'};
  assert.deepEqual(await Promise.all(['İletişim','Folloopy'].map(name=>request('http://127.0.0.1:4000/echo',{method:'POST',headers,body:JSON.stringify({name})}).then(r=>r.json()))),[{name:'İletişim'},{name:'Folloopy'}]);
  const binary=await request('http://127.0.0.1:4000/binary',{headers});assert.deepEqual([...new Uint8Array(await binary.arrayBuffer())],[0,255,10,200]);
  const head=await request('http://127.0.0.1:4000/binary',{method:'HEAD',headers});assert.equal((await head.arrayBuffer()).byteLength,0);
  await assert.rejects(request('https://example.com/api'),/ORIGIN_INVALID/);
  await assert.rejects(request('http://127.0.0.1:4000/echo',{method:'POST',body:'x'.repeat(8*1024*1024+1)}),/BODY_TOO_LARGE/);
  await assert.rejects(request('http://127.0.0.1:4000/slow',{headers,signal:AbortSignal.timeout(10)}));
 }finally{await app.close()}
});
