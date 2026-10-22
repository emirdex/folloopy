import {recordMemberActivity} from './member-activity';
import {createHash,createHmac,randomInt,randomBytes,randomUUID,timingSafeEqual,scrypt as derive} from 'node:crypto';
import {promisify} from 'node:util';
import type {DB} from '../../packages/database/index';
import {seal,unseal} from '../../packages/runtime/vault';
import {validNewPassword} from '../../packages/domain/password-policy';
import {securityEmailHtml,verificationCodeEmailHtml} from '../../packages/domain/security-email';
const scrypt=promisify(derive),digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export class AccountSecurity{
 constructor(private db:DB,private site:string,private key:string){}
 private codeHash(userId:string,code:string){return createHmac('sha256',Buffer.from(this.key,'base64')).update(userId+':'+code).digest('hex')}
 async codeStatus(userId:string){
  const row=(await this.db.query<{sent_at:string;usable:boolean}>('SELECT sent_at,expires_at>now() AND attempts<5 AS usable FROM verification_codes WHERE user_id=$1',[userId])).rows[0];
  return {hasCode:!!row?.usable,resendAfter:row?Math.max(0,Math.ceil((+new Date(row.sent_at)+60000-Date.now())/1000)):0};
 }
 async issueVerificationCode(userId:string){
  const result=await this.db.transaction(async tx=>{
   const user=(await tx.query<{email:string;email_verified_at:string|null}>('SELECT email,email_verified_at FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];
   if(!user||user.email_verified_at)return 'already';
   const previous=(await tx.query<{code_hash:string;recent:boolean}>("SELECT code_hash,sent_at>now()-interval '60 seconds' AS recent FROM verification_codes WHERE user_id=$1",[userId])).rows[0];
   if(previous?.recent)return 'cooldown';
   let code:string;do{code=String(randomInt(0,1000000)).padStart(6,'0')}while(previous?.code_hash===this.codeHash(userId,code));
   await tx.query("INSERT INTO verification_codes(user_id,code_hash,expires_at) VALUES($1,$2,now()+interval '10 minutes') ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash,attempts=0,expires_at=excluded.expires_at,sent_at=now()",[userId,this.codeHash(userId,code)]);
   const payload=seal(JSON.stringify({to:user.email,subject:'Folloopy doğrulama kodunuz',html:verificationCodeEmailHtml(code,this.site),text:'Folloopy doğrulama kodunuz: '+code+'\n\nBu kod 10 dakika geçerlidir. Folloopy ekranındaki kod alanına girip Onayla düğmesine basın.\n'+this.site+'/hesap/dogrula\n\nBu işlemi siz başlatmadıysanız e-postayı yok sayabilirsiniz.'}),this.key);
   await tx.query('INSERT INTO mail_outbox(id,user_id,payload) VALUES($1,$2,$3)',[randomUUID(),userId,payload]);
   return 'sent';
  });
  if(result==='cooldown')throw Error('VERIFICATION_COOLDOWN');
  return result;
 }
 async consumeVerificationCode(userId:string,code:string){
  if(!/^\d{6}$/.test(code))throw Error('INVALID_VERIFICATION_CODE');
  const result=await this.db.transaction(async tx=>{
   await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
   const row=(await tx.query<{code_hash:string;attempts:number;expired:boolean}>('SELECT code_hash,attempts,expires_at<=now() AS expired FROM verification_codes WHERE user_id=$1 FOR UPDATE',[userId])).rows[0];
   if(!row||row.expired)return 'INVALID_VERIFICATION_CODE';
   if(row.attempts>=5)return 'VERIFICATION_LOCKED';
   if(!timingSafeEqual(Buffer.from(row.code_hash,'hex'),Buffer.from(this.codeHash(userId,code),'hex'))){
    await tx.query('UPDATE verification_codes SET attempts=attempts+1 WHERE user_id=$1',[userId]);
    return row.attempts===4?'VERIFICATION_LOCKED':'INVALID_VERIFICATION_CODE';
   }
   await tx.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[userId]);await recordMemberActivity(tx,userId,'email_verified');
   await tx.query('DELETE FROM verification_codes WHERE user_id=$1',[userId]);
   await tx.query("DELETE FROM account_tokens WHERE user_id=$1 AND purpose='verify'",[userId]);
   return 'ok';
  });
  // Fail outside the transaction so wrong-attempt counters remain committed.
  if(result!=='ok')throw Error(result);
 }
 async issue(userId:string,purpose:'verify'|'reset'){
  await this.db.transaction(async tx=>{
  const user=(await tx.query<{email:string}>('SELECT email FROM users WHERE id=$1 FOR UPDATE',[userId])).rows[0];if(!user)return;
  const token=randomBytes(32).toString('base64url'),id=randomUUID(),minutes=purpose==='verify'?1440:30;
  const url=this.site+(purpose==='verify'?'/hesap/dogrula':'/sifre-yenile')+'#token='+token;
  const duration=purpose==='reset'?'30 dakika':'24 saat';
  const html=securityEmailHtml({
   title:purpose==='reset'?'Şifrenizi yenileyin.':'E-postanızı doğrulayın.',
   description:purpose==='reset'?'Hesabınız için bir şifre yenileme isteği aldık. Yeni şifrenizi belirlemek için aşağıdaki düğmeyi kullanın.':'Folloopy hesabınızı güvenle kullanmaya başlamak için e-posta adresinizi doğrulayın.',
   actionLabel:purpose==='reset'?'Şifremi Yenile':'E-Postamı Doğrula',actionUrl:url,
   validity:duration+' geçerli · Tek kullanımlık bağlantı',
   preheader:purpose==='reset'?'Şifrenizi güvenle yenileyin. Bağlantınız 30 dakika geçerli.':'E-posta adresinizi doğrulayarak hesabınıza devam edin.'
  });
  const payload=seal(JSON.stringify({to:user.email,subject:purpose==='verify'?'Folloopy e-posta adresinizi doğrulayın':'Folloopy şifrenizi yenileyin',html,text:(purpose==='verify'?'E-posta adresinizi doğrulamak':'Şifrenizi yenilemek')+' için bağlantıyı açın:\n'+url+'\n\nBağlantı '+duration+' geçerlidir ve tek kullanımlıktır.\n\nBu işlemi siz başlatmadıysanız bu e-postayı yok sayabilirsiniz.'}),this.key);
  await tx.query('DELETE FROM account_tokens WHERE user_id=$1 AND purpose=$2',[userId,purpose]);await tx.query("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+($4::text||' minutes')::interval)",[digest(token),userId,purpose,minutes]);await tx.query('INSERT INTO mail_outbox(id,user_id,payload) VALUES($1,$2,$3)',[id,userId,payload]);
  });
 }
 async request(email:string,purpose:'verify'|'reset'){
  const u=(await this.db.query<{id:string;email_verified_at:string|null}>('SELECT id,email_verified_at FROM users WHERE email=$1',[email.trim().toLowerCase()])).rows[0];
  if(u&&(purpose==='reset'||!u.email_verified_at))await this.issue(u.id,purpose);
 }
 async consume(token:string,purpose:'verify'|'reset',password?:string,expectedUserId?:string){
  if(!/^[\w-]{43}$/.test(token))throw new Error('INVALID_ACCOUNT_TOKEN');
  if(purpose==='reset'&&!validNewPassword(password||''))throw new Error('INVALID_PASSWORD');
  let passwordHash='';if(password){const salt=randomBytes(16).toString('hex');passwordHash=salt+':'+(await scrypt(password,salt,64) as Buffer).toString('hex')}
  await this.db.transaction(async tx=>{
   const candidate=(await tx.query<{user_id:string}>('SELECT user_id FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now()',[digest(token),purpose])).rows[0];
   if(!candidate||(expectedUserId&&candidate.user_id!==expectedUserId))throw Error('INVALID_ACCOUNT_TOKEN');
   await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[candidate.user_id]);
   const row=(await tx.query<{user_id:string}>('DELETE FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING user_id',[digest(token),purpose])).rows[0];if(!row)throw new Error('INVALID_ACCOUNT_TOKEN');
   await recordMemberActivity(tx,row.user_id,purpose==='verify'?'email_verified':'password_reset');
   if(purpose==='verify'){await tx.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[row.user_id]);await tx.query('DELETE FROM verification_codes WHERE user_id=$1',[row.user_id]);}
   else{await tx.query("UPDATE bulk_campaigns SET status='paused',reason='ACCOUNT_SECURITY_CHANGED',updated_at=now() WHERE user_id=$1 AND status IN ('queued','running')",[row.user_id]);await tx.query('UPDATE users SET password_hash=$1 WHERE id=$2',[passwordHash,row.user_id]);await tx.query('DELETE FROM sessions WHERE user_id=$1',[row.user_id]);await tx.query('DELETE FROM oauth_states WHERE user_id=$1',[row.user_id]);await tx.query('DELETE FROM account_tokens WHERE user_id=$1',[row.user_id]);await tx.query('DELETE FROM account_email_changes WHERE user_id=$1',[row.user_id]);await tx.query('DELETE FROM verification_codes WHERE user_id=$1',[row.user_id])}
  });
 }
 async deliver(){
  const rows=await this.db.transaction(async tx=>{const r=await tx.query<{id:string;payload:string;attempts:number}>("SELECT id,payload,attempts FROM mail_outbox WHERE state='pending' AND available_at<=now() ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED");for(const row of r.rows)await tx.query("UPDATE mail_outbox SET state='sending',attempts=attempts+1 WHERE id=$1",[row.id]);return r.rows});
  for(const row of rows){try{const body=JSON.parse(unseal(row.payload,this.key));const res=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:JSON.stringify({...body,from:process.env.MAIL_FROM})});if(!res.ok)throw Error('MAIL_DELIVERY_FAILED');await this.db.query("UPDATE mail_outbox SET state='sent',payload='' WHERE id=$1",[row.id])}catch{await this.db.query("UPDATE mail_outbox SET state=$2,available_at=now()+interval '5 minutes' WHERE id=$1",[row.id,row.attempts>=4?'failed':'pending'])}}
 }
 async cleanup(){await this.db.query('DELETE FROM verification_codes WHERE expires_at<now()');await this.db.query('DELETE FROM account_email_changes WHERE expires_at<now()');await this.db.query('DELETE FROM sessions WHERE expires_at<now()');await this.db.query('DELETE FROM account_tokens WHERE expires_at<now()');await this.db.query('DELETE FROM oauth_states WHERE expires_at<now()');await this.db.query('DELETE FROM request_limits WHERE expires_at<now()');await this.db.query("DELETE FROM mail_outbox WHERE state IN ('sent','failed') AND created_at<now()-interval '30 days'");await this.db.query("UPDATE mail_outbox SET state='pending' WHERE state='sending' AND available_at<now()-interval '5 minutes'")}
}
