import {AdminMemberInsights} from './admin-member-insights';
import {createHash,randomBytes,randomUUID,scrypt as derive,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import type {DB} from '../../packages/database/index';
import {Accounts,plans,type Account} from './accounts';
import {recordMemberActivity} from './member-activity';
import {validNewPassword} from '../../packages/domain/password-policy';
const scrypt=promisify(derive);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export type AdminConfig={email:string;token:string};
export class AdminService{
 constructor(private db:DB,private accounts:Accounts){}
 async init(config:AdminConfig){
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.email)||config.token.length<32)throw new Error('INVALID_ADMIN_CONFIG');
  await this.db.query('INSERT INTO admin_bootstrap(id,email,token_hash) VALUES(1,$1,$2) ON CONFLICT(id) DO NOTHING',[config.email.toLowerCase(),hash(config.token)]);
 }
 async status(){const row=(await this.db.query<{email:string;used_at:string|null}>('SELECT email,used_at FROM admin_bootstrap WHERE id=1')).rows[0];return {available:!!row&&!row.used_at,email:row&&!row.used_at?row.email:null}}
 async setup(token:string,name:string,password:string){
  if(!validNewPassword(password))throw new Error('INVALID_PASSWORD');
  const salt=randomBytes(16).toString('hex'),encoded=(await scrypt(password,salt,64) as Buffer).toString('hex');
  let email='';
  await this.db.transaction(async tx=>{
   const state=(await tx.query<{email:string;token_hash:string;used_at:string|null}>('SELECT email,token_hash,used_at FROM admin_bootstrap WHERE id=1 FOR UPDATE')).rows[0];
   if(!state||state.used_at)throw new Error('SETUP_CLOSED');
   if(!timingSafeEqual(Buffer.from(state.token_hash,'hex'),Buffer.from(hash(token),'hex')))throw new Error('INVALID_SETUP_TOKEN');
   email=state.email;
   const existing=(await tx.query<{id:string;password_hash:string}>('SELECT id,password_hash FROM users WHERE email=$1 FOR UPDATE',[email])).rows[0];
   let id=existing?.id;
   if(existing){const[salt,encoded]=existing.password_hash.split(':');const derived=await scrypt(password,salt,64) as Buffer;if(!timingSafeEqual(derived,Buffer.from(encoded,'hex')))throw new Error('EXISTING_ACCOUNT_PASSWORD_REQUIRED');await tx.query("UPDATE users SET role='owner' WHERE id=$1",[id]);await tx.query('DELETE FROM sessions WHERE user_id=$1',[id])}
   else{id=randomUUID();const workspace=randomUUID();await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,'Site yönetimi']);await tx.query("INSERT INTO users(id,workspace_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,'owner')",[id,workspace,name.trim(),email,salt+':'+encoded])}
   await tx.query('UPDATE admin_bootstrap SET used_at=now() WHERE id=1');
   await tx.query("INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,'owner_setup',$3)",[randomUUID(),id,id]);
  });
  return this.accounts.login(email,password);
 }
 async owner(token:string):Promise<Account>{const user=await this.accounts.current(token);if(!user)throw new Error('UNAUTHORIZED');if(user.role!=='owner')throw new Error('FORBIDDEN');return user}
 async overview(){return (await this.db.query(`SELECT (SELECT count(*)::int FROM users WHERE role='member') AS members,(SELECT count(*)::int FROM purchases) AS purchases,(SELECT count(*)::int FROM purchases WHERE mode='simulation') AS simulations,(SELECT COALESCE(sum(amount_minor),0)::text FROM purchases WHERE mode='live' AND status='paid') AS collected_minor,(SELECT count(*)::int FROM blog_posts WHERE status='published') AS published_posts,(SELECT count(*)::int FROM enterprise_requests WHERE status='new') AS enterprise_new`)).rows[0]}
 async members(q='',offset=0){const args=[`%${q}%`];const total=(await this.db.query<{total:number}>('SELECT count(*)::int AS total FROM users WHERE name ILIKE $1 OR email ILIKE $1',args)).rows[0].total;const rows=(await this.db.query(`SELECT u.id,u.name,u.email,u.role,u.created_at,u.last_login_at,u.workspace_id,COALESCE(g.plan,p.plan) AS plan,e.status AS entitlement_status,CASE WHEN g.plan='free' THEN COALESCE((SELECT used FROM free_daily_usage f WHERE f.workspace_id=u.workspace_id AND f.usage_date=(now() AT TIME ZONE 'Europe/Istanbul')::date),0) ELSE e.used END AS used,e.message_limit,(SELECT count(*)::int FROM messages m WHERE m.workspace_id=u.workspace_id) AS message_count,(SELECT email FROM mail_connections mc WHERE mc.workspace_id=u.workspace_id) AS connected_email FROM users u LEFT JOIN preview_purchases p ON p.workspace_id=u.workspace_id LEFT JOIN access_grants g ON g.workspace_id=u.workspace_id LEFT JOIN entitlements e ON e.workspace_id=u.workspace_id WHERE u.name ILIKE $1 OR u.email ILIKE $1 ORDER BY u.created_at DESC,u.id LIMIT 50 OFFSET $2`,[...args,offset])).rows;return {rows,total}}
 async member(id:string){return new AdminMemberInsights(this.db).detail(id)}
 async createMember(actor:Account,input:{name:string;email:string;password:string;plan:'individual'|'team'}){
  if(actor.role!=='owner')throw Error('FORBIDDEN');
  const name=input.name.trim(),email=input.email.trim().toLowerCase();
  if(name.length<2||name.length>80||/[\r\n\t]/.test(name)||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('INVALID_ACCOUNT');
  if(!validNewPassword(input.password))throw Error('INVALID_PASSWORD');
  if(!['individual','team'].includes(input.plan))throw Error('INVALID_PLAN');
  const id=randomUUID(),workspace=randomUUID(),salt=randomBytes(16).toString('hex');
  const encoded=(await scrypt(input.password,salt,64) as Buffer).toString('hex');
  try{return await this.db.transaction(async tx=>{
   const owner=(await tx.query<{role:string;email_verified_at:string|null}>('SELECT role,email_verified_at FROM users WHERE id=$1 FOR SHARE',[actor.id])).rows[0];
   if(owner?.role!=='owner')throw Error('FORBIDDEN');
   if(!owner.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');
   await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,name+' çalışma alanı']);
   // Admin provisioning grants access but never asserts email ownership or creates a login session.
   await tx.query("INSERT INTO users(id,workspace_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,'member')",[id,workspace,name,email,salt+':'+encoded]);
   await tx.query("INSERT INTO access_grants(workspace_id,plan,mode) VALUES($1,$2,'complimentary')",[workspace,input.plan]);
   await tx.query("INSERT INTO entitlements(workspace_id,status,message_limit) VALUES($1,'active',$2)",[workspace,plans[input.plan].limit]);
   await recordMemberActivity(tx,id,'account_registered');
   await recordMemberActivity(tx,id,'plan_activated');
   await tx.query("INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,'member_created_with_plan',$3)",[randomUUID(),actor.id,id]);
   return {id,name,email,plan:input.plan};
  })}catch(error){if((error as {code?:string}).code==='23505')throw Error('ACCOUNT_EXISTS');throw error}
 }
 async deleteMember(actor:Account,id:string,email:string){
  if(actor.role!=='owner'||actor.id===id)throw Error('FORBIDDEN');
  return this.db.transaction(async tx=>{
   const owner=(await tx.query<{role:string;email_verified_at:string|null}>('SELECT role,email_verified_at FROM users WHERE id=$1 FOR SHARE',[actor.id])).rows[0];
   if(owner?.role!=='owner')throw Error('FORBIDDEN');
   if(!owner.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');
   const member=(await tx.query<{id:string;workspace_id:string;role:string;email:string}>('SELECT id,workspace_id,role,email FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!member)throw Error('NOT_FOUND');
   if(member.role!=='member'||member.workspace_id===actor.workspace_id)throw Error('FORBIDDEN');
   if(member.email.toLowerCase()!==email.trim().toLowerCase())throw Error('MEMBER_CHANGED');
   const workspace=member.workspace_id;
   // Match sender/worker lock order so no new send can start during removal.
   await tx.query('SELECT workspace_id FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[workspace]);
   await tx.query('SELECT id FROM mail_outbox WHERE user_id=$1 FOR UPDATE',[id]);
   const busy=(await tx.query(`SELECT 1 FROM messages WHERE workspace_id=$1 AND state='sending' UNION ALL SELECT 1 FROM bulk_recipients WHERE workspace_id=$1 AND state='sending' UNION ALL SELECT 1 FROM mail_outbox WHERE user_id=$2 AND state='sending' LIMIT 1`,[workspace,id])).rows.length;
   if(busy)throw Error('MEMBER_BUSY');
   await tx.query('DELETE FROM bulk_campaigns WHERE workspace_id=$1',[workspace]);
   await tx.query('DELETE FROM mail_drafts WHERE workspace_id=$1',[workspace]);
   await tx.query('DELETE FROM messages WHERE workspace_id=$1',[workspace]);
   await tx.query('DELETE FROM sessions WHERE user_id=$1',[id]);
   // Public media and financial/audit records survive without the deleted identity.
   await tx.query('UPDATE blog_media SET owner_id=$2 WHERE owner_id=$1',[id,actor.id]);
   await tx.query('DELETE FROM users WHERE id=$1',[id]);
   await tx.query('DELETE FROM mail_connections WHERE workspace_id=$1',[workspace]);
   await tx.query('DELETE FROM access_grants WHERE workspace_id=$1',[workspace]);
   await tx.query('DELETE FROM preview_purchases WHERE workspace_id=$1',[workspace]);
   await tx.query('DELETE FROM entitlements WHERE workspace_id=$1',[workspace]);
   await tx.query('DELETE FROM workspaces WHERE id=$1',[workspace]);
   await tx.query("INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,'member_deleted',$3)",[randomUUID(),actor.id,id]);
   return {deleted:true};
  });
 }
 async purchases(q='',offset=0){const condition='u.email ILIKE $1 OR u.name ILIKE $1 OR p.id::text ILIKE $1';const total=(await this.db.query<{total:number}>(`SELECT count(*)::int AS total FROM purchases p LEFT JOIN users u ON u.id=p.user_id WHERE ${condition}`,[`%${q}%`])).rows[0].total;const rows=(await this.db.query(`SELECT p.*,COALESCE(u.name,'Silinen üye') AS name,COALESCE(u.email,'Silinen üye') AS email FROM purchases p LEFT JOIN users u ON u.id=p.user_id WHERE ${condition} ORDER BY p.created_at DESC,p.id LIMIT 50 OFFSET $2`,[`%${q}%`,offset])).rows;return {rows,total}}
 async purchase(id:string){return (await this.db.query("SELECT p.*,COALESCE(u.name,'Silinen üye') AS name,COALESCE(u.email,'Silinen üye') AS email,e.used AS current_used,e.message_limit AS current_limit FROM purchases p LEFT JOIN users u ON u.id=p.user_id LEFT JOIN entitlements e ON e.workspace_id=p.workspace_id WHERE p.id=$1",[id])).rows[0]||null}
 async leads(offset=0){return {rows:(await this.db.query('SELECT id,email,company,status,created_at FROM enterprise_requests ORDER BY created_at DESC,id LIMIT 50 OFFSET $1',[offset])).rows,total:(await this.db.query<{total:number}>('SELECT count(*)::int AS total FROM enterprise_requests')).rows[0].total}}
 async markLead(actor:Account,id:string,status:string){await this.db.transaction(async tx=>{const result=await tx.query('UPDATE enterprise_requests SET status=$2 WHERE id=$1 RETURNING id',[id,status]);if(!result.rows.length)throw new Error('NOT_FOUND');await tx.query('INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)',[randomUUID(),actor.id,'enterprise_'+status,id])})}
}
