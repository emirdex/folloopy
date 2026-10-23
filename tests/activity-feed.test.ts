import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database';
import {seedLocal,LOCAL_WORKSPACE,TrackingService} from '../apps/api/service';
import {activityFeed} from '../apps/api/activity-feed';
import {activityHref} from '../packages/domain/activity-feed';
import {buildServer} from '../apps/api/server';
import {FakeProvider} from '../packages/provider-adapters';

test('500 mails have bounded stable pages, full-history search and correct opening groups',async()=>{
 const db=await openDatabase();await migrate(db);await seedLocal(db);
 try{
  await db.query(`INSERT INTO messages(id,workspace_id,submission_id,idempotency_key,payload_hash,subject,recipient_count,state,provider,rfc_message_id,sent_at)
   SELECT md5('feed-'||i)::uuid,$1,md5('submission-'||i)::uuid,'feed-'||i,'fixture','Teklif '||lpad(i::text,4,'0'),1,'sent','fake','fixture-'||i,now()-(i||' hours')::interval FROM generate_series(1,500) i`,[LOCAL_WORKSPACE]);
  const message=(await db.query<{id:string}>("SELECT id FROM messages WHERE subject='Teklif 0001'")).rows[0].id;
  for(const minutes of [0,1,8])await db.query("INSERT INTO raw_events(id,workspace_id,message_id,kind,occurred_at) VALUES($1,$2,$3,'image_fetch',now()-interval '30 minutes'+($4::text||' minutes')::interval)",[randomUUID(),LOCAL_WORKSPACE,message,minutes]);
  // An automation fetch is not an opening and cannot bridge real opening bursts.
  const bot=randomUUID();await db.query("INSERT INTO raw_events(id,workspace_id,message_id,kind,occurred_at) VALUES($1,$2,$3,'image_fetch',now())",[bot,LOCAL_WORKSPACE,message]);
  await db.query("INSERT INTO event_assessments(event_id,workspace_id,source,identity_relation,reason_codes,classifier_version) VALUES($1,$2,'known_automation','unknown','[]','test')",[bot,LOCAL_WORKSPACE]);
  const first=await activityFeed(db,LOCAL_WORKSPACE);
  assert.equal(first.total,502);assert.equal(first.events.length,10);assert.equal(first.sent,500);assert.equal(first.opens,2);assert.equal(first.openedMessages,1);assert.equal(first.messageCount,500);
  assert.equal(first.events[0].label,'2. Açılma Algılandı');
  const detail=await new TrackingService(db,new FakeProvider(),'http://localhost').detail(LOCAL_WORKSPACE,message);assert.equal(detail?.openings.length,first.opens);
  const next=await activityFeed(db,LOCAL_WORKSPACE,{offset:10});assert.equal(next.offset,10);assert.equal(next.events.length,10);assert.equal(first.events.some(a=>next.events.some(b=>a.id===b.id)),false);
  const last=await activityFeed(db,LOCAL_WORKSPACE,{offset:100000});assert.equal(last.offset,500);assert.equal(last.events.length,2);
  const found=await activityFeed(db,LOCAL_WORKSPACE,{q:'Teklif 0500',offset:30});assert.equal(found.total,1);assert.equal(found.offset,0);assert.equal(found.events[0].message.subject,'Teklif 0500');
  const load=await activityFeed(db,LOCAL_WORKSPACE,{filter:'load'});assert.equal(load.total,2);assert.ok(load.events.every(e=>e.type==='load'));assert.equal(load.sent,500);
  const recent=await activityFeed(db,LOCAL_WORKSPACE,{range:'7'});assert.ok(recent.total<200);assert.ok(recent.events.every(e=>Date.parse(e.at)>Date.now()-7*86400000));
  const empty=await activityFeed(db,LOCAL_WORKSPACE,{q:"' OR 1=1 --"});assert.equal(empty.total,0);assert.equal(empty.events.length,0);assert.equal(empty.latest,null);assert.equal(empty.offset,0);
  const other=randomUUID();await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[other,'Other']);assert.equal((await activityFeed(db,other)).total,0);
  // Every sent record remains reachable, including history outside the old last-12 cap.
  const ids=new Set<string>();for(let offset=0;offset<502;offset+=10)for(const event of (await activityFeed(db,LOCAL_WORKSPACE,{offset})).events)ids.add(event.id);assert.equal(ids.size,502);
 }finally{await db.close()}
});

test('activity API enforces authentication and bounded validated query parameters',async()=>{
 const db=await openDatabase();await migrate(db);await seedLocal(db);const key='activity-test-key-at-least-32-characters';const {app}=buildServer(db,new FakeProvider(),key,'http://localhost');
 try{
  assert.equal((await app.inject({method:'GET',url:'/api/activity'})).statusCode,401);
  for(const query of ['offset=-1','offset=100001','offset=1.5','filter=invalid','range=1','workspace_id='+randomUUID(),'q='+'a'.repeat(201)])assert.equal((await app.inject({method:'GET',url:'/api/activity?'+query,headers:{authorization:'Bearer '+key}})).statusCode,400,query);
  const res=await app.inject({method:'GET',url:'/api/activity?range=30&filter=send&offset=0',headers:{authorization:'Bearer '+key}});assert.equal(res.statusCode,200);assert.equal(res.json().events.length,0);
 }finally{await app.close();await db.close()}
});

test('activity links preserve search and date filters while resetting or advancing pages',()=>{
 assert.equal(activityHref({filter:'load',q:'Teklif & bütçe',range:'30',offset:10}),'/panel?view=activity&q=Teklif+%26+b%C3%BCt%C3%A7e&filter=load&range=30&offset=10');
 assert.equal(activityHref({filter:'all',range:'all',offset:0}),'/panel?view=activity');
});
