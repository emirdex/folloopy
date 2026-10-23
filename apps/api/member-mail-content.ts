import {randomUUID} from 'node:crypto';
import type {DB} from '../../packages/database';
import type {Account} from './accounts';
import {seal,unseal} from '../../packages/runtime/vault';
import type {SendInput} from './service';
const configured=(key?:string)=>!!key&&Buffer.from(key,'base64').length===32;

/** Called inside the sender's entitlement lock, before any provider request. */
export async function captureMailContent(tx:DB,workspace:string,id:string,from:string,input:SendInput,key?:string){
 const setting=(await tx.query<{enabled:boolean}>('SELECT enabled FROM member_mail_storage WHERE workspace_id=$1',[workspace])).rows[0];
 if(!setting?.enabled)return;
 if(!configured(key))throw Error('MAIL_CONTENT_UNAVAILABLE');
 const payload=seal(JSON.stringify({workspaceId:workspace,messageId:id,from,to:input.to,subject:input.subject,text:input.text}),key!);
 await tx.query('INSERT INTO message_content_archive(message_id,workspace_id,payload) VALUES($1,$2,$3)',[id,workspace,payload]);
}
export class MemberMailContent{
 constructor(private db:DB,private key?:string){}
 private async owner(tx:DB,actor:Account,exclusive=false){
  if(actor.role!=='owner')throw Error('FORBIDDEN');
  const row=(await tx.query<{role:string;email_verified_at:string|null}>(`SELECT role,email_verified_at FROM users WHERE id=$1 ${exclusive?'FOR UPDATE':'FOR SHARE'}`,[actor.id])).rows[0];
  if(row?.role!=='owner')throw Error('FORBIDDEN');
  if(!row.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');
 }
 async configure(actor:Account,id:string,enabled:boolean){
  if(typeof enabled!=='boolean')throw Error('INVALID_REQUEST');
  return this.db.transaction(async tx=>{
   await this.owner(tx,actor,true);
   const user=(await tx.query<{workspace_id:string}>('SELECT workspace_id FROM users WHERE id=$1 FOR UPDATE',[id])).rows[0];
   if(!user)throw Error('NOT_FOUND');
   if(enabled&&!configured(this.key))throw Error('MAIL_CONTENT_UNAVAILABLE');
   // Serialize the boundary with sending: an earlier send is never backfilled.
   await tx.query('SELECT workspace_id FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[user.workspace_id]);
   const prior=(await tx.query<{enabled:boolean;updated_at:string}>('SELECT enabled,updated_at FROM member_mail_storage WHERE user_id=$1',[id])).rows[0];
   if((prior?.enabled??false)===enabled)return {enabled,updated_at:prior?.updated_at??null};
   const result=(await tx.query<{enabled:boolean;updated_at:string}>('INSERT INTO member_mail_storage(user_id,workspace_id,enabled,updated_by) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,updated_at=now(),updated_by=excluded.updated_by RETURNING enabled,updated_at',[id,user.workspace_id,enabled,actor.id])).rows[0];
   await tx.query('INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,$3,$4)',[randomUUID(),actor.id,enabled?'mail_content_storage_enabled':'mail_content_storage_disabled',id]);
   return result;
  });
 }
 async read(actor:Account,id:string,messageId:string){
  return this.db.transaction(async tx=>{
   await this.owner(tx,actor);
   const user=(await tx.query<{workspace_id:string}>('SELECT workspace_id FROM users WHERE id=$1 FOR SHARE',[id])).rows[0];
   if(!user)throw Error('NOT_FOUND');
   const row=(await tx.query<{id:string;subject:string;state:string;sent_at:string|null;created_at:string;payload:string|null;captured_at:string|null}>('SELECT m.id,m.subject,m.state,m.sent_at,m.created_at,a.payload,a.captured_at FROM messages m LEFT JOIN message_content_archive a ON a.message_id=m.id AND a.workspace_id=m.workspace_id WHERE m.workspace_id=$1 AND m.id=$2',[user.workspace_id,messageId])).rows[0];
   if(!row)throw Error('NOT_FOUND');
   if(!row.payload)throw Error('MAIL_CONTENT_NOT_STORED');
   if(!configured(this.key))throw Error('MAIL_CONTENT_UNAVAILABLE');
   let content:{workspaceId:string;messageId:string;from:string;to:string;subject:string;text:string};
   try{content=JSON.parse(unseal(row.payload,this.key!));if(content.workspaceId!==user.workspace_id||content.messageId!==messageId||!['from','to','subject','text'].every(field=>typeof content[field as keyof typeof content]==='string'))throw Error('INVALID_CONTENT')}
   catch{throw Error('MAIL_CONTENT_UNAVAILABLE')}
   await tx.query("INSERT INTO admin_audit(id,actor_id,action,target_id) VALUES($1,$2,'mail_content_viewed',$3)",[randomUUID(),actor.id,messageId]);
   return {id:row.id,subject:content.subject,from:content.from,to:content.to,text:content.text,state:row.state,sent_at:row.sent_at,created_at:row.created_at,captured_at:row.captured_at};
  });
 }
}
