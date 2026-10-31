import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {openDatabase,migrate,type DB} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {AccountSecurity} from '../apps/api/account-security';
import {AccountDetails} from '../apps/api/account-details';
import {MemberTools} from '../apps/api/member-tools';
import type {BulkGateway} from '../apps/api/bulk-mail';
import {FakeProvider} from '../packages/provider-adapters';
import {unseal} from '../packages/runtime/vault';
const password='Synthetic-schedule-security-2026!',message={to:'recipient@example.invalid',subject:'Synthetic scheduled message',text:'No real email delivery.',tracking:true};
async function setup(){
 let admin:DB|undefined,schema='';let db:DB;
 if(process.env.TEST_DATABASE_URL){admin=await openDatabase(process.env.TEST_DATABASE_URL);schema='schedule_security_'+randomUUID().replaceAll('-','');await admin.query('CREATE SCHEMA '+schema);const url=new URL(process.env.TEST_DATABASE_URL);url.searchParams.set('options','-c search_path='+schema);db=await openDatabase(url.toString())}else db=await openDatabase();await migrate(db);
 const key=randomBytes(32).toString('base64'),accounts=new Accounts(db,true),security=new AccountSecurity(db,'https://synthetic.example',key),details=new AccountDetails(db,'https://synthetic.example',key),provider=new FakeProvider();
 const {token}=await accounts.register('Synthetic schedule owner',randomUUID()+'@example.invalid',password,{free:true});let user=(await accounts.current(token))!;await db.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[user.id]);user=(await accounts.current(token))!;await accounts.grant(user,'team');user=(await accounts.current(token))!;
 const gateway:BulkGateway={status:async()=>({configured:true,connected:true,email:'sender@example.invalid'}),provider:async()=>({provider,from:'sender@example.invalid'})},tools=new MemberTools(db,gateway,key,'https://synthetic.example',true);
 const schedule=()=>tools.schedule(user,message,new Date(Date.now()+86400000).toISOString(),randomUUID());
 async function reset(){await security.issue(user.id,'reset');const out=(await db.query<{payload:string}>("SELECT payload FROM mail_outbox WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1",[user.id])).rows[0];const resetToken=JSON.parse(unseal(out.payload,key)).text.match(/#token=([\w-]{43})/)[1];await security.consume(resetToken,'reset','Replacement-schedule-security-2026!')}
 async function row(id:string){return (await db.query<{status:string;reason:string|null}>('SELECT status,reason FROM scheduled_mail WHERE id=$1',[id])).rows[0]}
 return {db,key,accounts,security,details,provider,user,token,gateway,tools,schedule,reset,row,close:async()=>{await db.close();if(admin){await admin.query('DROP SCHEMA '+schema+' CASCADE');await admin.close()}}};
}
test('Password reset pauses queued scheduled mail and requires an explicit resume',async()=>{const s=await setup();try{
 const scheduled=await s.schedule();await s.reset();assert.equal(await s.accounts.current(s.token),null);assert.deepEqual(await s.row(scheduled.id),{status:'paused',reason:'ACCOUNT_SECURITY_CHANGED'});await s.db.query("UPDATE scheduled_mail SET due_at=now()-interval '1 minute' WHERE id=$1",[scheduled.id]);assert.equal(await s.tools.processSchedule(),false);assert.equal(s.provider.submissions.length,0);
 const login=await s.accounts.login(s.user.email,'Replacement-schedule-security-2026!'),fresh=(await s.accounts.current(login.token))!;await s.tools.resumeSchedule(fresh,scheduled.id);assert.equal(await s.tools.processSchedule(),true);assert.equal(s.provider.submissions.length,1);
 }finally{await s.close()}});
test('Email ownership change pauses queued scheduled mail after both confirmations',async()=>{const s=await setup();try{
 const scheduled=await s.schedule();await s.details.requestEmail(s.user,'changed@example.invalid',tx=>s.accounts.verifyPassword(s.user.id,password,tx));const rows=(await s.db.query<{payload:string}>("SELECT payload FROM mail_outbox WHERE user_id=$1 ORDER BY created_at",[s.user.id])).rows;const tokens=rows.map(r=>JSON.parse(unseal(r.payload,s.key)).text.match(/#token=([\w-]{43})/)[1]);await s.details.confirmEmail(tokens[0]);assert.equal((await s.row(scheduled.id)).status,'queued');await s.details.confirmEmail(tokens[1]);assert.deepEqual(await s.row(scheduled.id),{status:'paused',reason:'ACCOUNT_SECURITY_CHANGED'});assert.equal(await s.accounts.current(s.token),null);assert.equal(s.provider.submissions.length,0);
 }finally{await s.close()}});
test('Password reset during provider preparation prevents a scheduled send from crossing the authorization boundary',async()=>{const s=await setup();try{
 const scheduled=await s.schedule();await s.db.query("UPDATE scheduled_mail SET due_at=now()-interval '1 minute' WHERE id=$1",[scheduled.id]);s.gateway.provider=async()=>{await s.reset();return {provider:s.provider,from:'sender@example.invalid'}};assert.equal(await s.tools.processSchedule(),true);assert.equal(s.provider.submissions.length,0);assert.equal((await s.db.query('SELECT id FROM messages WHERE workspace_id=$1',[s.user.workspace_id])).rows.length,0);assert.deepEqual(await s.row(scheduled.id),{status:'paused',reason:'ACCOUNT_SECURITY_CHANGED'});
 }finally{await s.close()}});
test('A security reset never turns an already accepted scheduled submission into resumable work',async()=>{const s=await setup();let release=()=>{};try{
 const scheduled=await s.schedule();await s.db.query("UPDATE scheduled_mail SET due_at=now()-interval '1 minute' WHERE id=$1",[scheduled.id]);let entered!:()=>void;const started=new Promise<void>(resolve=>entered=resolve),waiting=new Promise<void>(resolve=>release=resolve);s.gateway.provider=async()=>({from:'sender@example.invalid',provider:{name:'fake',async send(input){entered();await waiting;return s.provider.send(input)}}});const running=s.tools.processSchedule();await started;await s.reset();assert.equal((await s.row(scheduled.id)).status,'sending');release();await running;assert.equal((await s.row(scheduled.id)).status,'sent');assert.equal(s.provider.submissions.length,1);await assert.rejects(s.tools.resumeSchedule(s.user,scheduled.id),/INVALID_SCHEDULE/);assert.equal(await s.tools.processSchedule(),false);
 }finally{release();await s.close()}});
