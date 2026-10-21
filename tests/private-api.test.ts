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
