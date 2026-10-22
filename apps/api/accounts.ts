import {randomBytes,randomUUID,scrypt as derive,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {validNewPassword} from '../../packages/domain/password-policy';
import type {DB} from '../../packages/database/index';
const scrypt=promisify(derive);
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const plans={individual:{name:'Essential',limit:100},team:{name:'Signature',limit:500},business:{name:'Enterprise',limit:1000}} as const;
export type Plan=keyof typeof plans;
export type Account={id:string;workspace_id:string;name:string;email:string;plan:Plan|null;role:'member'|'owner';email_verified_at?:string|null};
export class Accounts{
 constructor(private db:DB,private production=false){}
 async register(name:string,email:string,password:string){
  if(!validNewPassword(password))throw new Error('INVALID_PASSWORD');
  if(name.trim().length<2||name.length>80)throw new Error('INVALID_ACCOUNT');
  const salt=randomBytes(16).toString('hex');
  const hash=(await scrypt(password,salt,64) as Buffer).toString('hex');
  const id=randomUUID(),workspace=randomUUID();
  try{await this.db.transaction(async tx=>{
   await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,name+' çalışma alanı']);
   await tx.query('INSERT INTO users(id,workspace_id,name,email,password_hash) VALUES($1,$2,$3,$4,$5)',[id,workspace,name,email.trim().toLowerCase(),salt+':'+hash]);
  })}catch(e){if((e as {code?:string}).code==='23505')throw new Error('ACCOUNT_EXISTS');throw e}
  return this.createSession(id);
 }
 async login(email:string,password:string){
  return this.db.transaction(async tx=>{
  const user=(await tx.query<{id:string;password_hash:string}>('SELECT id,password_hash FROM users WHERE email=$1 FOR UPDATE',[email.trim().toLowerCase()])).rows[0];
  // Equal work for unknown emails; never return or log password hashes.
  const [salt,encoded]=(user?.password_hash||'00000000000000000000000000000000:'+ '0'.repeat(128)).split(':');
  const computed=await scrypt(password,salt,64) as Buffer;
  if(!timingSafeEqual(computed,Buffer.from(encoded,'hex'))||!user)throw new Error('INVALID_LOGIN');
  return this.createSession(user.id,tx);
  });
 }
 async verifyPassword(userId:string,password:string,db:DB=this.db){
  const row=(await db.query<{password_hash:string}>('SELECT password_hash FROM users WHERE id=$1',[userId])).rows[0];
  if(!row||!password||password.length>128)throw Error('INVALID_LOGIN');
  const [salt,encoded]=row.password_hash.split(':');
  const computed=await scrypt(password,salt,64) as Buffer;
  if(!timingSafeEqual(computed,Buffer.from(encoded,'hex')))throw Error('INVALID_LOGIN');
 }
 private async createSession(id:string,db:DB=this.db){
  const token=randomBytes(32).toString('base64url');
  await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",[digest(token),id]);
  await db.query('UPDATE users SET last_login_at=now() WHERE id=$1',[id]);
  return {token};
 }
 async current(token:string,db:DB=this.db):Promise<Account|null>{
  if(!/^[\w-]{43}$/.test(token))return null;
  return (await db.query<Account>(`SELECT u.id,u.workspace_id,u.name,u.email,u.role,u.email_verified_at,${this.production?'g.plan':'COALESCE(g.plan,p.plan)'} AS plan FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN preview_purchases p ON p.workspace_id=u.workspace_id LEFT JOIN access_grants g ON g.workspace_id=u.workspace_id WHERE s.token_hash=$1 AND s.expires_at>now()`,[digest(token)])).rows[0]||null;
 }
 async logout(token:string){await this.db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(token)])}
 async grant(account:Account,plan:Plan){
  if(!Object.hasOwn(plans,plan))throw new Error('INVALID_PLAN');
  await this.db.transaction(async tx=>{
   const user=(await tx.query<{email_verified_at:string|null}>('SELECT email_verified_at FROM users WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[account.id,account.workspace_id])).rows[0];
   if(!user)throw Error('UNAUTHORIZED');
   if(this.production&&!user.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');
   if(this.production&&plan==='business')throw Error('INVALID_PLAN');
   const entitlement=(await tx.query<{status:string}>('SELECT status FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[account.workspace_id])).rows[0];
   if(entitlement&&(entitlement.status==='suspended'||(this.production&&entitlement.status!=='active')))throw Error('FORBIDDEN');
   await tx.query("INSERT INTO access_grants(workspace_id,plan,mode) VALUES($1,$2,'complimentary') ON CONFLICT(workspace_id) DO UPDATE SET plan=excluded.plan",[account.workspace_id,plan]);
   await tx.query("INSERT INTO entitlements(workspace_id,status,message_limit) VALUES($1,'active',$2) ON CONFLICT(workspace_id) DO UPDATE SET status='active',message_limit=excluded.message_limit",[account.workspace_id,plans[plan].limit]);
  });
 }

 async purchase(account:Account,plan:Plan,idempotencyKey:string=randomUUID()){
  if(!Object.hasOwn(plans,plan))throw new Error('INVALID_PLAN');
  if(this.production)throw Error('FORBIDDEN');
  // Local preview only. This must never confirm a real paid subscription.
  await this.db.transaction(async tx=>{
   await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[account.id]);
   const prior=(await tx.query<{plan:string}>('SELECT plan FROM purchases WHERE workspace_id=$1 AND idempotency_key=$2',[account.workspace_id,idempotencyKey])).rows[0];
   if(prior){if(prior.plan!==plan)throw new Error('IDEMPOTENCY_CONFLICT');return}
   await tx.query("INSERT INTO purchases(id,user_id,workspace_id,plan,mode,status,amount_minor,message_limit,idempotency_key,source,completed_at) VALUES($1,$2,$3,$4,'simulation','simulated',0,$5,$6,'checkout',now())",[randomUUID(),account.id,account.workspace_id,plan,plans[plan].limit,idempotencyKey]);
   await tx.query('INSERT INTO preview_purchases(workspace_id,plan) VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET plan=excluded.plan',[account.workspace_id,plan]);
   await tx.query("INSERT INTO entitlements(workspace_id,status,message_limit) VALUES($1,'local_test',$2) ON CONFLICT(workspace_id) DO UPDATE SET message_limit=excluded.message_limit",[account.workspace_id,plans[plan].limit]);
  });
 }
}
