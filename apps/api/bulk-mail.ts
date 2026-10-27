import {recipientHash,unsubscribeLink} from './unsubscribe';
import {bucketUsed,consumeBucket,releaseBucket,usagePeriod,dateKey} from './package-usage';
import {packagePolicy} from '../../packages/domain/plan-policy';
import {randomUUID,createHash} from 'node:crypto';
import type {DB} from '../../packages/database';
import type {Account} from './accounts';
import type {MailProvider} from '../../packages/provider-adapters';
import {seal,unseal} from '../../packages/runtime/vault';
import {TrackingService} from './service';
import {bulkAllowed,validateBulkInput,renderBulkText,csvCell,type BulkInput,type BulkRecipient,type BulkPreview,type BulkCampaign,type BulkCounts,type BulkDetail} from '../../packages/domain/bulk-mail';
export interface BulkGateway{status(workspace:string,db?:DB):Promise<{configured:boolean;connected:boolean;email:string|null}>;provider(workspace:string):Promise<{provider:MailProvider;from:string}>}
type CampaignRow={quota_period:string|null;scheduled_at:string|null;id:string;workspace_id:string;user_id:string;payload:string;sender_email:string;total:number;status:string;reason:string|null;expires_at:string;created_at:string;content_hash:string};
type RecipientRow={daily_period:string|null;id:string;payload:string;state:string;reserved:boolean;claim_token:string|null;message_id:string|null;error:string|null;sent_at:string|null;started_at:string|null};
type Content={name:string;subject:string;text:string;tracking:boolean;duplicates:number};
type Eligibility={plan:string|null;email_verified_at:string|null;status:string;used:number;message_limit:number;bulk_next_at:string|null};
const blankCounts=():BulkCounts=>({queued:0,sending:0,sent:0,unknown:0,failed:0,cancelled:0});
export class BulkMail{
 constructor(private db:DB,private gateway:BulkGateway,private key:string|undefined,private origin:string,private production=true){}
 private ensureKey(){if(!this.key)throw Error('BULK_UNAVAILABLE');return this.key}
 private content(row:CampaignRow):Content{return JSON.parse(unseal(row.payload,this.ensureKey()))}
 private recipient(row:RecipientRow):BulkRecipient{return JSON.parse(unseal(row.payload,this.ensureKey()))}
 private async lock(tx:DB,workspace:string,userId:string){
  const user=(await tx.query<{email_verified_at:string|null}>('SELECT email_verified_at FROM users WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[userId,workspace])).rows[0];if(!user)throw Error('UNAUTHORIZED');
  const entitlement=(await tx.query<Omit<Eligibility,'plan'|'email_verified_at'>>('SELECT status,used,message_limit,bulk_next_at FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[workspace])).rows[0];if(!entitlement)throw Error('PLAN_REQUIRED');
  const plan=(await tx.query<{plan:string|null}>(`SELECT ${this.production?'g.plan':'COALESCE(g.plan,p.plan)'} AS plan FROM users u LEFT JOIN access_grants g ON g.workspace_id=u.workspace_id LEFT JOIN preview_purchases p ON p.workspace_id=u.workspace_id WHERE u.id=$1`,[userId])).rows[0]?.plan||null;
  return {...user,...entitlement,plan};
 }
 private requireMember(context:Eligibility,premium=false){if(this.production&&!context.email_verified_at)throw Error('EMAIL_NOT_VERIFIED');if(context.status!=='active')throw Error('FORBIDDEN');if(!context.plan)throw Error('PLAN_REQUIRED');if(premium&&!bulkAllowed(context.plan))throw Error('BULK_PLAN_REQUIRED')}
 private async owned(db:DB,user:Account,id:string,locked=false){const row=(await db.query<CampaignRow>('SELECT * FROM bulk_campaigns WHERE id=$1 AND workspace_id=$2 AND user_id=$3'+(locked?' FOR UPDATE':''),[id,user.workspace_id,user.id])).rows[0];if(!row)throw Error('NOT_FOUND');return row}
 private async counts(db:DB,id:string){const counts=blankCounts();for(const row of (await db.query<{state:keyof BulkCounts;count:number}>('SELECT state,count(*)::int AS count FROM bulk_recipients WHERE campaign_id=$1 GROUP BY state',[id])).rows)counts[row.state]=Number(row.count);return counts}
 private async summary(db:DB,row:CampaignRow,counts?:BulkCounts):Promise<BulkCampaign>{const content=this.content(row);return {id:row.id,name:content.name,subject:content.subject,status:row.status,reason:row.reason,sender:row.sender_email,total:row.total,created_at:row.created_at,counts:counts??await this.counts(db,row.id)}}
 async preview(user:Account,input:BulkInput):Promise<BulkPreview>{
  this.ensureKey();const report=validateBulkInput(input);
  return this.db.transaction(async tx=>{
   const context=await this.lock(tx,user.workspace_id,user.id);this.requireMember(context,true);
   if(report.issues.length||!report.recipients.length)return {report};
   const excluded=new Set((await tx.query<{email_hash:string}>('SELECT email_hash FROM mail_suppressions WHERE workspace_id=$1',[user.workspace_id])).rows.map(r=>r.email_hash));report.recipients=report.recipients.filter(r=>!excluded.has(recipientHash(user.workspace_id,r.email)));if(!report.recipients.length){report.issues.push({row:1,message:'Alıcıların tamamı bu göndericiden kampanya e-postası almayı durdurmuş.'});return {report}}
   const connection=await this.gateway.status(user.workspace_id,tx);if(!connection.configured||!connection.connected||!connection.email)throw Error('GMAIL_NOT_CONNECTED');
   const monthly=packagePolicy(context.plan)!.bulkMonthly,period=await usagePeriod(tx,true),remaining=monthly-await bucketUsed(tx,user.workspace_id,'bulk_month',period);if(remaining<report.recipients.length)throw Error('BULK_QUOTA_REQUIRED');
   const content:Content={name:input.name.trim(),subject:input.subject,text:input.text,tracking:input.tracking,duplicates:report.duplicates};
   const hash=createHash('sha256').update(JSON.stringify({content,recipients:report.recipients,sender:connection.email.toLowerCase()})).digest('hex');
   const existing=(await tx.query<CampaignRow>('SELECT * FROM bulk_campaigns WHERE workspace_id=$1 AND request_id=$2',[user.workspace_id,input.requestId])).rows[0];
   if(existing&&existing.content_hash!==hash)throw Error('IDEMPOTENCY_CONFLICT');
   const id=existing?.id||randomUUID();
   if(!existing){await tx.query('INSERT INTO bulk_campaigns(id,workspace_id,user_id,request_id,content_hash,payload,sender_email,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,user.workspace_id,user.id,input.requestId,hash,seal(JSON.stringify(content),this.key!),connection.email.toLowerCase(),report.recipients.length]);
    const recipients=report.recipients.map((recipient,index)=>({id:randomUUID(),position:index,payload:seal(JSON.stringify(recipient),this.key!),suppression_hash:recipientHash(user.workspace_id,recipient.email)}));
    await tx.query(`INSERT INTO bulk_recipients(id,campaign_id,workspace_id,position,payload,suppression_hash) SELECT (item->>'id')::uuid,$1,$2,(item->>'position')::int,item->>'payload',item->>'suppression_hash' FROM jsonb_array_elements($3::jsonb) AS item`,[id,user.workspace_id,JSON.stringify(recipients)]);
   }
   return {report,id,sender:connection.email,remaining,samples:report.recipients.slice(0,3).map(recipient=>({email:recipient.email,subject:renderBulkText(input.subject,recipient),text:renderBulkText(input.text,recipient)}))};
  });
 }
 async confirm(user:Account,id:string,scheduledAt?:string){if(scheduledAt&&(!Number.isFinite(Date.parse(scheduledAt))||Date.parse(scheduledAt)<Date.now()+60000||Date.parse(scheduledAt)>Date.now()+365*86400000))throw Error('INVALID_SCHEDULE');return this.db.transaction(async tx=>{
  const context=await this.lock(tx,user.workspace_id,user.id);this.requireMember(context,true);const campaign=await this.owned(tx,user,id,true);
  if(campaign.status!=='draft')return {id:campaign.id,status:campaign.status,replay:true};
  if(Date.parse(campaign.expires_at)<=Date.now())throw Error('BULK_PREVIEW_EXPIRED');
  const connection=await this.gateway.status(user.workspace_id,tx);if(!connection.connected||!connection.configured||connection.email?.toLowerCase()!==campaign.sender_email)throw Error('BULK_SENDER_CHANGED');
  if((await tx.query("SELECT id FROM bulk_campaigns WHERE workspace_id=$1 AND status IN ('queued','running','paused') LIMIT 1",[user.workspace_id])).rows.length)throw Error('BULK_ACTIVE_CAMPAIGN');
  const period=scheduledAt?(await tx.query<{period:string}>("SELECT date_trunc('month',$1::timestamptz AT TIME ZONE 'Europe/Istanbul')::date::text AS period",[scheduledAt])).rows[0].period:await usagePeriod(tx,true);try{await consumeBucket(tx,user.workspace_id,'bulk_month',period,campaign.total,packagePolicy(context.plan)!.bulkMonthly)}catch{throw Error('BULK_QUOTA_REQUIRED')}
  await tx.query('UPDATE entitlements SET used=used+$2 WHERE workspace_id=$1',[user.workspace_id,campaign.total]);
  await tx.query('UPDATE bulk_recipients SET reserved=true WHERE campaign_id=$1',[id]);
  await tx.query("UPDATE bulk_campaigns SET status='queued',reason=NULL,updated_at=now(),scheduled_at=$2,quota_period=$3 WHERE id=$1",[id,scheduledAt?new Date(scheduledAt):null,period]);return {id,status:'queued',replay:false};
 })}
 async list(user:Account){
  const rows=(await this.db.query<CampaignRow>("SELECT * FROM bulk_campaigns WHERE workspace_id=$1 AND user_id=$2 AND status<>'draft' ORDER BY created_at DESC,id DESC LIMIT 20",[user.workspace_id,user.id])).rows;
  if(!rows.length)return {campaigns:[]};
  // Aggregate only this page's recipients in one round trip instead of one
  // query per campaign competing for the shared connection pool.
  const counts=new Map(rows.map(row=>[row.id,blankCounts()]));
  for(const row of (await this.db.query<{campaign_id:string;state:keyof BulkCounts;count:number}>('SELECT campaign_id,state,count(*)::int AS count FROM bulk_recipients WHERE workspace_id=$1 AND campaign_id=ANY($2::uuid[]) GROUP BY campaign_id,state',[user.workspace_id,rows.map(row=>row.id)])).rows)counts.get(row.campaign_id)![row.state]=Number(row.count);
  return {campaigns:await Promise.all(rows.map(row=>this.summary(this.db,row,counts.get(row.id))))};
 }
 async detail(user:Account,id:string,offset=0):Promise<BulkDetail>{const row=await this.owned(this.db,user,id);if(row.status==='draft')throw Error('NOT_FOUND');const recipients=(await this.db.query<RecipientRow>('SELECT * FROM bulk_recipients WHERE campaign_id=$1 ORDER BY position LIMIT 50 OFFSET $2',[id,offset])).rows;const content=this.content(row);return {...await this.summary(this.db,row),text:content.text,tracking:content.tracking,recipients:recipients.map(recipient=>({id:recipient.id,...this.recipient(recipient),state:recipient.state,message_id:recipient.message_id,error:recipient.error,sent_at:recipient.sent_at})),offset,hasMore:offset+recipients.length<row.total}}
 async control(user:Account,id:string,action:'pause'|'resume'|'cancel'){return this.db.transaction(async tx=>{
  const context=await this.lock(tx,user.workspace_id,user.id);this.requireMember(context,action==='resume');const campaign=await this.owned(tx,user,id,true);
  if(['draft','completed','cancelled'].includes(campaign.status))throw Error('BULK_INVALID_STATE');
  if(action==='cancel'){
   const released=(await tx.query<{id:string;daily_period:string|null}>("UPDATE bulk_recipients SET state='cancelled',reserved=false,claim_token=NULL,error=NULL WHERE campaign_id=$1 AND reserved=true AND message_id IS NULL AND state IN ('queued','sending') RETURNING id,daily_period",[id])).rows;
   if(released.length){await tx.query('UPDATE entitlements SET used=used-$2 WHERE workspace_id=$1',[user.workspace_id,released.length]);if(campaign.quota_period)await releaseBucket(tx,user.workspace_id,'bulk_month',dateKey(campaign.quota_period),released.length);for(const row of released)if(row.daily_period)await releaseBucket(tx,user.workspace_id,'bulk_day',dateKey(row.daily_period),1)}
   await tx.query("UPDATE bulk_campaigns SET status='cancelled',reason=NULL,updated_at=now() WHERE id=$1",[id]);return {ok:true};
  }
  if(action==='resume'){const connection=await this.gateway.status(user.workspace_id,tx);if(!connection.configured||!connection.connected||connection.email?.toLowerCase()!==campaign.sender_email)throw Error('BULK_SENDER_CHANGED');
   const counts=await this.counts(tx,id);await tx.query('UPDATE bulk_campaigns SET status=$2,reason=NULL,updated_at=now() WHERE id=$1',[id,counts.queued||counts.sending?'queued':'completed']);
  }else await tx.query("UPDATE bulk_campaigns SET status='paused',reason='USER_PAUSED',updated_at=now() WHERE id=$1",[id]);return {ok:true};
 })}
 async report(user:Account,id:string){const campaign=await this.owned(this.db,user,id);if(campaign.status==='draft')throw Error('NOT_FOUND');const rows=(await this.db.query<RecipientRow>('SELECT * FROM bulk_recipients WHERE campaign_id=$1 ORDER BY position',[id])).rows;return '\uFEFF'+[['email','ad','soyad','sirket','hitap','durum','gonderim_zamani'],...rows.map(row=>{const r=this.recipient(row);return [r.email,r.ad,r.soyad,r.sirket,r.hitap||'',row.state,row.sent_at?new Date(row.sent_at).toISOString():'']})].map(row=>row.map(csvCell).join(',')).join('\r\n')}
 private async pauseClaim(campaign:CampaignRow,recipient:RecipientRow,reason:string){await this.db.transaction(async tx=>{await this.lock(tx,campaign.workspace_id,campaign.user_id);await tx.query('SELECT id FROM bulk_campaigns WHERE id=$1 FOR UPDATE',[campaign.id]);if(recipient.daily_period){await releaseBucket(tx,campaign.workspace_id,'bulk_day',dateKey(recipient.daily_period),1)}await tx.query("UPDATE bulk_recipients SET state='queued',claim_token=NULL,started_at=NULL,daily_period=NULL WHERE id=$1 AND claim_token=$2 AND state='sending' AND message_id IS NULL",[recipient.id,recipient.claim_token]);await tx.query("UPDATE bulk_campaigns SET status='paused',reason=$2,updated_at=now() WHERE id=$1 AND status IN ('queued','running')",[campaign.id,reason])})}
 private async finish(campaign:CampaignRow,recipient:RecipientRow,state:'sent'|'unknown'|'failed',messageId:string){await this.db.transaction(async tx=>{await this.lock(tx,campaign.workspace_id,campaign.user_id);await tx.query('SELECT id FROM bulk_campaigns WHERE id=$1 FOR UPDATE',[campaign.id]);if(state==='failed'){await tx.query('UPDATE entitlements SET used=greatest(0,used-1) WHERE workspace_id=$1',[campaign.workspace_id]);if(campaign.quota_period)await releaseBucket(tx,campaign.workspace_id,'bulk_month',dateKey(campaign.quota_period),1);if(recipient.daily_period)await releaseBucket(tx,campaign.workspace_id,'bulk_day',dateKey(recipient.daily_period),1)}if(state==='unknown')await tx.query("UPDATE messages SET state='unknown' WHERE id=$1 AND workspace_id=$2 AND state='sending'",[messageId,campaign.workspace_id]);await tx.query("UPDATE bulk_recipients SET state=$3,message_id=$4,sent_at=CASE WHEN $3='sent' THEN now() ELSE NULL END,error=CASE WHEN $3='unknown' THEN 'OUTCOME_UNKNOWN' ELSE NULL END,claim_token=NULL WHERE id=$1 AND claim_token=$2 AND state='sending'",[recipient.id,recipient.claim_token,state,messageId]);const counts=await this.counts(tx,campaign.id);const next=counts.queued||counts.sending?(state==='unknown'?'paused':'running'):'completed';await tx.query("UPDATE bulk_campaigns SET status=$2,reason=$3,updated_at=now() WHERE id=$1 AND status IN ('queued','running')",[campaign.id,next,state==='unknown'?'OUTCOME_UNKNOWN':null])})}
 async recoverOne(){
  const stale=(await this.db.query<CampaignRow&{recipient_id:string}>("SELECT c.*,r.id AS recipient_id FROM bulk_recipients r JOIN bulk_campaigns c ON c.id=r.campaign_id WHERE r.state='sending' AND r.started_at<now()-interval '2 minutes' ORDER BY r.started_at LIMIT 1")).rows[0];if(!stale)return false;
  await this.db.transaction(async tx=>{await this.lock(tx,stale.workspace_id,stale.user_id);await tx.query('SELECT id FROM bulk_campaigns WHERE id=$1 FOR UPDATE',[stale.id]);const recipient=(await tx.query<RecipientRow>("SELECT * FROM bulk_recipients WHERE id=$1 AND state='sending' AND started_at<now()-interval '2 minutes' FOR UPDATE",[stale.recipient_id])).rows[0];if(!recipient)return;
   let state='failed',reason='INTERRUPTED_BEFORE_SEND';if(recipient.message_id){const message=(await tx.query<{state:string}>('SELECT state FROM messages WHERE id=$1 AND workspace_id=$2',[recipient.message_id,stale.workspace_id])).rows[0];state=message?.state==='sent'?'sent':'unknown';reason=state==='sent'?'':'OUTCOME_UNKNOWN';await tx.query("UPDATE messages SET state='unknown' WHERE id=$1 AND workspace_id=$2 AND state='sending'",[recipient.message_id,stale.workspace_id]);}
   if(recipient.reserved){await tx.query('UPDATE entitlements SET used=used-1 WHERE workspace_id=$1',[stale.workspace_id]);if(stale.quota_period)await releaseBucket(tx,stale.workspace_id,'bulk_month',dateKey(stale.quota_period),1);if(recipient.daily_period)await releaseBucket(tx,stale.workspace_id,'bulk_day',dateKey(recipient.daily_period),1);}
   await tx.query("UPDATE bulk_recipients SET state=$2,reserved=false,claim_token=NULL,error=$3,sent_at=CASE WHEN $2='sent' THEN now() ELSE NULL END WHERE id=$1",[recipient.id,state,reason||null]);
   const counts=await this.counts(tx,stale.id);await tx.query("UPDATE bulk_campaigns SET status=$2,reason=$3,updated_at=now() WHERE id=$1 AND status IN ('queued','running')",[stale.id,counts.queued||counts.sending?'paused':'completed',reason||null]);
  });return true;
 }
 async processOne(){
  this.ensureKey();if(await this.recoverOne())return true;
  await this.db.query("UPDATE bulk_campaigns SET status='queued',reason=NULL WHERE status='paused' AND reason='DAILY_QUOTA' AND (updated_at AT TIME ZONE 'Europe/Istanbul')::date<(now() AT TIME ZONE 'Europe/Istanbul')::date");
  await this.db.query("UPDATE bulk_campaigns SET status='queued',reason=NULL WHERE status='paused' AND reason='MONTHLY_QUOTA' AND date_trunc('month',updated_at AT TIME ZONE 'Europe/Istanbul')<date_trunc('month',now() AT TIME ZONE 'Europe/Istanbul')");
  const candidate=(await this.db.query<CampaignRow>("SELECT * FROM bulk_campaigns c WHERE status IN ('queued','running') AND (scheduled_at IS NULL OR scheduled_at<=now()) AND EXISTS(SELECT 1 FROM bulk_recipients r WHERE r.campaign_id=c.id AND r.state='queued') ORDER BY updated_at,id LIMIT 1")).rows[0];if(!candidate)return false;
  const claimed=await this.db.transaction(async tx=>{
   const context=await this.lock(tx,candidate.workspace_id,candidate.user_id);const campaign=(await tx.query<CampaignRow>('SELECT * FROM bulk_campaigns WHERE id=$1 FOR UPDATE',[candidate.id])).rows[0];if(!['queued','running'].includes(campaign.status))return null;
   if((this.production&&!context.email_verified_at)||context.status!=='active'||!bulkAllowed(context.plan)){await tx.query("UPDATE bulk_campaigns SET status='paused',reason='MEMBERSHIP_REQUIRED',updated_at=now() WHERE id=$1",[campaign.id]);return null}
   if(context.bulk_next_at&&Date.parse(context.bulk_next_at)>Date.now())return null;
   const connection=await this.gateway.status(campaign.workspace_id,tx);if(!connection.configured||!connection.connected||connection.email?.toLowerCase()!==campaign.sender_email){await tx.query("UPDATE bulk_campaigns SET status='paused',reason='CONNECTION_REQUIRED',updated_at=now() WHERE id=$1",[campaign.id]);return null}
   const currentMonth=await usagePeriod(tx,true);if(campaign.quota_period&&dateKey(campaign.quota_period)!==currentMonth){const pending=Number((await tx.query<{total:string}>("SELECT count(*) AS total FROM bulk_recipients WHERE campaign_id=$1 AND reserved=true",[campaign.id])).rows[0].total);try{await consumeBucket(tx,campaign.workspace_id,'bulk_month',currentMonth,pending,packagePolicy(context.plan)!.bulkMonthly)}catch{await tx.query("UPDATE bulk_campaigns SET status='paused',reason='MONTHLY_QUOTA',updated_at=now() WHERE id=$1",[campaign.id]);return null}await releaseBucket(tx,campaign.workspace_id,'bulk_month',dateKey(campaign.quota_period),pending);await tx.query('UPDATE bulk_campaigns SET quota_period=$2 WHERE id=$1',[campaign.id,currentMonth]);campaign.quota_period=currentMonth}
   const recipient=(await tx.query<RecipientRow>("SELECT * FROM bulk_recipients WHERE campaign_id=$1 AND state='queued' ORDER BY position LIMIT 1 FOR UPDATE",[campaign.id])).rows[0];if(!recipient)return null;
   const daily=await usagePeriod(tx,false);try{await consumeBucket(tx,campaign.workspace_id,'bulk_day',daily,1,packagePolicy(context.plan)!.bulkDaily)}catch{await tx.query("UPDATE bulk_campaigns SET status='paused',reason='DAILY_QUOTA',updated_at=now() WHERE id=$1",[campaign.id]);return null}
   const lease=randomUUID();await tx.query("UPDATE bulk_recipients SET state='sending',claim_token=$2,started_at=now(),daily_period=$3 WHERE id=$1",[recipient.id,lease,daily]);await tx.query("UPDATE entitlements SET bulk_next_at=now()+interval '3 seconds' WHERE workspace_id=$1",[campaign.workspace_id]);await tx.query("UPDATE bulk_campaigns SET status='running',updated_at=now() WHERE id=$1",[campaign.id]);return {campaign,recipient:{...recipient,state:'sending',claim_token:lease,daily_period:daily}};
  });if(!claimed)return false;
  const{campaign,recipient}=claimed;let connection:Awaited<ReturnType<BulkGateway['provider']>>;
  try{connection=await this.gateway.provider(campaign.workspace_id);if(connection.from.toLowerCase()!==campaign.sender_email)throw Error('BULK_SENDER_CHANGED')}catch{await this.pauseClaim(campaign,recipient,'CONNECTION_REQUIRED');return true}
  try{const content=this.content(campaign),contact=this.recipient(recipient),service=new TrackingService(this.db,connection.provider,this.origin,connection.from,this.key);const result=await service.send(campaign.workspace_id,'bulk_'+recipient.id,{to:contact.email,subject:renderBulkText(content.subject,contact),text:renderBulkText(content.text,contact),tracking:content.tracking,unsubscribe:await unsubscribeLink(this.db,campaign.workspace_id,contact.email,this.origin)},{recipientId:recipient.id,lease:recipient.claim_token!},undefined,'bulk');await this.finish(campaign,recipient,result.state==='sent'?'sent':result.state==='failed'?'failed':'unknown',result.id)}catch{
   const row=(await this.db.query<{message_id:string|null;state:string}>('SELECT message_id,state FROM bulk_recipients WHERE id=$1',[recipient.id])).rows[0];if(row?.message_id){const message=(await this.db.query<{state:string}>('SELECT state FROM messages WHERE id=$1',[row.message_id])).rows[0];await this.finish(campaign,recipient,message?.state==='sent'?'sent':'unknown',row.message_id)}else await this.pauseClaim(campaign,recipient,'PREPARATION_FAILED');
  }return true;
 }
 async cleanup(){await this.db.query("DELETE FROM bulk_campaigns WHERE status='draft' AND expires_at<now()")}
}
