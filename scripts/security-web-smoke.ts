// Run after npm run build: NODE_ENV=production node --import tsx scripts/security-web-smoke.ts
// Uses disposable embedded data and synthetic sessions; never contacts production or sends mail.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
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
const renderCalls:string[]=[];api.addHook('onRequest',async request=>{renderCalls.push(request.url.split('?')[0])});
await api.ready();installLocalApi(api,process.env.INTERNAL_API_URL);
const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
const address=server.address();if(!address||typeof address==='string')throw Error('SMOKE_SERVER_FAILED');const origin='http://127.0.0.1:'+address.port;
const web=next({dev:false,dir:'./apps/web',hostname:'127.0.0.1',port:address.port});await web.prepare();server.on('request',web.getRequestHandler());
let checks=0;
const expectRedirect=async(path:string,target:string,token?:string,extraCookie='')=>{
 const response=await fetch(origin+path,{redirect:'manual',headers:{cookie:(token?'mt_session='+token+'; ':'')+extraCookie}});
 const html=await response.text();
 if([303,307,308].includes(response.status))assert.equal(new URL(response.headers.get('location')!,origin).pathname,target,path);
 else{
  // Next may stream a shell before auth finishes, then emit its documented
  // meta redirect. Require the exact destination AND absence of private UI.
  assert.equal(response.status,200,path);
  const tag=html.match(/<meta[^>]+id="__next-page-redirect"[^>]*>/)?.[0];
  const destination=tag?.match(/content="[^"]*?url=([^"]+)"/)?.[1]?.replace(/&amp;/g,'&');
  assert.ok(destination,`${path}: missing redirect`);assert.equal(new URL(destination,origin).pathname,target,path);
  for(const marker of ['Genel Bakış','Mail Özeti','Fatura Bilgileri'])assert.ok(!html.includes(marker),path+': leaked protected UI');
 }
 checks++;
};
try{
 const resetForm=await fetch(origin+'/sifre-yenile');const resetHtml=await resetForm.text();assert.equal(resetForm.status,200);assert.ok(!resetHtml.includes('Giriş Ekranına Dön'));assert.ok(resetHtml.includes('Yeni şifrenizi belirleyin.'));checks++;
 const member=await accounts.register('Unverified Member','web-member@example.invalid','Synthetic-web-password-2026!');
 const owner=await accounts.register('Unverified Owner','web-owner@example.invalid','Synthetic-web-password-2026!');await db.query("UPDATE users SET role='owner' WHERE email='web-owner@example.invalid'");
 for(const session of [member.token,owner.token])for(const path of ['/panel','/panel?view=account','/panel?view=extensions','/panel?view=bulk','/panel?view=compose','/eklentiler/indir','/paketler','/odeme?plan=team','/odeme/tamamlandi','/giris','/kayit','/admin'])await expectRedirect(path,'/hesap/dogrula',session);
 for(const path of ['/panel','/panel?view=account','/panel?view=bulk','/eklentiler/indir','/paketler','/odeme?plan=team','/admin'])await expectRedirect(path,'/giris',undefined,'mail_tracking_preview=active');
 // Exercise the real Server Action: returning from verification must revoke
 // the session, not bounce between /giris and /hesap/dogrula.
 const manifest=JSON.parse(await readFile('apps/web/.next/server/server-reference-manifest.json','utf8'));
 const entry=Object.entries(manifest.node).find(([,value])=>(value as {exportedName?:string}).exportedName==='leaveVerification');assert.ok(entry);
 const leave=(requestOrigin:string)=>fetch(origin+'/hesap/dogrula',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json','Next-Action':entry[0],Origin:requestOrigin,cookie:'mt_session='+member.token},body:'[]'});
 const crossOrigin=await leave('https://unauthorized.example');assert.ok(crossOrigin.status>=400);assert.ok(await accounts.current(member.token));checks++;
 const exit=await leave(origin);assert.ok([200,303].includes(exit.status));assert.equal(exit.headers.get('x-action-redirect')?.split(';')[0],'/giris');assert.ok(exit.headers.get('set-cookie')?.includes('mt_session=;'));assert.equal(await accounts.current(member.token),null);checks++;
 await expectRedirect('/panel','/giris',member.token);
 member.token=(await accounts.login('web-member@example.invalid','Synthetic-web-password-2026!')).token;
 await db.query('UPDATE users SET email_verified_at=now()');
 await expectRedirect('/panel','/paketler',member.token);await expectRedirect('/admin','/admin/erisim',member.token);await expectRedirect('/hesap/dogrula','/admin',owner.token);
 const account=(await accounts.current(member.token))!;for(const plan of ['individual','team'] as const){await accounts.grant(account,plan);const response=await fetch(origin+'/panel',{redirect:'manual',headers:{cookie:'mt_session='+member.token}});assert.equal(response.status,200,plan);const html=await response.text();assert.ok(html.includes('Genel Bakış'));checks++;
  const download=await fetch(origin+'/eklentiler/indir',{redirect:'manual',headers:{cookie:'mt_session='+member.token}});assert.equal(download.status,200);if(['individual','team'].includes(plan)){assert.equal(download.headers.get('content-type'),'application/zip');assert.ok(download.headers.get('cache-control')?.includes('no-store'));assert.equal(Buffer.from(await download.arrayBuffer()).readUInt32LE(0),0x04034b50)}checks++;
 }
 // Each server render must deduplicate session reads, and independent screens
 // must not wait for a mail list they never display.
 for(const view of ['setup','compose','drafts','guide']){
  renderCalls.length=0;
  const response=await fetch(origin+'/panel?view='+view,{headers:{cookie:'mt_session='+member.token}});
  assert.equal(response.status,200);await response.text();
  assert.equal(renderCalls.filter(path=>path==='/api/auth/me').length,1,view+': duplicate session lookup');
  assert.ok(!renderCalls.includes('/api/messages'),view+': unrelated mail list');checks++;
 }
 // Browser cookies cannot substitute for signed extension credentials.
 process.env.DEPLOYMENT_ROLE='panel';
 for(const source of ['https://unauthorized.example','chrome-extension://'+'a'.repeat(32)]){
  const response=await fetch(origin+'/eklentiler/api',{method:'POST',headers:{Origin:source,'Content-Type':'application/json',cookie:'mt_session='+member.token},body:JSON.stringify({operation:'send',payload:{}})});
  assert.equal(response.status,source.startsWith('chrome-extension:')?401:403);checks++;
 }
 delete process.env.DEPLOYMENT_ROLE;
 const verifiedPage=await fetch(origin+'/admin',{headers:{cookie:'mt_session='+owner.token},redirect:'manual'});assert.equal(verifiedPage.status,200);checks++;
 console.log(`Web authorization smoke: ${checks} HTTP checks passed.`);
}finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await web.close();await api.close();await db.close()}
