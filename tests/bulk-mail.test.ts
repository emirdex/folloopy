import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {openDatabase,migrate,type DB} from '../packages/database';
import {Accounts,type Account} from '../apps/api/accounts';
import {BulkMail,type BulkGateway} from '../apps/api/bulk-mail';
import {TrackingService} from '../apps/api/service';
import {FakeProvider,type MailProvider,type Submission} from '../packages/provider-adapters';
import {buildServer} from '../apps/api/server';
import {seal,unseal} from '../packages/runtime/vault';
import {AccountSecurity} from '../apps/api/account-security';
import {AccountDetails} from '../apps/api/account-details';
import {parseBulkCsv,validateBulkInput,renderBulkText,csvCell,decodeBulkCsv,BULK_MAX_RECIPIENTS,type BulkInput} from '../packages/domain/bulk-mail';
const key=randomBytes(32).toString('base64'),apiKey='bulk-mail-private-api-key-32-characters';
const input=(csv='email,ad,soyad,sirket\ndeniz@example.invalid,Deniz,Aras,Arc\nselin@example.invalid,Selin,Kaya,Byte'):BulkInput=>({name:'Görüşme daveti',subject:'Merhaba {{ad}}',text:'Merhaba {{ad}} {{soyad}},\n{{sirket}} için görüşelim.',tracking:true,csv,requestId:randomUUID()});
async function setup(){const db=await openDatabase();await migrate(db);await migrate(db);const accounts=new Accounts(db,true);const{token}=await accounts.register('Bulk Member','bulk-owner@example.invalid','Synthetic-bulk-password-2026!');await db.query('UPDATE users SET email_verified_at=now()');const user=(await accounts.current(token))!;await accounts.grant(user,'team');await db.query('INSERT INTO mail_connections(workspace_id,email,refresh_token,scopes) VALUES($1,$2,$3,$4)',[user.workspace_id,'sender@example.invalid',seal('not-a-real-token',key),'send']);let sender:MailProvider=new FakeProvider();const gateway:BulkGateway={status:async(workspace,tx=db)=>{const row=(await tx.query<{email:string}>('SELECT email FROM mail_connections WHERE workspace_id=$1',[workspace])).rows[0];return {configured:true,connected:!!row,email:row?.email||null}},provider:async()=>({provider:sender,from:'sender@example.invalid'})};const bulk=new BulkMail(db,gateway,key,'https://tracking.example',true);const advance=()=>db.query("UPDATE entitlements SET bulk_next_at=now()-interval '1 second'");const used=async()=>Number((await db.query<{used:number}>('SELECT used FROM entitlements WHERE workspace_id=$1',[user.workspace_id])).rows[0].used);return {db,accounts,user,token,gateway,bulk,advance,used,get sender(){return sender},setSender:(value:MailProvider)=>{sender=value}}}
async function close(s:Awaited<ReturnType<typeof setup>>){await s.db.close()}
const rejects=(fn:()=>Promise<unknown>,code:string)=>assert.rejects(fn,{message:code});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done});return {promise,resolve}}
test('CSV handles BOM, Excel separators, quoting, aliases, invalid rows and deduplication',()=>{
 const csv='\uFEFFE-Posta;Ad;Soyad;Şirket\r\nDENIZ@example.invalid;Deniz;Aras;"Arc; Byte"\r\ndeniz@example.invalid;Tekrar;A;B\r\nselin@example.invalid;Selin;Kaya;"A ""B"""\r\nbad-address;A;B;C';const report=parseBulkCsv(csv);assert.equal(report.recipients.length,2);assert.equal(report.duplicates,1);assert.equal(report.rows,4);assert.equal(report.issues[0].row,5);assert.equal(report.recipients[0].sirket,'Arc; Byte');assert.equal(report.recipients[1].sirket,'A "B"');
 for(const csv of ['email,email\na@b.com,b@c.com','ad,sirket\nDeniz,Arc','email,ad\n"unclosed','email,ad\na@-bad.com,A','email,ad\na..b@example.com,A'])assert.ok(parseBulkCsv(csv).issues.length);
 assert.ok(parseBulkCsv('email\n'+Array.from({length:BULK_MAX_RECIPIENTS+1},(_,i)=>`a${i}@example.com`).join('\n')).issues.length);
 assert.equal(renderBulkText('Merhaba {{ad}}',report.recipients[0]),'Merhaba Deniz');assert.throws(()=>renderBulkText('{{bilinmeyen}}',report.recipients[0]),{message:'BULK_INVALID_TEMPLATE'});assert.equal(csvCell('=SUM(1,2)'),`"'=SUM(1,2)"`);
 const utf16=new Uint8Array([255,254,...Buffer.from('email,ad\r\na@example.com,Deniz','utf16le')]);assert.match(decodeBulkCsv(utf16),/email,ad/);assert.throws(()=>validateBulkInput({...input(),subject:'x\r\nInjected'}));
});
test('Preview is encrypted and side-effect free; confirmation is idempotent and reserves shared quota',async()=>{const s=await setup();try{
 const request=input(),preview=await s.bulk.preview(s.user,request),again=await s.bulk.preview(s.user,request);assert.equal(preview.id,again.id);assert.equal(preview.samples?.[0].subject,'Merhaba Deniz');assert.equal(await s.used(),0);assert.equal((await s.db.query('SELECT * FROM messages')).rows.length,0);assert.equal((s.sender as FakeProvider).submissions.length,0);
 await rejects(()=>s.bulk.preview(s.user,{...request,text:'Changed'}),'IDEMPOTENCY_CONFLICT');
 const payloads=(await s.db.query<{payload:string}>('SELECT payload FROM bulk_recipients')).rows;assert.ok(payloads.every(row=>!row.payload.includes('example.invalid')));assert.ok(!(await s.db.query<{payload:string}>('SELECT payload FROM bulk_campaigns')).rows[0].payload.includes('Merhaba'));
 const confirmations=await Promise.all([s.bulk.confirm(s.user,preview.id!),s.bulk.confirm(s.user,preview.id!)]);assert.equal(confirmations.filter(result=>result.replay).length,1);assert.equal(await s.used(),2);
 const single=new TrackingService(s.db,s.sender,'https://tracking.example','sender@example.invalid');await s.db.query('UPDATE entitlements SET message_limit=2');await rejects(()=>single.send(s.user.workspace_id,'normal_send_test_key',{subject:'Normal',text:'Hello',to:'other@example.invalid',tracking:true}),'LIMIT_REACHED');
 await Promise.all([s.bulk.processOne(),s.bulk.processOne()]);assert.equal((s.sender as FakeProvider).submissions.length,1);await s.advance();await s.bulk.processOne();assert.equal((s.sender as FakeProvider).submissions.length,2);assert.equal(await s.used(),2);
 const detail=await s.bulk.detail(s.user,preview.id!);assert.equal(detail.status,'completed');assert.equal(detail.counts.sent,2);assert.ok((await s.db.query<any>('SELECT send_channel FROM messages')).rows.every(row=>row.send_channel==='bulk'));assert.equal(new Set(detail.recipients.map(r=>r.message_id)).size,2);assert.equal((await s.db.query('SELECT * FROM tracking_tokens')).rows.length,2);
 assert.deepEqual((s.sender as FakeProvider).submissions.map(item=>item.raw.match(/^To: (.+)$/m)?.[1].trim()),['deniz@example.invalid','selin@example.invalid']);assert.equal(await s.bulk.processOne(),false);
 }finally{await close(s)}});
test('Invalid imports, exhausted quota and overlapping campaigns cannot enter the queue',async()=>{const s=await setup();try{
 const invalid=await s.bulk.preview(s.user,input('email\nnot-an-email'));assert.ok(invalid.report.issues.length);assert.equal(invalid.id,undefined);assert.equal((await s.db.query('SELECT * FROM bulk_campaigns')).rows.length,0);
 await s.db.query('UPDATE entitlements SET message_limit=1');await rejects(()=>s.bulk.preview(s.user,input()),'BULK_QUOTA_REQUIRED');await s.db.query('UPDATE entitlements SET message_limit=500');
 const first=await s.bulk.preview(s.user,input()),second=await s.bulk.preview(s.user,input());await s.bulk.confirm(s.user,first.id!);await rejects(()=>s.bulk.confirm(s.user,second.id!),'BULK_ACTIVE_CAMPAIGN');await s.bulk.control(s.user,first.id!,'cancel');assert.equal(await s.used(),0);await s.bulk.confirm(s.user,second.id!);assert.equal(await s.used(),2);
 }finally{await close(s)}});
test('Essential and other accounts cannot bypass bulk permissions, including plan changes while queued',async()=>{const s=await setup();const{app}=buildServer(s.db,new FakeProvider(),apiKey,'https://tracking.example',undefined,{production:true,encryptionKey:key});try{
 const preview=await s.bulk.preview(s.user,input());await s.bulk.confirm(s.user,preview.id!);await s.accounts.grant(s.user,'individual');await s.bulk.processOne();assert.equal((s.sender as FakeProvider).submissions.length,0);assert.equal((await s.bulk.detail(s.user,preview.id!)).status,'paused');
 await rejects(()=>s.bulk.preview(s.user,input()),'BULK_PLAN_REQUIRED');await rejects(()=>s.bulk.control(s.user,preview.id!,'resume'),'BULK_PLAN_REQUIRED');
 const call=(url:string,payload?:unknown,session=s.token)=>app.inject({method:payload===undefined?'GET':'POST',url,headers:{authorization:'Bearer '+apiKey,'x-user-session':session},...(payload===undefined?{}:{payload:payload as any})});assert.equal((await call('/api/bulk/preview',input())).statusCode,403);assert.equal((await call('/api/bulk/'+preview.id+'/confirm',{})).statusCode,403);
 const{token}=await s.accounts.register('Other Member','other-bulk@example.invalid','Synthetic-other-password-2026!');await s.db.query("UPDATE users SET email_verified_at=now() WHERE email='other-bulk@example.invalid'");const other=(await s.accounts.current(token))!;await s.accounts.grant(other,'team');for(const suffix of ['', '/report'])assert.equal((await call('/api/bulk/'+preview.id+suffix,undefined,token)).statusCode,404);assert.equal((await call('/api/bulk/'+preview.id+'/control',{action:'cancel'},token)).statusCode,404);assert.equal((await call('/api/bulk/'+preview.id+'/confirm',{},token)).statusCode,404);
 await s.bulk.control(s.user,preview.id!,'cancel');assert.equal(await s.used(),0);
 }finally{await app.close();await close(s)}});
test('Unknown provider outcome pauses remaining recipients and is never automatically retried',async()=>{const s=await setup();try{
 const uncertain=new FakeProvider('timeout');s.setSender(uncertain);const preview=await s.bulk.preview(s.user,input());await s.bulk.confirm(s.user,preview.id!);await s.bulk.processOne();let detail=await s.bulk.detail(s.user,preview.id!);assert.equal(detail.status,'paused');assert.equal(detail.counts.unknown,1);assert.equal(detail.counts.queued,1);await s.advance();assert.equal(await s.bulk.processOne(),false);assert.equal(uncertain.submissions.length,1);
 const success=new FakeProvider();s.setSender(success);await s.bulk.control(s.user,preview.id!,'resume');await s.bulk.processOne();detail=await s.bulk.detail(s.user,preview.id!);assert.equal(detail.counts.unknown,1);assert.equal(detail.counts.sent,1);assert.equal(success.submissions.length,1);assert.match(success.submissions[0].raw,/To: selin@example.invalid/);assert.equal(await s.used(),2);
 }finally{await close(s)}});
test('Cancellation refunds queued reservations without retracting or duplicating an in-flight send',async()=>{const s=await setup();try{
 const started=deferred<void>(),release=deferred<void>();let calls=0;const sender:MailProvider={name:'fake',send:async()=>{calls++;started.resolve();await release.promise;return {providerMessageId:randomUUID(),threadId:randomUUID()}}};s.setSender(sender);const preview=await s.bulk.preview(s.user,input());await s.bulk.confirm(s.user,preview.id!);const running=s.bulk.processOne();await started.promise;await s.bulk.control(s.user,preview.id!,'cancel');assert.equal(await s.used(),1);release.resolve();await running;const detail=await s.bulk.detail(s.user,preview.id!);assert.equal(detail.status,'cancelled');assert.equal(detail.counts.cancelled,1);assert.equal(detail.counts.sent,1);assert.equal(calls,1);assert.equal(await s.bulk.processOne(),false);
 }finally{await close(s)}});
test('A recovered pre-send lease cannot send late, and its unused reservation is refunded',async()=>{const s=await setup();try{
 const entered=deferred<void>(),release=deferred<void>();const original=s.gateway.provider;s.gateway.provider=async workspace=>{entered.resolve();await release.promise;return original(workspace)};
 const preview=await s.bulk.preview(s.user,input());await s.bulk.confirm(s.user,preview.id!);const running=s.bulk.processOne();await entered.promise;await s.db.query("UPDATE bulk_recipients SET started_at=now()-interval '3 minutes' WHERE state='sending'");assert.equal(await s.bulk.recoverOne(),true);release.resolve();await running;
 const detail=await s.bulk.detail(s.user,preview.id!);assert.equal(detail.counts.failed,1);assert.equal(detail.counts.queued,1);assert.equal(detail.status,'paused');assert.equal(await s.used(),1);assert.equal((s.sender as FakeProvider).submissions.length,0);
 }finally{await close(s)}});
test('Crash recovery after delivery began keeps an uncertain result and never requeues the message',async()=>{const s=await setup();try{
 const started=deferred<void>(),release=deferred<void>();let calls=0;s.setSender({name:'fake',send:async()=>{calls++;started.resolve();await release.promise;return {providerMessageId:randomUUID(),threadId:randomUUID()}}});const preview=await s.bulk.preview(s.user,input());await s.bulk.confirm(s.user,preview.id!);const running=s.bulk.processOne();await started.promise;await s.db.query("UPDATE bulk_recipients SET started_at=now()-interval '3 minutes' WHERE state='sending'");await s.bulk.recoverOne();release.resolve();await running;const detail=await s.bulk.detail(s.user,preview.id!);assert.equal(detail.counts.unknown,1);assert.equal(detail.counts.queued,1);assert.equal(calls,1);assert.equal(await s.used(),2);assert.equal((await s.db.query<{state:string}>('SELECT state FROM messages')).rows[0].state,'unknown');
 }finally{await close(s)}});
test('Disconnect and sender changes pause the queue; report export neutralizes spreadsheet formulas',async()=>{const s=await setup();try{
 const preview=await s.bulk.preview(s.user,input('email,ad\na@example.invalid,=SUM(1)'));await s.bulk.confirm(s.user,preview.id!);await s.db.query('DELETE FROM mail_connections');await s.bulk.processOne();assert.equal((await s.bulk.detail(s.user,preview.id!)).status,'paused');assert.equal((s.sender as FakeProvider).submissions.length,0);await rejects(()=>s.bulk.control(s.user,preview.id!,'resume'),'BULK_SENDER_CHANGED');assert.match(await s.bulk.report(s.user,preview.id!),/'=SUM/);await s.bulk.control(s.user,preview.id!,'cancel');assert.equal(await s.used(),0);
 }finally{await close(s)}});
test('Expired previews, unverified accounts and missing sessions cannot start a bulk send',async()=>{const s=await setup();const{app}=buildServer(s.db,new FakeProvider(),apiKey,'https://tracking.example',undefined,{production:true,encryptionKey:key});try{
 const preview=await s.bulk.preview(s.user,input());await s.db.query("UPDATE bulk_campaigns SET expires_at=now()-interval '1 second'");await rejects(()=>s.bulk.confirm(s.user,preview.id!),'BULK_PREVIEW_EXPIRED');assert.equal(await s.used(),0);
 const headers={authorization:'Bearer '+apiKey};assert.equal((await app.inject({method:'POST',url:'/api/bulk/preview',headers,payload:input()})).statusCode,401);
 await s.db.query('UPDATE users SET email_verified_at=NULL WHERE id=$1',[s.user.id]);await rejects(()=>s.bulk.preview(s.user,input()),'EMAIL_NOT_VERIFIED');assert.equal((await app.inject({method:'POST',url:'/api/bulk/preview',headers:{...headers,'x-user-session':s.token},payload:input()})).statusCode,403);
 }finally{await app.close();await close(s)}});
test('A 500-recipient import reserves exactly the available quota and tracking can remain disabled',async()=>{const s=await setup();try{
 const csv='email,ad\n'+Array.from({length:500},(_,i)=>`contact${i}@example.invalid,Alıcı ${i}`).join('\n');const preview=await s.bulk.preview(s.user,{...input(csv),tracking:false});assert.equal(preview.report.recipients.length,500);await s.bulk.confirm(s.user,preview.id!);assert.equal(await s.used(),500);await s.bulk.processOne();assert.equal((s.sender as FakeProvider).submissions.length,1);assert.equal((await s.db.query('SELECT * FROM tracking_tokens')).rows.length,0);assert.equal((await s.bulk.detail(s.user,preview.id!)).recipients.length,50);assert.equal((await s.bulk.detail(s.user,preview.id!,450)).hasMore,false);await s.bulk.control(s.user,preview.id!,'cancel');assert.equal(await s.used(),1);
 }finally{await close(s)}});

test('Password recovery pauses a queued campaign, invalidates sessions and never sends pending mail',async()=>{const s=await setup();try{
 const preview=await s.bulk.preview(s.user,input());await s.bulk.confirm(s.user,preview.id!);const security=new AccountSecurity(s.db,'https://panel.example',key);await security.issue(s.user.id,'reset');const row=(await s.db.query<{payload:string}>('SELECT payload FROM mail_outbox ORDER BY created_at DESC LIMIT 1')).rows[0];const token=JSON.parse(unseal(row.payload,key)).text.match(/#token=([\w-]{43})/)[1];await security.consume(token,'reset','Recovered-synthetic-password-2026!');assert.equal(await s.accounts.current(s.token),null);assert.equal((await s.bulk.detail(s.user,preview.id!)).reason,'ACCOUNT_SECURITY_CHANGED');assert.equal(await s.bulk.processOne(),false);assert.equal((s.sender as FakeProvider).submissions.length,0);assert.equal(await s.used(),2);
 }finally{await close(s)}});
test('Confirmed email changes pause queued campaigns while cancelling an unconfirmed change leaves them intact',async()=>{const s=await setup();try{
 const preview=await s.bulk.preview(s.user,input());await s.bulk.confirm(s.user,preview.id!);const details=new AccountDetails(s.db,'https://panel.example',key);await details.requestEmail(s.user,'new-owner@example.invalid');const tokens=(await s.db.query<{payload:string}>('SELECT payload FROM mail_outbox ORDER BY created_at,id')).rows.map(row=>JSON.parse(unseal(row.payload,key)).text.match(/#token=([\w-]{43})/)[1]);assert.equal((await details.confirmEmail(tokens[0])).completed,false);assert.equal((await s.bulk.detail(s.user,preview.id!)).status,'queued');await details.confirmEmail(tokens[1]);assert.equal((await s.bulk.detail(s.user,preview.id!)).status,'paused');assert.equal(await s.bulk.processOne(),false);assert.equal((s.sender as FakeProvider).submissions.length,0);assert.equal(await s.accounts.current(s.token),null);
 }finally{await close(s)}});

test('Company subjects and explicit salutations survive preview, encrypted storage, delivery and report',async()=>{
 const s=await setup();try{
  const request={...input('email,ad,soyad,sirket,hitap\ndeniz@example.invalid,Deniz,Yilmaz,Arcbyte,Hanım\nali@example.invalid,Ali,Kaya,Dex,Bey'),subject:'{{sirket}} için teklif',text:'Merhaba {{ad}} {{hitap}}, {{sirket}} için görüşelim.'};
  const preview=await s.bulk.preview(s.user,request);
  assert.equal(preview.samples?.[0].subject,'Arcbyte için teklif');assert.equal(preview.samples?.[0].text,'Merhaba Deniz Hanım, Arcbyte için görüşelim.');assert.equal(preview.samples?.[1].text,'Merhaba Ali Bey, Dex için görüşelim.');
  await s.bulk.confirm(s.user,preview.id!);await s.bulk.processOne();await s.advance();await s.bulk.processOne();
  assert.equal((s.sender as FakeProvider).submissions.length,2);
  for(const submission of (s.sender as FakeProvider).submissions){assert.doesNotMatch(submission.raw,/\{\{/)}
  const detail=await s.bulk.detail(s.user,preview.id!);assert.equal(detail.recipients[0].hitap,'Hanım');assert.equal(detail.recipients[1].hitap,'Bey');assert.match(await s.bulk.report(s.user,preview.id!),/Hanım/);
 }finally{await close(s)}
});
test('Salutations support Turkish headers and reject missing values, newlines, oversized fields and unknown variables',()=>{
 const report=parseBulkCsv('e-posta;ad;firma;hitap\na@example.invalid;A;Arc;Bey');assert.equal(report.recipients[0].hitap,'Bey');
 assert.throws(()=>validateBulkInput({...input('email,ad\na@example.invalid,A'),text:'Merhaba {{ad}} {{hitap}}'}),{message:'BULK_INVALID_TEMPLATE'});
 assert.throws(()=>renderBulkText('{{untrusted}}',report.recipients[0]),{message:'BULK_INVALID_TEMPLATE'});
 assert.ok(parseBulkCsv('email,hitap\na@example.invalid,"Bey\nInjected"').issues.length);
 assert.ok(parseBulkCsv('email,hitap\na@example.invalid,'+'a'.repeat(101)).issues.length);
 assert.equal(renderBulkText('{{ad}}', {email:'old@example.invalid',ad:'Eski',soyad:'',sirket:''}),'Eski');
});
