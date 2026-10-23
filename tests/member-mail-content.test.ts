import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,generateKeyPairSync,createHash,sign} from 'node:crypto';
import {openDatabase,migrate,type DB} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {AdminService} from '../apps/api/admin';
import {AdminMemberInsights} from '../apps/api/admin-member-insights';
import {MemberMailContent} from '../apps/api/member-mail-content';
import {TrackingService} from '../apps/api/service';
import {BulkMail,type BulkGateway} from '../apps/api/bulk-mail';
import {GmailExtension,extensionCanonical} from '../apps/api/gmail-extension';
import type {GmailConnections} from '../apps/api/gmail';
import {FakeProvider} from '../packages/provider-adapters';
import {buildServer} from '../apps/api/server';
import {seal} from '../packages/runtime/vault';
const apiKey='synthetic-mail-content-private-api-key-2026',password='Synthetic-content-tests-2026!',vault=randomBytes(32).toString('base64');
const input={subject:'Content archive test',to:'recipient@example.invalid',text:'PRIVATE_ARCHIVE_BODY\n\n<script>alert("plain text")</script>\nİyi çalışmalar.',tracking:true};
async function setup(){
 const db=await openDatabase();await migrate(db);const accounts=new Accounts(db,true),provider=new FakeProvider();
 const owner=await accounts.register('Owner','owner@archive.invalid',password),member=await accounts.register('Member','member@archive.invalid',password),other=await accounts.register('Other','other@archive.invalid',password);
 await db.query('UPDATE users SET email_verified_at=now()');await db.query("UPDATE users SET role='owner' WHERE email='owner@archive.invalid'");
 const actor=(await accounts.current(owner.token))!,user=(await accounts.current(member.token))!,otherUser=(await accounts.current(other.token))!;await accounts.grant(user,'team');await accounts.grant(otherUser,'team');
 await db.query('INSERT INTO mail_connections(workspace_id,email,refresh_token,scopes) VALUES($1,$2,$3,$4)',[user.workspace_id,'sender@example.invalid',seal('synthetic-refresh',vault),'https://www.googleapis.com/auth/gmail.send']);
 const {app}=buildServer(db,provider,apiKey,'https://archive.invalid',undefined,{production:true,encryptionKey:vault});
 const call=(path:string,token=owner.token,body?:Record<string,unknown>)=>app.inject({method:body?'POST':'GET',url:'/api/admin'+path,headers:{authorization:'Bearer '+apiKey,...(token?{'x-user-session':token}:{})},...(body?{payload:body}:{})});
 const archive=new MemberMailContent(db,vault),sender=new TrackingService(db,provider,'https://archive.invalid','sender@example.invalid',vault);
 return {db,accounts,provider,owner,member,other,actor,user,otherUser,app,call,archive,sender,close:async()=>{await app.close();await db.close()}};
}
test('storage defaults off, applies only to future messages, encrypts contents and loads them solely through the owner endpoint',async()=>{
 const s=await setup();try{
  const before=await s.sender.send(s.user.workspace_id,'before_enabled',input);
  assert.equal((await s.db.query('SELECT * FROM member_mail_storage')).rows.length,0);assert.equal((await s.db.query('SELECT * FROM message_content_archive')).rows.length,0);
  assert.equal((await s.call('/members/'+s.user.id)).json().user.mail_content_storage_enabled,false);
  const setting='/members/'+s.user.id+'/mail-storage';assert.equal((await s.call(setting,s.owner.token,{enabled:true})).statusCode,200);
  const after=await s.sender.send(s.user.workspace_id,'after_enabled',input,undefined,undefined,'panel');
  const stored=(await s.db.query<{payload:string}>('SELECT payload FROM message_content_archive WHERE message_id=$1',[after.id])).rows[0].payload;assert.ok(!stored.includes('PRIVATE_ARCHIVE_BODY'));assert.ok(!stored.includes(input.to));assert.ok(!stored.includes('sender@example.invalid'));
  const detail=await s.call('/members/'+s.user.id);assert.equal(detail.json().user.mail_content_storage_enabled,true);assert.ok(!detail.body.includes('PRIVATE_ARCHIVE_BODY'));assert.ok(!detail.body.includes(stored));
  const rows=detail.json().messages.rows;assert.equal(rows.find((r:any)=>r.id===before.id).content_stored,false);assert.equal(rows.find((r:any)=>r.id===after.id).content_stored,true);
  const list=await s.app.inject({url:'/api/messages',headers:{authorization:'Bearer '+apiKey,'x-user-session':s.member.token}});assert.equal(list.statusCode,200);assert.ok(!list.body.includes('PRIVATE_ARCHIVE_BODY'));assert.ok(!list.body.includes(stored));
  const content=await s.call('/members/'+s.user.id+'/messages/'+after.id+'/content');assert.equal(content.statusCode,200,content.body);assert.equal(content.headers['cache-control'],'no-store');assert.equal(content.json().text,input.text);assert.equal(content.json().to,input.to);assert.equal(content.json().from,'sender@example.invalid');assert.ok(!content.body.includes(stored));
  assert.equal((await s.call('/members/'+s.user.id+'/messages/'+before.id+'/content')).json().code,'MAIL_CONTENT_NOT_STORED');
  await s.archive.configure(s.actor,s.user.id,false);await s.sender.send(s.user.workspace_id,'after_disabled',input);assert.equal((await s.db.query('SELECT * FROM message_content_archive')).rows.length,1);assert.equal((await s.archive.read(s.actor,s.user.id,after.id)).text,input.text);
  await s.archive.configure(s.actor,s.user.id,true);await s.sender.send(s.user.workspace_id,'before_enabled',input);assert.equal((await s.db.query('SELECT * FROM message_content_archive')).rows.length,1);assert.equal(s.provider.submissions.length,3);
  const fresh=await s.accounts.register('Fresh member','fresh@archive.invalid',password);const account=(await s.accounts.current(fresh.token))!;assert.equal((await s.call('/members/'+account.id)).json().user.mail_content_storage_enabled,false);
  const audit=(await s.db.query<{action:string;target_id:string}>('SELECT action,target_id FROM admin_audit')).rows;assert.ok(audit.some(r=>r.action==='mail_content_storage_enabled'));assert.ok(audit.some(r=>r.action==='mail_content_storage_disabled'));assert.ok(audit.some(r=>r.action==='mail_content_viewed'&&r.target_id===after.id));assert.ok(!JSON.stringify(audit).includes(input.text));
 }finally{await s.close()}
});
test('anonymous, ordinary, unverified and stale owners cannot configure/read content; user/message ownership is enforced',async()=>{
 const s=await setup();try{
  const path='/members/'+s.user.id+'/mail-storage';for(const [token,status] of [['',401],[s.member.token,403],[s.other.token,403]] as const)assert.equal((await s.call(path,token,{enabled:true})).statusCode,status);
  assert.equal((await s.call(path,s.owner.token,{enabled:'true'})).statusCode,400);assert.equal((await s.call(path,s.owner.token,{enabled:true,workspace:s.otherUser.workspace_id})).statusCode,400);
  await s.archive.configure(s.actor,s.user.id,true);const mail=await s.sender.send(s.user.workspace_id,'permission_fixture',input);const contentPath='/members/'+s.user.id+'/messages/'+mail.id+'/content';
  for(const [token,status] of [['',401],[s.member.token,403],[s.other.token,403]] as const)assert.equal((await s.call(contentPath,token)).statusCode,status);
  assert.equal((await s.call('/members/'+s.otherUser.id+'/messages/'+mail.id+'/content')).statusCode,404);
  await s.db.query('UPDATE users SET email_verified_at=NULL WHERE id=$1',[s.actor.id]);assert.equal((await s.call(path,s.owner.token,{enabled:false})).statusCode,403);assert.equal((await s.call(contentPath)).statusCode,403);await assert.rejects(s.archive.read(s.actor,s.user.id,mail.id),/EMAIL_NOT_VERIFIED/);
  await s.db.query("UPDATE users SET email_verified_at=now(),role='member' WHERE id=$1",[s.actor.id]);await assert.rejects(s.archive.configure(s.actor,s.user.id,false),/FORBIDDEN/);await assert.rejects(s.archive.read(s.actor,s.user.id,mail.id),/FORBIDDEN/);
 }finally{await s.close()}
});
test('missing keys fail closed before sending; corrupt or swapped ciphertext is never exposed',async()=>{
 const s=await setup();try{
  await assert.rejects(new MemberMailContent(s.db).configure(s.actor,s.user.id,true),/MAIL_CONTENT_UNAVAILABLE/);assert.equal((await s.db.query('SELECT * FROM member_mail_storage')).rows.length,0);
  await s.archive.configure(s.actor,s.user.id,true);const withoutKey=new TrackingService(s.db,s.provider,'https://archive.invalid');await assert.rejects(withoutKey.send(s.user.workspace_id,'missing_key_fixture',input),/MAIL_CONTENT_UNAVAILABLE/);assert.equal(s.provider.submissions.length,0);assert.equal((await s.db.query('SELECT * FROM messages')).rows.length,0);assert.equal((await s.db.query('SELECT used FROM entitlements WHERE workspace_id=$1',[s.user.workspace_id])).rows[0].used,0);
  const a=await s.sender.send(s.user.workspace_id,'ciphertext_fixture_a',input),b=await s.sender.send(s.user.workspace_id,'ciphertext_fixture_b',{...input,text:'SECOND_PRIVATE_BODY'});
  await assert.rejects(new MemberMailContent(s.db,randomBytes(32).toString('base64')).read(s.actor,s.user.id,a.id),/MAIL_CONTENT_UNAVAILABLE/);
  const payload=(await s.db.query<{payload:string}>('SELECT payload FROM message_content_archive WHERE message_id=$1',[b.id])).rows[0].payload;await s.db.query('UPDATE message_content_archive SET payload=$2 WHERE message_id=$1',[a.id,payload]);assert.equal((await s.call('/members/'+s.user.id+'/messages/'+a.id+'/content')).json().code,'MAIL_CONTENT_UNAVAILABLE');
  assert.equal((await s.db.query("SELECT * FROM admin_audit WHERE action='mail_content_viewed'")).rows.length,0);
 }finally{await s.close()}
});
test('storage changes are atomic and capture follows the send start boundary without historical backfill',async()=>{
 const s=await setup();try{
  const failing:DB={...s.db,transaction:fn=>s.db.transaction(tx=>fn({...tx,query:async(sql,params)=>{if(sql.includes('INSERT INTO admin_audit'))throw Error('AUDIT_FAILED');return tx.query(sql,params)}}))};await assert.rejects(new MemberMailContent(failing,vault).configure(s.actor,s.user.id,true),/AUDIT_FAILED/);assert.equal((await s.db.query('SELECT * FROM member_mail_storage')).rows.length,0);
  let release!:()=>void,entered!:()=>void;const hold=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);const provider={name:'fake-delayed',send:async()=>{entered();await hold;return {providerMessageId:'fake-id',threadId:'fake-thread'}}};
  const sending=new TrackingService(s.db,provider,'https://archive.invalid','sender@example.invalid',vault).send(s.user.workspace_id,'started_before_toggle',input);await started;await s.archive.configure(s.actor,s.user.id,true);release();await sending;assert.equal((await s.db.query('SELECT * FROM message_content_archive')).rows.length,0);
  const mail=await s.sender.send(s.user.workspace_id,'started_after_toggle',input);assert.equal((await s.archive.read(s.actor,s.user.id,mail.id)).text,input.text);
  await new AdminService(s.db,s.accounts).deleteMember(s.actor,s.user.id,s.user.email);assert.equal((await s.db.query('SELECT * FROM message_content_archive')).rows.length,0);assert.equal((await s.db.query('SELECT * FROM member_mail_storage')).rows.length,0);
 }finally{await s.close()}
});
test('the Gmail panel send route forwards the archive key and preserves the exact submitted text',async()=>{
 const s=await setup(),originalFetch=globalThis.fetch,oldId=process.env.GOOGLE_CLIENT_ID,oldSecret=process.env.GOOGLE_CLIENT_SECRET;let deliveries=0;
 try{
  process.env.GOOGLE_CLIENT_ID='synthetic-client';process.env.GOOGLE_CLIENT_SECRET='synthetic-secret';
  globalThis.fetch=async(url)=>{const target=String(url);if(target==='https://oauth2.googleapis.com/token')return Response.json({access_token:'synthetic-access',expires_in:3600});if(target==='https://gmail.googleapis.com/gmail/v1/users/me/messages/send'){deliveries++;return Response.json({id:'synthetic-gmail-id',threadId:'synthetic-thread'})}throw Error('UNEXPECTED_NETWORK')};
  await s.archive.configure(s.actor,s.user.id,true);const response=await s.app.inject({method:'POST',url:'/api/messages/send',headers:{authorization:'Bearer '+apiKey,'x-user-session':s.member.token,'idempotency-key':'panel_archive_integration_2026'},payload:input});assert.equal(response.statusCode,200,response.body);assert.equal(deliveries,1);assert.equal((await s.archive.read(s.actor,s.user.id,response.json().id)).text,input.text);
 }finally{globalThis.fetch=originalFetch;if(oldId===undefined)delete process.env.GOOGLE_CLIENT_ID;else process.env.GOOGLE_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.GOOGLE_CLIENT_SECRET;else process.env.GOOGLE_CLIENT_SECRET=oldSecret;await s.close()}
});
test('signed Gmail extension delivery records content only for its enabled user',async()=>{
 const s=await setup();try{
  const gmail={provider:async()=>({provider:s.provider,from:'sender@example.invalid'})};const extension=new GmailExtension(s.db,gmail as unknown as GmailConnections,'https://archive.invalid',vault);
  const keys=generateKeyPairSync('ec',{namedCurve:'P-256'}),secret=randomBytes(32).toString('base64url');const pairing=await extension.begin({challenge:createHash('sha256').update(secret).digest('hex'),publicKey:keys.publicKey.export({format:'jwk'})});await extension.approve(s.user,s.member.token,pairing.pairId);const device=await extension.exchange({pairId:pairing.pairId,secret}) as any;
  const send=async()=>{const envelope={deviceId:device.deviceId,token:device.token,nonce:randomUUID(),issuedAt:Date.now(),operation:'send' as const,payload:{...input,from:'sender@example.invalid',idempotencyKey:randomUUID()}};return extension.request({...envelope,signature:sign('sha256',Buffer.from(extensionCanonical(envelope)),{key:keys.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')}) as Promise<any>};
  await send();assert.equal((await s.db.query('SELECT * FROM message_content_archive')).rows.length,0);await s.archive.configure(s.actor,s.user.id,true);const result=await send();assert.equal((await s.archive.read(s.actor,s.user.id,result.id)).text,input.text);assert.equal((await s.db.query('SELECT send_channel FROM messages WHERE id=$1',[result.id])).rows[0].send_channel,'extension');
 }finally{await s.close()}
});
test('bulk delivery archives personalized per-recipient content, not the unrendered campaign template',async()=>{
 const s=await setup();try{
  const gateway:BulkGateway={status:async()=>({configured:true,connected:true,email:'sender@example.invalid'}),provider:async()=>({provider:s.provider,from:'sender@example.invalid'})};const bulk=new BulkMail(s.db,gateway,vault,'https://archive.invalid',true);await s.archive.configure(s.actor,s.user.id,true);
  const preview=await bulk.preview(s.user,{name:'Archive bulk test',subject:'Merhaba {{ad}}',text:'Sayın {{ad}},\nBu size özel bir mesajdır.',csv:'email,ad\ndeniz@example.invalid,Deniz\nselin@example.invalid,Selin',tracking:true,requestId:randomUUID()});await bulk.confirm(s.user,preview.id!);
  for(let i=0;i<2;i++){await s.db.query("UPDATE entitlements SET bulk_next_at=now()-interval '1 second' WHERE workspace_id=$1",[s.user.workspace_id]);assert.equal(await bulk.processOne(),true)}
  const messages=(await new AdminMemberInsights(s.db).messages(s.user.id)).rows as any[];assert.equal(messages.length,2);for(const row of messages){const content=await s.archive.read(s.actor,s.user.id,row.id);assert.ok(row.content_stored);assert.equal(row.send_channel,'bulk');assert.ok(!content.text.includes('{{ad}}'));assert.equal(content.text,content.to==='deniz@example.invalid'?'Sayın Deniz,\nBu size özel bir mesajdır.':'Sayın Selin,\nBu size özel bir mesajdır.')}
 }finally{await s.close()}
});
