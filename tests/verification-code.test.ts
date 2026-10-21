import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {openDatabase,migrate} from '../packages/database/index';
import {buildServer} from '../apps/api/server';
import {Accounts} from '../apps/api/accounts';
import {AccountSecurity} from '../apps/api/account-security';
import {UnavailableProvider} from '../packages/provider-adapters';
import {unseal} from '../packages/runtime/vault';
const apiKey='verification-code-test-key-32-characters',key=randomBytes(32).toString('base64');
async function setup(){
 const db=await openDatabase();await migrate(db);await migrate(db);
 const {app}=buildServer(db,new UnavailableProvider(),apiKey,'https://folloopy.example',undefined,{production:true,encryptionKey:key,billing:'complimentary'});
 const accounts=new Accounts(db,true),security=new AccountSecurity(db,'https://folloopy.example',key);
 const call=(url:string,body:Record<string,unknown>,token?:string)=>app.inject({method:'POST',url,headers:{authorization:'Bearer '+apiKey,...(token?{'x-user-session':token}:{})},payload:body});
 const register=async(email:string)=>{const response=await call('/api/auth/register',{name:'OTP Test',email,password:'Synthetic-OTP-Password-2026!'});assert.equal(response.statusCode,200,response.body);const token=response.json().token;return {token,user:(await accounts.current(token))!}};
 const latest=async(id:string)=>{const row=(await db.query<{payload:string}>('SELECT payload FROM mail_outbox WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',[id])).rows[0];const email=JSON.parse(unseal(row.payload,key));return {email,code:email.text.match(/kodunuz: ([0-9]{6})/)[1] as string}};
 return {db,app,accounts,security,call,register,latest};
}
test('Registration automatically mails a private account-bound single-use code',async()=>{
 const s=await setup();try{
  const a=await s.register('a@example.invalid'),b=await s.register('b@example.invalid');let {email,code}=await s.latest(a.user.id);
  if(code===(await s.latest(b.user.id)).code){await s.db.query("UPDATE verification_codes SET sent_at=now()-interval '61 seconds' WHERE user_id=$1",[a.user.id]);await s.security.issueVerificationCode(a.user.id);({email,code}=await s.latest(a.user.id))}
  assert.equal(email.to,'a@example.invalid');assert.match(code,/^\d{6}$/);assert.ok(!email.text.includes('#token='));
  const stored=(await s.db.query<{code_hash:string}>('SELECT code_hash FROM verification_codes WHERE user_id=$1',[a.user.id])).rows[0];assert.equal((await s.security.codeStatus(a.user.id)).hasCode,true);assert.equal(stored.code_hash.length,64);assert.notEqual(stored.code_hash,code);
  assert.equal((await s.call('/api/auth/verify/code/confirm',{code})).statusCode,401);
  assert.equal((await s.call('/api/auth/verify/code/confirm',{code},b.token)).statusCode,400);
  assert.equal((await s.accounts.current(b.token))!.email_verified_at,null);
  assert.equal((await s.call('/api/auth/verify/code/confirm',{code},a.token)).statusCode,200);
  assert.ok((await s.accounts.current(a.token))!.email_verified_at);assert.equal((await s.security.codeStatus(a.user.id)).hasCode,false);
  assert.equal((await s.call('/api/auth/verify/code/confirm',{code},a.token)).statusCode,400);
  assert.equal((await s.db.query('SELECT * FROM purchases')).rows.length,0);
 }finally{await s.app.close();await s.db.close()}
});
test('Wrong attempts persist, lock after five, and only a new code unlocks verification',async()=>{
 const s=await setup();try{
  const a=await s.register('a@example.invalid'),{code}=await s.latest(a.user.id);const wrong=code==='000000'?'111111':'000000';
  for(let index=0;index<5;index++)await assert.rejects(()=>s.security.consumeVerificationCode(a.user.id,wrong),index===4?/VERIFICATION_LOCKED/:/INVALID_VERIFICATION_CODE/);
  assert.equal((await s.db.query<{attempts:number}>('SELECT attempts FROM verification_codes WHERE user_id=$1',[a.user.id])).rows[0].attempts,5);
  await assert.rejects(()=>s.security.consumeVerificationCode(a.user.id,code),/VERIFICATION_LOCKED/);
  await assert.rejects(()=>s.security.issueVerificationCode(a.user.id),/VERIFICATION_COOLDOWN/);
  await s.db.query("UPDATE verification_codes SET sent_at=now()-interval '61 seconds' WHERE user_id=$1",[a.user.id]);
  await s.security.issueVerificationCode(a.user.id);const fresh=(await s.latest(a.user.id)).code;
  assert.notEqual(fresh,code);await assert.rejects(()=>s.security.consumeVerificationCode(a.user.id,code),/INVALID_VERIFICATION_CODE/);
  await s.security.consumeVerificationCode(a.user.id,fresh);assert.ok((await s.accounts.current(a.token))!.email_verified_at);
 }finally{await s.app.close();await s.db.close()}
});
test('Expired codes fail and concurrent correct submissions cannot consume a code twice',async()=>{
 const s=await setup();try{
  const a=await s.register('a@example.invalid'),{code}=await s.latest(a.user.id);
  await s.db.query("UPDATE verification_codes SET expires_at=now()-interval '1 second' WHERE user_id=$1",[a.user.id]);await assert.rejects(()=>s.security.consumeVerificationCode(a.user.id,code),/INVALID_VERIFICATION_CODE/);
  assert.equal((await s.accounts.current(a.token))!.email_verified_at,null);
  await s.db.query("UPDATE verification_codes SET expires_at=now()+interval '10 minutes' WHERE user_id=$1",[a.user.id]);
  const results=await Promise.allSettled([s.security.consumeVerificationCode(a.user.id,code),s.security.consumeVerificationCode(a.user.id,code)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 }finally{await s.app.close();await s.db.close()}
});
