import {randomUUID} from 'node:crypto';
import type {DB} from '../../packages/database';
import type {Account} from './accounts';
import {mailDraftLimit} from '../../packages/domain/commercial-plans';
import {validMailDraft,type MailDraftInput,type MailDraft,type MailDraftList} from '../../packages/domain/mail-drafts';
import {seal,unseal} from '../../packages/runtime/vault';
type Row={id:string;payload:string;version:number;created_at:string;updated_at:string};
export class MailDrafts{
 constructor(private db:DB,private key:string|undefined,private production:boolean){}
 private async context(tx:DB,user:Account){
  if(this.production&&!this.key)throw Error('DRAFTS_UNAVAILABLE');
  const owner=(await tx.query<{email_verified_at:string|null}>('SELECT email_verified_at FROM users WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[user.id,user.workspace_id])).rows[0];
  if(!owner)throw Error('UNAUTHORIZED');
  if(this.production&&!owner.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');
  const entitlement=(await tx.query<{status:string}>('SELECT status FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[user.workspace_id])).rows[0];
  if(!entitlement||!(this.production?['active']:['active','local_test']).includes(entitlement.status))throw Error('FORBIDDEN');
  const plan=(await tx.query<{plan:string|null}>(`SELECT ${this.production?'g.plan':'COALESCE(g.plan,p.plan)'} AS plan FROM users u LEFT JOIN access_grants g ON g.workspace_id=u.workspace_id LEFT JOIN preview_purchases p ON p.workspace_id=u.workspace_id WHERE u.id=$1`,[user.id])).rows[0]?.plan;
  const limit=mailDraftLimit(plan);if(!limit)throw Error('PLAN_REQUIRED');
  const rows=(await tx.query<Row>('SELECT id,payload,version,created_at,updated_at FROM mail_drafts WHERE workspace_id=$1 AND user_id=$2 AND deleted_at IS NULL ORDER BY created_at,id',[user.workspace_id,user.id])).rows;
  return {limit,rows};
 }
 private decode(row:Row,locked:boolean):MailDraft{
  const input=JSON.parse(this.key?unseal(row.payload,this.key):row.payload) as MailDraftInput;
  return {...input,...(locked?{to:'',text:''}:{}),id:row.id,version:row.version,created_at:row.created_at,updated_at:row.updated_at,locked};
 }
 async list(user:Account):Promise<MailDraftList>{return this.db.transaction(async tx=>{const{limit,rows}=await this.context(tx,user);return {limit,used:rows.length,drafts:rows.map((row,index)=>this.decode(row,index>=limit))}})}
 async get(user:Account,id:string){return this.db.transaction(async tx=>{const{limit,rows}=await this.context(tx,user),index=rows.findIndex(row=>row.id===id);if(index<0)throw Error('NOT_FOUND');if(index>=limit)throw Error('DRAFT_PLAN_LIMIT');return this.decode(rows[index],false)})}
 async save(user:Account,input:MailDraftInput,id?:string,version?:number){
  if(!validMailDraft(input))throw Error('INVALID_DRAFT');
  return this.db.transaction(async tx=>{
   const{limit,rows}=await this.context(tx,user);
   let index=-1;
   if(id){index=rows.findIndex(row=>row.id===id);if(index<0)throw Error('NOT_FOUND');if(index>=limit)throw Error('DRAFT_PLAN_LIMIT');if(rows[index].version!==version)throw Error('STALE_DRAFT')}
   else if(rows.length>=limit)throw Error('DRAFT_LIMIT_REACHED');
   const payload=JSON.stringify({...input,title:input.title.trim(),to:input.to.trim()});
   const encrypted=this.key?seal(payload,this.key):payload;
   const result=id?await tx.query<Row>('UPDATE mail_drafts SET payload=$4,version=version+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND user_id=$3 AND deleted_at IS NULL RETURNING id,payload,version,created_at,updated_at',[id,user.workspace_id,user.id,encrypted]):await tx.query<Row>('INSERT INTO mail_drafts(id,workspace_id,user_id,payload) VALUES($1,$2,$3,$4) RETURNING id,payload,version,created_at,updated_at',[randomUUID(),user.workspace_id,user.id,encrypted]);
   return this.decode(result.rows[0],false);
  });
 }
 async remove(user:Account,id:string,version:number){return this.db.transaction(async tx=>{const{rows}=await this.context(tx,user),row=rows.find(row=>row.id===id);if(!row)throw Error('NOT_FOUND');if(row.version!==version)throw Error('STALE_DRAFT');await tx.query('UPDATE mail_drafts SET deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1 AND workspace_id=$2 AND user_id=$3',[id,user.workspace_id,user.id]);return {ok:true}})}
}
