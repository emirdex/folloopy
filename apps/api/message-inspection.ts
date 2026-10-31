import type {DB} from '../../packages/database';
import {seal,unseal} from '../../packages/runtime/vault';
import {tokenHash} from '../../packages/domain/tracking';
import {mailRecipients} from '../../packages/domain/recipients';
import type {MessageRecipients} from '../../packages/domain/message-inspection';
import {filePolicy} from '../../packages/domain/file-sharing';
import {membershipPolicy} from './package-usage';
import type {SendInput} from './service';
function fileTokens(text:string){
 const hashes=new Set<string>();
 for(const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)){
  try{const url=new URL(match[0].replace(/[.,;!?]+$/,'')),token=url.pathname.match(/^\/dosya\/([A-Za-z0-9_-]{43})$/)?.[1];if(token)hashes.add(tokenHash(token))}catch{}
  if(hashes.size>=10)break;
 }
 return [...hashes];
}
export async function captureMessageInspection(tx:DB,workspace:string,id:string,input:SendInput,key?:string){
 if(key){const {to,cc,bcc}=mailRecipients(input);await tx.query('INSERT INTO message_recipient_details(message_id,workspace_id,payload) VALUES($1,$2,$3)',[id,workspace,seal(JSON.stringify({to,cc,bcc}),key)])}
 const hashes=fileTokens(input.text+'\n'+(input.html||''));
 if(hashes.length)await tx.query(`INSERT INTO message_file_shares(message_id,workspace_id,share_id)
  SELECT $1,$2,s.id FROM file_shares s JOIN shared_files f ON f.id=s.file_id
  WHERE f.workspace_id=$2 AND s.token_hash=ANY($3::text[]) ON CONFLICT DO NOTHING`,[id,workspace,hashes]);
}
export async function inspectMessageMetadata(db:DB,workspace:string,id:string,count:number,key?:string){
 return db.transaction(async tx=>{await tx.query('SELECT workspace_id FROM entitlements WHERE workspace_id=$1 FOR SHARE',[workspace]);return readMessageMetadata(tx,workspace,id,count,key)});
}
async function readMessageMetadata(db:DB,workspace:string,id:string,count:number,key?:string){
 let recipients:MessageRecipients={to:[],cc:[],bcc:[],complete:false,source:'unavailable'},legacyText='';
 const row=(await db.query<{payload:string}>('SELECT payload FROM message_recipient_details WHERE workspace_id=$1 AND message_id=$2',[workspace,id])).rows[0];
 if(row&&key){try{const decoded=JSON.parse(unseal(row.payload,key));const normalized=mailRecipients({to:decoded.to.join(', '),cc:decoded.cc,bcc:decoded.bcc});recipients={to:normalized.to,cc:normalized.cc,bcc:normalized.bcc,complete:true,source:'recorded'}}catch{}}
 if(recipients.source==='unavailable'&&key){
  const bulk=(await db.query<{payload:string;content:string}>(`SELECT r.payload,c.payload AS content FROM bulk_recipients r JOIN bulk_campaigns c ON c.id=r.campaign_id AND c.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND r.message_id=$2 LIMIT 1`,[workspace,id])).rows[0];
  if(bulk)try{const contact=JSON.parse(unseal(bulk.payload,key)),content=JSON.parse(unseal(bulk.content,key));const parsed=mailRecipients({to:contact.email});recipients={to:parsed.to,cc:[],bcc:[],complete:count===1,source:'bulk'};legacyText=typeof content.text==='string'?content.text:''}catch{}
  if(recipients.source==='unavailable'){
   const archive=(await db.query<{payload:string}>('SELECT payload FROM message_content_archive WHERE workspace_id=$1 AND message_id=$2',[workspace,id])).rows[0];
   if(archive)try{const content=JSON.parse(unseal(archive.payload,key));if(content.workspaceId===workspace&&content.messageId===id){const parsed=mailRecipients({to:content.to});recipients={to:parsed.to,cc:[],bcc:[],complete:parsed.count===count,source:'archive'};legacyText=typeof content.text==='string'?content.text:''}}catch{}
  }
 }
 const {plan}=await membershipPolicy(db,workspace),policy=filePolicy(plan);
 if(!policy.files)return {recipients,fileEvents:[]};
 // Match the existing file entitlement rules, including locked files after a downgrade.
 const rows=(await db.query<{id:string;size:number;extension:string}>('SELECT id,size,extension FROM shared_files WHERE workspace_id=$1 ORDER BY created_at,id',[workspace])).rows.filter(f=>f.size<=policy.fileBytes&&policy.extensions.includes(f.extension));
 let bytes=0;const allowed=rows.slice(0,policy.files).filter(f=>(bytes+=f.size)<=policy.storageBytes).map(f=>f.id);
 if(!allowed.length)return {recipients,fileEvents:[]};
 const shares=(await db.query<{id:string}>(`SELECT s.id FROM file_shares s JOIN shared_files f ON f.id=s.file_id WHERE f.workspace_id=$1 AND f.id=ANY($3::uuid[]) AND
  (EXISTS(SELECT 1 FROM message_file_shares ms WHERE ms.workspace_id=$1 AND ms.message_id=$2 AND ms.share_id=s.id) OR s.token_hash=ANY($4::text[]))`,[workspace,id,allowed,fileTokens(legacyText)])).rows.map(s=>s.id);
 if(!shares.length)return {recipients,fileEvents:[]};
 const fileEvents=(await db.query(`SELECT e.id,f.name,s.label,e.kind,e.source,e.page,e.seconds,e.created_at FROM file_events e JOIN file_shares s ON s.id=e.share_id JOIN shared_files f ON f.id=s.file_id
  WHERE f.workspace_id=$1 AND s.id=ANY($2::uuid[]) AND e.created_at>now()-($3::text||' days')::interval AND ($4 OR e.kind NOT IN ('page_view','active_time')) ORDER BY e.created_at DESC,e.id LIMIT 20`,[workspace,shares,policy.days,policy.advanced])).rows;
 return {recipients,fileEvents};
}
