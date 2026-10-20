import {createHash,randomBytes,randomUUID,scrypt as derive} from 'node:crypto';
import {promisify} from 'node:util';
import type {DB} from '../../packages/database/index';
import {seal,unseal} from '../../packages/runtime/vault';
import {validNewPassword} from '../../packages/domain/password-policy';
const scrypt=promisify(derive),digest=(s:string)=>createHash('sha256').update(s).digest('hex');
export class AccountSecurity{
 constructor(private db:DB,private site:string,private key:string){}
 async issue(userId:string,purpose:'verify'|'reset'){
  const user=(await this.db.query<{email:string}>('SELECT email FROM users WHERE id=$1',[userId])).rows[0];if(!user)return;
  const token=randomBytes(32).toString('base64url'),id=randomUUID(),minutes=purpose==='verify'?1440:30;
  const url=this.site+(purpose==='verify'?'/hesap/dogrula':'/sifre-yenile')+'#token='+token;
  const payload=seal(JSON.stringify({to:user.email,subject:purpose==='verify'?'Folloopy e-posta adresinizi doğrulayın':'Folloopy şifrenizi yenileyin',text:(purpose==='verify'?'E-posta adresinizi doğrulamak':'Şifrenizi yenilemek')+' için bağlantıyı açın:\n'+url+'\n\nBu işlemi siz başlatmadıysanız bu e-postayı yok sayabilirsiniz.'}),this.key);
  await this.db.transaction(async tx=>{await tx.query('DELETE FROM account_tokens WHERE user_id=$1 AND purpose=$2',[userId,purpose]);await tx.query("INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+($4::text||' minutes')::interval)",[digest(token),userId,purpose,minutes]);await tx.query('INSERT INTO mail_outbox(id,user_id,payload) VALUES($1,$2,$3)',[id,userId,payload])});
 }
 async request(email:string,purpose:'verify'|'reset'){
  const u=(await this.db.query<{id:string;email_verified_at:string|null}>('SELECT id,email_verified_at FROM users WHERE email=$1',[email.trim().toLowerCase()])).rows[0];
  if(u&&(purpose==='reset'||!u.email_verified_at))await this.issue(u.id,purpose);
 }
 async consume(token:string,purpose:'verify'|'reset',password?:string){
  if(!/^[\w-]{43}$/.test(token))throw new Error('INVALID_ACCOUNT_TOKEN');
  if(purpose==='reset'&&!validNewPassword(password||''))throw new Error('INVALID_PASSWORD');
  let passwordHash='';if(password){const salt=randomBytes(16).toString('hex');passwordHash=salt+':'+(await scrypt(password,salt,64) as Buffer).toString('hex')}
  await this.db.transaction(async tx=>{
   const row=(await tx.query<{user_id:string}>('DELETE FROM account_tokens WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING user_id',[digest(token),purpose])).rows[0];if(!row)throw new Error('INVALID_ACCOUNT_TOKEN');
   if(purpose==='verify')await tx.query('UPDATE users SET email_verified_at=now() WHERE id=$1',[row.user_id]);
   else{await tx.query('UPDATE users SET password_hash=$1 WHERE id=$2',[passwordHash,row.user_id]);await tx.query('DELETE FROM sessions WHERE user_id=$1',[row.user_id]);await tx.query('DELETE FROM account_tokens WHERE user_id=$1',[row.user_id]);await tx.query('DELETE FROM account_email_changes WHERE user_id=$1',[row.user_id])}
  });
 }
 async deliver(){
  const rows=await this.db.transaction(async tx=>{const r=await tx.query<{id:string;payload:string;attempts:number}>("SELECT id,payload,attempts FROM mail_outbox WHERE state='pending' AND available_at<=now() ORDER BY created_at LIMIT 5 FOR UPDATE SKIP LOCKED");for(const row of r.rows)await tx.query("UPDATE mail_outbox SET state='sending',attempts=attempts+1 WHERE id=$1",[row.id]);return r.rows});
  for(const row of rows){try{const body=JSON.parse(unseal(row.payload,this.key));const res=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':row.id},body:JSON.stringify({...body,from:process.env.MAIL_FROM})});if(!res.ok)throw Error('MAIL_DELIVERY_FAILED');await this.db.query("UPDATE mail_outbox SET state='sent',payload='' WHERE id=$1",[row.id])}catch{await this.db.query("UPDATE mail_outbox SET state=$2,available_at=now()+interval '5 minutes' WHERE id=$1",[row.id,row.attempts>=4?'failed':'pending'])}}
 }
 async cleanup(){await this.db.query('DELETE FROM account_email_changes WHERE expires_at<now()');await this.db.query('DELETE FROM sessions WHERE expires_at<now()');await this.db.query('DELETE FROM account_tokens WHERE expires_at<now()');await this.db.query('DELETE FROM oauth_states WHERE expires_at<now()');await this.db.query('DELETE FROM request_limits WHERE expires_at<now()');await this.db.query("DELETE FROM mail_outbox WHERE state IN ('sent','failed') AND created_at<now()-interval '30 days'");await this.db.query("UPDATE mail_outbox SET state='pending' WHERE state='sending' AND available_at<now()-interval '5 minutes'")}
}
