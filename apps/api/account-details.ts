import {recordMemberActivity} from './member-activity';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import type {DB} from '../../packages/database/index';
import {emailChangeEmailHtml} from '../../packages/domain/security-email';
import {seal} from '../../packages/runtime/vault';
import type {Account} from './accounts';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
type Change={user_id:string;old_email:string;new_email:string;old_token_hash:string|null;new_token_hash:string|null;old_confirmed:boolean;new_confirmed:boolean};
export class AccountDetails{
 constructor(private db:DB,private site:string,private encryptionKey?:string){}
 async details(user:Account){
  const profile=(await this.db.query('SELECT name,email,created_at,email_verified_at FROM users WHERE id=$1',[user.id])).rows[0];
  const usage=(await this.db.query('SELECT status,used,message_limit FROM entitlements WHERE workspace_id=$1',[user.workspace_id])).rows[0]||null;
  const purchases=(await this.db.query('SELECT id,plan,mode,status,amount_minor,currency,created_at,completed_at FROM purchases WHERE user_id=$1 AND workspace_id=$2 ORDER BY created_at DESC,id LIMIT 50',[user.id,user.workspace_id])).rows;
  const lastPayment=(await this.db.query("SELECT amount_minor,currency,completed_at FROM purchases WHERE user_id=$1 AND workspace_id=$2 AND mode='live' AND status='paid' AND amount_minor IS NOT NULL AND currency IS NOT NULL AND completed_at IS NOT NULL ORDER BY completed_at DESC,id LIMIT 1",[user.id,user.workspace_id])).rows[0]||null;
  const pendingEmail=(await this.db.query('SELECT new_email,expires_at,old_confirmed,new_confirmed FROM account_email_changes WHERE user_id=$1 AND expires_at>now()',[user.id])).rows[0]||null;
  const accessGrant=(await this.db.query('SELECT plan,granted_at FROM access_grants WHERE workspace_id=$1',[user.workspace_id])).rows[0]||null;
  return {profile,plan:user.plan,usage,purchases,accessGrant,lastPayment,pendingEmail,emailChangeAvailable:!!this.encryptionKey};
 }
 async updateName(user:Account,name:string){
  name=name.trim();if(name.length<2||name.length>80||/[\r\n]/.test(name))throw Error('INVALID_ACCOUNT');
  await this.db.query('UPDATE users SET name=$1 WHERE id=$2',[name,user.id]);
 }
 private payload(to:string,subject:string,text:string,html:string){return seal(JSON.stringify({to,subject,text,html}),this.encryptionKey!)}
 async requestEmail(user:Account,email:string,authorize?:(tx:DB)=>Promise<void>){
  if(!this.encryptionKey)throw Error('EMAIL_UNAVAILABLE');
  email=email.trim().toLowerCase();
  if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/[\r\n]/.test(email))throw Error('INVALID_ACCOUNT');
  const oldToken=randomBytes(32).toString('base64url'),newToken=randomBytes(32).toString('base64url');
  await this.db.transaction(async tx=>{
   const current=(await tx.query<{email:string}>('SELECT email FROM users WHERE id=$1 FOR UPDATE',[user.id])).rows[0];
   if(authorize)await authorize(tx);
   if(!current||current.email===email)throw Error('EMAIL_UNCHANGED');
   if((await tx.query('SELECT id FROM users WHERE email=$1',[email])).rows.length)throw Error('EMAIL_IN_USE');
   await tx.query('DELETE FROM account_email_changes WHERE user_id=$1',[user.id]);
   await tx.query("INSERT INTO account_email_changes(user_id,old_email,new_email,old_token_hash,new_token_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '1 hour')",[user.id,current.email,email,digest(oldToken),digest(newToken)]);
   const link=(token:string)=>this.site+'/hesap/eposta-degisikligi#token='+token;
   for(const message of [
    {to:current.email,currentAddress:true,actionUrl:link(oldToken),text:'Folloopy hesabınızın e-posta adresinin '+email+' olarak değiştirilmesi istendi. Bu değişikliği siz başlattıysanız aşağıdaki bağlantıyla mevcut adresinizden onaylayın:\n'+link(oldToken)},
    {to:email,currentAddress:false,actionUrl:link(newToken),text:'Bu adresi Folloopy hesabınızda kullanmak için aşağıdaki bağlantıyla doğrulayın:\n'+link(newToken)}
   ])await tx.query('INSERT INTO mail_outbox(id,user_id,payload) VALUES($1,$2,$3)',[randomUUID(),user.id,this.payload(message.to,'Folloopy e-posta değişikliği onayı',message.text+'\n\nDeğişiklik ancak iki adres de onayladığında tamamlanır. Bağlantı 1 saat geçerlidir. Bu işlemi siz başlatmadıysanız bağlantıya tıklamayın; hesabınızdaki talebi iptal edip şifrenizi yenileyin.',emailChangeEmailHtml({site:this.site,newEmail:email,actionUrl:message.actionUrl,currentAddress:message.currentAddress}))]);
  });
 }
 async confirmEmail(token:string){
  if(!/^[\w-]{43}$/.test(token))throw Error('INVALID_ACCOUNT_TOKEN');
  try{return await this.db.transaction(async tx=>{
   const hash=digest(token);
   const found=(await tx.query<{user_id:string}>('SELECT user_id FROM account_email_changes WHERE (old_token_hash=$1 OR new_token_hash=$1) AND expires_at>now()',[hash])).rows[0];
   if(!found)throw Error('INVALID_ACCOUNT_TOKEN');
   const current=(await tx.query<{email:string}>('SELECT email FROM users WHERE id=$1 FOR UPDATE',[found.user_id])).rows[0];
   const row=(await tx.query<Change>('SELECT * FROM account_email_changes WHERE user_id=$2 AND (old_token_hash=$1 OR new_token_hash=$1) AND expires_at>now() FOR UPDATE',[hash,found.user_id])).rows[0];
   if(!row)throw Error('INVALID_ACCOUNT_TOKEN');
   if(!current||current.email!==row.old_email)throw Error('INVALID_ACCOUNT_TOKEN');
   const oldConfirmed=row.old_confirmed||row.old_token_hash===hash,newConfirmed=row.new_confirmed||row.new_token_hash===hash;
   if(!oldConfirmed||!newConfirmed){await tx.query('UPDATE account_email_changes SET old_confirmed=$1,new_confirmed=$2,old_token_hash=$3,new_token_hash=$4 WHERE user_id=$5',[oldConfirmed,newConfirmed,oldConfirmed?null:row.old_token_hash,newConfirmed?null:row.new_token_hash,row.user_id]);return {completed:false};}
   if((await tx.query('SELECT id FROM users WHERE email=$1 AND id<>$2',[row.new_email,row.user_id])).rows.length)throw Error('EMAIL_IN_USE');
   await tx.query("UPDATE bulk_campaigns SET status='paused',reason='ACCOUNT_SECURITY_CHANGED',updated_at=now() WHERE user_id=$1 AND status IN ('queued','running')",[row.user_id]);
   await tx.query('UPDATE users SET email=$1,email_verified_at=now() WHERE id=$2',[row.new_email,row.user_id]);await recordMemberActivity(tx,row.user_id,'email_changed');
   await tx.query('DELETE FROM sessions WHERE user_id=$1',[row.user_id]);
   await tx.query('DELETE FROM account_tokens WHERE user_id=$1',[row.user_id]);
   await tx.query('DELETE FROM verification_codes WHERE user_id=$1',[row.user_id]);
   await tx.query('DELETE FROM oauth_states WHERE user_id=$1',[row.user_id]);
   await tx.query('DELETE FROM account_email_changes WHERE user_id=$1',[row.user_id]);
   return {completed:true};
  })}catch(e){if((e as {code?:string}).code==='23505')throw Error('EMAIL_IN_USE');throw e;}
 }
 async cancelEmail(userId:string){await this.db.query('DELETE FROM account_email_changes WHERE user_id=$1',[userId]);}
}
