import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {securityEmailHtml} from '../packages/domain/security-email';
import {openDatabase,migrate} from '../packages/database';
import {Accounts} from '../apps/api/accounts';
import {AccountSecurity} from '../apps/api/account-security';
import {unseal} from '../packages/runtime/vault';
const message={title:'Reset your password',description:'A password reset was requested.',actionLabel:'Reset password',actionUrl:'https://folloopy.example/sifre-yenile#token=synthetic-token',validity:'30 minutes',preheader:'Choose a new password.'};
test('Security email is accessible without scripts/images and escapes content and action attributes',()=>{
 const html=securityEmailHtml({...message,title:'<script>alert(1)</script>',description:'"Private" <value> & text',actionUrl:'https://folloopy.example/sifre-yenile?x=" onmouseover="evil#token=synthetic'});
 assert.ok(html.includes('role="presentation"'));assert.ok(html.includes('lang="tr"'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;value&gt; &amp; text'));assert.ok(html.includes('?x=&quot; onmouseover=&quot;evil#token=synthetic'));
 for(const actionUrl of ['javascript:alert(1)','data:text/html,test','http://example.com','https://name:password@example.com'])assert.throws(()=>securityEmailHtml({...message,actionUrl}),/INVALID_EMAIL_URL/);
});
test('Reset delivery contains the same one-use link in styled HTML and plain text; OTP closes legacy verification',async()=>{
 const db=await openDatabase();await migrate(db);const key=randomBytes(32).toString('base64'),accounts=new Accounts(db),security=new AccountSecurity(db,'https://folloopy.example',key);
 try{
  const {token}=await accounts.register('Email Test','email-test@example.invalid','Synthetic-email-password-2026!');const user=(await accounts.current(token))!;
  await security.issue(user.id,'reset');
  const row=(await db.query<{payload:string}>('SELECT payload FROM mail_outbox ORDER BY created_at DESC LIMIT 1')).rows[0];const mail=JSON.parse(unseal(row.payload,key));const link=mail.text.match(/https:\/\/\S+#token=[\w-]{43}/)[0];
  assert.ok(mail.html.includes('href="'+link+'"'));assert.ok(mail.html.includes('Şifremi Yenile'));assert.ok(mail.html.includes('30 dakika'));assert.ok(mail.text.includes('30 dakika'));assert.ok(!row.payload.includes(link));
  await security.issue(user.id,'verify');await security.issueVerificationCode(user.id);
  const otpRow=(await db.query<{payload:string}>('SELECT payload FROM mail_outbox ORDER BY created_at DESC LIMIT 1')).rows[0];const code=JSON.parse(unseal(otpRow.payload,key)).text.match(/kodunuz: ([0-9]{6})/)[1];await security.consumeVerificationCode(user.id,code);
  assert.equal((await db.query("SELECT * FROM account_tokens WHERE user_id=$1 AND purpose='verify'",[user.id])).rows.length,0);
 }finally{await db.close()}
});
