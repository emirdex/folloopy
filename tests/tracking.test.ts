import test from 'node:test';
import assert from 'node:assert/strict';
import {assess,transition,token,tokenHash,validateDestination} from '../packages/domain/tracking';
import {openDatabase,migrate} from '../packages/database/index';
import {FakeProvider} from '../packages/provider-adapters/index';
import {TrackingService,seedLocal,LOCAL_WORKSPACE} from '../apps/api/service';
import {buildServer} from '../apps/api/server';
import {processBatch} from '../apps/worker/process';
const input={subject:'Kontrollü test',to:'recipient@example.invalid',text:'Merhaba <script>alert(1)</script>',tracking:true};
const key='test-idempotency-0001';
const apiKey='test-key-with-at-least-32-characters';
async function setup(provider=new FakeProvider()){
 const db=await openDatabase();await migrate(db);await seedLocal(db);
 const server=buildServer(db,provider,apiKey,'http://127.0.0.1:4000');
 return {db,provider,...server};
}
test('Gözlem insan veya doğrulanmış kişi kanıtı değildir',()=>{
 const e={occurredAt:new Date('2026-10-19T12:00:00Z'),sentAt:new Date('2026-10-19T11:00:00Z'),recipientCount:3};
 assert.equal(assess(e).source,'unknown');assert.equal(assess(e).notify,false);assert.equal(assess(e).identity,'ambiguous_recipients');
 assert.equal(assess({...e,ownVerified:true}).source,'own_activity');
 assert.equal(assess({...e,automationSignatureVerified:true}).notify,false);
 assert.equal(assess({...e,humanActionVerified:true}).source,'likely_human');
 assert.equal(assess({...e,sentAt:null,humanActionVerified:true}).source,'unknown');
 assert.equal(assess({...e,occurredAt:new Date('2026-10-19T10:00:00Z')}).reasonCodes[0],'NOT_CONFIRMED_SENT');
});
test('Belirsiz gönderim yeniden sending yapılamaz',()=>{assert.equal(transition('sending','unknown'),'unknown');assert.throws(()=>transition('unknown','sending'));assert.throws(()=>transition('sent','sending'))});
test('Token ve imzalı URL sözleşmesi',()=>{
 const secret=token();assert.equal(secret.length,43);assert.equal(tokenHash(secret).length,64);assert.notEqual(token(),secret);
 const url='https://example.com/a?b=2&a=%2f#part';assert.equal(validateDestination(url),url);
 for(const u of ['javascript:alert(1)','file:///tmp/a','https://user:pass@example.com','https://example.com/\r\nX:1'])assert.throws(()=>validateDestination(u));
});
test('Tek gönderim, tekrar, conflict ve MIME güvenliği',async()=>{
 const {db,service,provider,app}=await setup();
 try{
  const first=await service.send(LOCAL_WORKSPACE,key,input);const second=await service.send(LOCAL_WORKSPACE,key,input);
  assert.equal(first.id,second.id);assert.equal(provider.submissions.length,1);assert.equal(second.replay,true);
  await assert.rejects(()=>service.send(LOCAL_WORKSPACE,key,{...input,subject:'Başka'}),/IDEMPOTENCY_CONFLICT/);
  assert.match(provider.submissions[0].raw,/multipart\/alternative/);
  const html=Buffer.from(provider.submissions[0].raw.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0],'base64').toString();
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('/t/o/'));
 }finally{await app.close();await db.close()}
});
test('Timeout çift gönderim yaratmaz',async()=>{
 const {db,service,provider,app}=await setup(new FakeProvider('timeout'));
 try{
  assert.equal((await service.send(LOCAL_WORKSPACE,key,input)).state,'unknown');
  assert.equal((await service.send(LOCAL_WORKSPACE,key,input)).state,'unknown');
  assert.equal(provider.submissions.length,1);
 }finally{await app.close();await db.close()}
});
test('HTTP piksel, HEAD, worker replay, stop ve müşteri sınırı',async()=>{
 const {db,service,app}=await setup();
 try{
  const sent=await service.send(LOCAL_WORKSPACE,key,input) as {id:string;testPixel:string};
  const path=new URL(sent.testPixel).pathname;
  assert.equal((await app.inject({method:'HEAD',url:path})).statusCode,200);
  assert.equal((await service.detail(LOCAL_WORKSPACE,sent.id))!.events.length,0);
  const image=await app.inject({method:'GET',url:path});assert.equal(image.statusCode,200);assert.equal(image.headers['content-type'],'image/gif');assert.match(image.headers['cache-control'] as string,/no-store/);
  assert.equal(await processBatch(db),1);assert.equal(await processBatch(db),0);
  const detail=await service.detail(LOCAL_WORKSPACE,sent.id);assert.equal(detail!.events.length,1);assert.equal(detail!.events[0].source,'unknown');
  const other='00000000-0000-4000-8000-000000000002';
  await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[other,'Diğer müşteri']);
  assert.deepEqual(await service.list(other),[]);assert.equal(await service.detail(other,sent.id),null);assert.equal(await service.stop(other,sent.id),false);
  assert.equal((await app.inject({method:'POST',url:`/api/messages/${sent.id}/stop`,headers:{authorization:'Bearer '+apiKey}})).statusCode,200);await app.inject({method:'GET',url:path});
  assert.equal((await service.detail(LOCAL_WORKSPACE,sent.id))!.events.length,1);
  const invalid=await app.inject({method:'GET',url:'/t/o/'+'x'.repeat(43)+'.gif'});assert.equal(invalid.body,image.body);
  assert.equal((await app.inject({method:'GET',url:'/api/messages'})).statusCode,401);
  assert.equal((await app.inject({method:'GET',url:'/api/messages?workspace_id='+other,headers:{authorization:'Bearer '+apiKey}})).statusCode,400);
 }finally{await app.close();await db.close()}
});
test('Kota ve eşzamanlı tekrarlar',async()=>{
 const {db,service,provider,app}=await setup();
 try{
  await db.query('UPDATE entitlements SET message_limit=1 WHERE workspace_id=$1',[LOCAL_WORKSPACE]);
  const results=await Promise.all(Array.from({length:5},()=>service.send(LOCAL_WORKSPACE,key,input)));
  assert.equal(new Set(results.map(r=>r.id)).size,1);assert.equal(provider.submissions.length,1);
  await assert.rejects(()=>service.send(LOCAL_WORKSPACE,'test-idempotency-0002',input),/LIMIT_REACHED/);
  assert.equal((await db.query<{used:number}>('SELECT used FROM entitlements WHERE workspace_id=$1',[LOCAL_WORKSPACE])).rows[0].used,1);
 }finally{await app.close();await db.close()}
});
test('API girdi kontrolü ve takip kapalı MIME',async()=>{
 const {db,service,provider,app}=await setup();
 try{
  const headers={authorization:'Bearer '+apiKey,'idempotency-key':key};
  for(const to of ['real@gmail.com','bad@example.invalid\r\nBcc: real@gmail.com']){
   assert.equal((await app.inject({method:'POST',url:'/api/test-submissions',headers,payload:{...input,to}})).statusCode,400);
  }
  assert.equal((await app.inject({method:'POST',url:'/api/test-submissions',headers,payload:{...input,subject:'x\r\nBcc: x'}})).statusCode,400);
  await service.send(LOCAL_WORKSPACE,key,{...input,tracking:false});
  assert.equal((await db.query('SELECT * FROM tracking_tokens')).rows.length,0);
  const encoded=provider.submissions[0].raw.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n')[0];
  assert.ok(!Buffer.from(encoded,'base64').toString().includes('<img'));
 }finally{await app.close();await db.close()}
});
test('DB arızasında piksel bozulmaz ve hata sayılır',async()=>{
 const {db,app,metrics}=await setup();await db.close();
 try{const response=await app.inject({method:'GET',url:'/t/o/'+'x'.repeat(43)+'.gif'});assert.equal(response.statusCode,200);assert.equal(metrics.collectorErrors,1)}finally{await app.close()}
});

test('Member opening summary aggregates repeated events and excludes identified automation/own activity',async()=>{
 const {db,service,app}=await setup();
 try{
  const sent=await service.send(LOCAL_WORKSPACE,key,input) as {id:string;testPixel:string};const path=new URL(sent.testPixel).pathname;
  await app.inject({method:'GET',url:path});await app.inject({method:'GET',url:path});await processBatch(db);
  const list=await service.list(LOCAL_WORKSPACE),detail=await service.detail(LOCAL_WORKSPACE,sent.id);
  assert.equal(list[0].raw_count,2);assert.equal(list[0].activity_count,2);
  assert.ok(list[0].first_activity_at);assert.ok(list[0].last_activity_at);
  assert.equal(detail!.message.activity_count,2);assert.equal(+new Date(detail!.message.first_activity_at as string),+new Date(list[0].first_activity_at as string));
  await service.stop(LOCAL_WORKSPACE,sent.id);assert.equal((await service.detail(LOCAL_WORKSPACE,sent.id))!.message.activity_count,2);
  await db.query("UPDATE event_assessments SET source='known_automation'");
  assert.equal((await service.list(LOCAL_WORKSPACE))[0].activity_count,0);assert.equal((await service.detail(LOCAL_WORKSPACE,sent.id))!.message.first_activity_at,null);
  await db.query("UPDATE event_assessments SET source='own_activity'");assert.equal((await service.list(LOCAL_WORKSPACE))[0].activity_count,0);
  assert.equal((await service.detail(LOCAL_WORKSPACE,sent.id))!.events.length,2);
 }finally{await app.close();await db.close()}
});
