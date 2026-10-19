import assert from 'node:assert/strict';
import {openDatabase,migrate} from '../packages/database/index';
import {FakeProvider} from '../packages/provider-adapters/index';
import {seedLocal} from '../apps/api/service';
import {buildServer} from '../apps/api/server';
import {processBatch} from '../apps/worker/process';
const db=await openDatabase();await migrate(db);await seedLocal(db);
const key='smoke-test-key-at-least-32-characters';
const {app,service}=buildServer(db,new FakeProvider(),key,'http://127.0.0.1:4000');
try{
 const address=await app.listen({host:'127.0.0.1',port:0});
 const response=await fetch(address+'/api/test-submissions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','idempotency-key':'smoke-http-test-0001'},body:JSON.stringify({subject:'HTTP kontrollü test',to:'recipient@example.invalid',text:'Sentetik test',tracking:true})});
 assert.equal(response.status,200);
 const sent=await response.json() as {id:string;state:string;testPixel:string};assert.equal(sent.state,'sent');
 const pixel=await fetch(address+new URL(sent.testPixel).pathname);assert.equal(pixel.status,200);assert.equal(pixel.headers.get('content-type'),'image/gif');
 await processBatch(db);
 const detail=await service.detail('00000000-0000-4000-8000-000000000001',sent.id);assert.equal(detail!.events.length,1);assert.equal(detail!.events[0].source,'unknown');
 console.log('PASS: gerçek localhost HTTP → fake gönderim → GIF → SQL olay → worker → unknown değerlendirmesi. Gerçek e-posta gönderilmedi.');
}finally{await app.close();await db.close()}
