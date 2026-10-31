import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {openDatabase,migrate,type DB} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {TrackingService} from '../apps/api/service';
import {FileSharing} from '../apps/api/file-sharing';
import {buildServer} from '../apps/api/server';
import {FakeProvider} from '../packages/provider-adapters';
import {seal} from '../packages/runtime/vault';
const password='Synthetic-inspection-2026!',apiKey='synthetic-inspection-private-key-32';
async function setup(){
 let admin:DB|undefined,schema='';let db:DB;
 if(process.env.TEST_DATABASE_URL){admin=await openDatabase(process.env.TEST_DATABASE_URL);schema='inspection_'+randomUUID().replaceAll('-','');await admin.query('CREATE SCHEMA '+schema);const url=new URL(process.env.TEST_DATABASE_URL);url.searchParams.set('options','-c search_path='+schema);db=await openDatabase(url.toString())}else db=await openDatabase();await migrate(db);const key=randomBytes(32).toString('base64'),accounts=new Accounts(db,true),provider=new FakeProvider(),service=new TrackingService(db,provider,'https://inspection.example','sender@example.invalid',key),files=new FileSharing(db,key,'https://inspection.example',true),{app}=buildServer(db,provider,apiKey,'https://inspection.example',undefined,{production:true,encryptionKey:key,site:'https://inspection.example'});
 async function user(){const {token}=await accounts.register('Synthetic inspector',randomUUID()+'@example.invalid',password,{free:true});let user=(await accounts.current(token))!;await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[user.id]);user=(await accounts.current(token))!;await accounts.grant(user,'team');return {user:(await accounts.current(token))!,token}}
 const a=await user(),b=await user();
 const call=(id:string,token=a.token)=>app.inject({method:'GET',url:'/api/messages/'+id+'/inspection',headers:{authorization:'Bearer '+apiKey,'x-user-session':token}});
 const send=(extra:Record<string,unknown>={})=>service.send(a.user.workspace_id,randomUUID(),{to:'to@example.invalid',cc:['copy@example.invalid'],bcc:['hidden@example.invalid'],subject:'Synthetic inspection',text:'Synthetic body',tracking:true,...extra});
 async function file(user=a.user){const bytes=Buffer.from('%PDF-1.4\nSynthetic proposal\n%%EOF'),f=await files.begin(user,'proposal.pdf',bytes.length);await files.upload(user,f.id,0,bytes);await files.complete(user,f.id);const share=await files.createShare(user,f.id,{label:'Synthetic share'}),token=share.url.split('/').at(-1)!;await files.landing(token,'Mozilla/5.0');const opened=await files.open(token,'','Mozilla/5.0');await files.observe(token,opened.session,{kind:'preview',key:randomUUID()});await files.observe(token,opened.session,{kind:'page_view',page:1,key:randomUUID()});return {fileId:f.id,...share,token}}
 return {db,key,accounts,provider,service,files,a,b,call,send,file,close:async()=>{await app.close();await db.close();if(admin){await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.close()}}};
}
test('Inspection preserves encrypted Kime/CC/BCC metadata without enabling content archive and rejects other tenants',async()=>{const s=await setup();try{
 const sent=await s.send(),stored=(await s.db.query<{payload:string}>('SELECT payload FROM message_recipient_details WHERE message_id=$1',[sent.id])).rows[0];assert.ok(stored);assert.ok(!stored.payload.includes('hidden@example.invalid'));assert.equal((await s.db.query('SELECT message_id FROM message_content_archive')).rows.length,0);
 const result=await s.call(sent.id);assert.equal(result.statusCode,200);assert.deepEqual(result.json().recipients,{to:['to@example.invalid'],cc:['copy@example.invalid'],bcc:['hidden@example.invalid'],complete:true,source:'recorded'});assert.equal(result.json().message.recipient_count,3);assert.equal(result.json().message.state,'sent');assert.equal(result.json().events,undefined);assert.ok(!result.body.includes('Synthetic body'));
 assert.equal((await s.call(sent.id,s.b.token)).statusCode,404);assert.equal((await s.call(sent.id,'')).statusCode,401);assert.equal((await s.call('not-an-id')).statusCode,400);assert.equal(await s.service.inspection(s.b.user.workspace_id,sent.id),null);
 }finally{await s.close()}});
test('Short timeline is capped at ten groups while first and last signals remain accurate',async()=>{const s=await setup();try{
 const sent=await s.send();await s.db.query("UPDATE messages SET sent_at=now()-interval '2 days' WHERE id=$1",[sent.id]);
 const times=Array.from({length:24},(_,i)=>new Date(Date.now()-86400000+i*10*60000).toISOString());for(const at of times)await s.db.query("INSERT INTO raw_events(id,workspace_id,message_id,kind,occurred_at) VALUES($1,$2,$3,'image_fetch',$4)",[randomUUID(),s.a.user.workspace_id,sent.id,at]);
 const data=(await s.call(sent.id)).json();assert.equal(data.openings.length,10);assert.equal(data.message.activity_count,24);assert.equal(new Date(data.message.first_activity_at).toISOString(),times[0]);assert.equal(new Date(data.message.last_activity_at).toISOString(),times.at(-1));assert.equal(new Date(data.openings[0].first_at).toISOString(),times.at(-1));
 }finally{await s.close()}});
test('Linked file analytics respect ownership and current package, hiding advanced events after downgrade',async()=>{const s=await setup();try{
 const owned=await s.file(),foreign=await s.file(s.b.user),sent=await s.send({text:owned.url+'.\n'+foreign.url});
 assert.equal((await s.db.query('SELECT share_id FROM message_file_shares WHERE message_id=$1',[sent.id])).rows.length,1);
 let data=(await s.call(sent.id)).json();assert.ok(data.fileEvents.some((e:any)=>e.kind==='page_view'));assert.ok(data.fileEvents.every((e:any)=>e.label==='Synthetic share'));assert.equal(data.fileEvents.length,3);
 await s.accounts.grant(s.a.user,'individual');data=(await s.call(sent.id)).json();assert.ok(data.fileEvents.length>0);assert.ok(data.fileEvents.every((e:any)=>!['page_view','active_time'].includes(e.kind)));
 await s.db.query("UPDATE access_grants SET plan='free' WHERE workspace_id=$1",[s.a.user.workspace_id]);assert.deepEqual((await s.call(sent.id)).json().fileEvents,[]);
 }finally{await s.close()}});
test('Historical metadata is never invented, archived To is partial when CC/BCC are unknown',async()=>{const s=await setup();try{
 const sent=await s.send();await s.db.query('DELETE FROM message_recipient_details WHERE message_id=$1',[sent.id]);let result=(await s.call(sent.id)).json();assert.equal(result.recipients.source,'unavailable');assert.equal(result.recipients.complete,false);assert.deepEqual(result.recipients.bcc,[]);
 await s.db.query('INSERT INTO message_content_archive(message_id,workspace_id,payload) VALUES($1,$2,$3)',[sent.id,s.a.user.workspace_id,seal(JSON.stringify({workspaceId:s.a.user.workspace_id,messageId:sent.id,to:'to@example.invalid',text:'Synthetic'}),s.key)]);result=(await s.call(sent.id)).json();assert.equal(result.recipients.source,'archive');assert.equal(result.recipients.complete,false);assert.deepEqual(result.recipients.to,['to@example.invalid']);
 }finally{await s.close()}});
test('Expired and deleted messages cannot be inspected and inspection metadata cascades with deletion',async()=>{const s=await setup();try{
 const sent=await s.send();await s.db.query("UPDATE messages SET tracking_expires_at=now()-interval '1 second' WHERE id=$1",[sent.id]);assert.equal((await s.call(sent.id)).statusCode,404);await s.db.query('DELETE FROM messages WHERE id=$1',[sent.id]);assert.equal((await s.db.query('SELECT message_id FROM message_recipient_details WHERE message_id=$1',[sent.id])).rows.length,0);assert.equal((await s.call(sent.id)).statusCode,404);
 }finally{await s.close()}});
