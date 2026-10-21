// Run after npm run build: NODE_ENV=production node --import tsx scripts/security-web-smoke.ts
// Uses disposable embedded data and synthetic sessions; never contacts production or sends mail.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import next from 'next';
import {openDatabase,migrate} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {buildServer} from '../apps/api/server';
import {UnavailableProvider} from '../packages/provider-adapters';
import {installLocalApi} from '../packages/runtime/private-api.cjs';
if(process.env.NODE_ENV!=='production')throw Error('Run this smoke test in production mode after building.');
process.env.INTERNAL_API_KEY='synthetic-web-security-smoke-key-2026';process.env.INTERNAL_API_URL='http://127.0.0.1:45998';process.env.BILLING_MODE='complimentary';process.env.APP_MODE='application';
const db=await openDatabase();await migrate(db);const accounts=new Accounts(db,true);
const {app:api}=buildServer(db,new UnavailableProvider(),process.env.INTERNAL_API_KEY,'https://folloopy.example',undefined,{production:true,encryptionKey:randomBytes(32).toString('base64'),billing:'complimentary'});
await api.ready();installLocalApi(api,process.env.INTERNAL_API_URL);
const web=next({dev:false,dir:'./apps/web',hostname:'127.0.0.1'});await web.prepare();
const server=createServer(web.getRequestHandler());await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();if(!address||typeof address==='string')throw Error('SMOKE_SERVER_FAILED');const origin='http://127.0.0.1:'+address.port;
let checks=0;
const expectRedirect=async(path:string,target:string,token?:string,extraCookie='')=>{
 const response=await fetch(origin+path,{redirect:'manual',headers:{cookie:(token?'mt_session='+token+'; ':'')+extraCookie}});
 assert.ok([303,307,308].includes(response.status),`${path}: expected redirect, got ${response.status}`);
 assert.equal(new URL(response.headers.get('location')!,origin).pathname,target,path);checks++;
};
try{
 const member=await accounts.register('Unverified Member','web-member@example.invalid','Synthetic-web-password-2026!');
 const owner=await accounts.register('Unverified Owner','web-owner@example.invalid','Synthetic-web-password-2026!');await db.query("UPDATE users SET role='owner' WHERE email='web-owner@example.invalid'");
 for(const session of [member.token,owner.token])for(const path of ['/panel','/panel?view=account','/panel?view=extensions','/paketler','/odeme?plan=team','/odeme/tamamlandi','/giris','/kayit','/admin'])await expectRedirect(path,'/hesap/dogrula',session);
 for(const path of ['/panel','/panel?view=account','/paketler','/odeme?plan=team','/admin'])await expectRedirect(path,'/giris',undefined,'mail_tracking_preview=active');
 await db.query('UPDATE users SET email_verified_at=now()');
 await expectRedirect('/panel','/paketler',member.token);await expectRedirect('/admin','/admin/erisim',member.token);await expectRedirect('/hesap/dogrula','/admin',owner.token);
 const account=(await accounts.current(member.token))!;for(const plan of ['individual','team'] as const){await accounts.grant(account,plan);const response=await fetch(origin+'/panel',{redirect:'manual',headers:{cookie:'mt_session='+member.token}});assert.equal(response.status,200,plan);const html=await response.text();assert.ok(html.includes('Genel Bakış'));checks++}
 const verifiedPage=await fetch(origin+'/admin',{headers:{cookie:'mt_session='+owner.token},redirect:'manual'});assert.equal(verifiedPage.status,200);checks++;
 console.log(`Web authorization smoke: ${checks} HTTP checks passed.`);
}finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await web.close();await api.close();await db.close()}
