import {ProviderRejected} from '../../packages/provider-adapters';
import {releaseBucket,usagePeriod} from './package-usage';
import {unseal} from '../../packages/runtime/vault';
import {membershipPolicy} from './package-usage';
import {buildMailMime,validateRichMessage,type RichMessage} from './mail-format';
import {prepareLinks} from './link-tracking';
import {consumeFreeSend} from './free-usage';
import {fileMailHtml} from '../../packages/domain/file-mail';
import {captureMailContent} from './member-mail-content';
import { randomUUID } from 'node:crypto';
import type { DB } from '../../packages/database/index';
import { token,tokenHash } from '../../packages/domain/tracking';
import type { MailProvider } from '../../packages/provider-adapters/index';
const activityJoin=`LEFT JOIN LATERAL (
 SELECT count(*)::int AS activity_count,min(e.occurred_at) AS first_activity_at,max(e.occurred_at) AS last_activity_at
 FROM raw_events e LEFT JOIN event_assessments a ON a.event_id=e.id AND a.workspace_id=e.workspace_id
 WHERE e.workspace_id=m.workspace_id AND e.message_id=m.id AND e.kind='image_fetch' AND m.state='sent'
 AND (a.source IS NULL OR a.source IN ('unknown','likely_human'))
) activity ON true`;
export const LOCAL_WORKSPACE='00000000-0000-4000-8000-000000000001';
export interface SendInput extends RichMessage {tracking:boolean;unsubscribe?:string}
export async function seedLocal(db:DB){
 await db.transaction(async tx=>{
  await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[LOCAL_WORKSPACE,'Folloopy çalışma alanı']);
  await tx.query("INSERT INTO entitlements(workspace_id,status,message_limit) VALUES($1,'local_test',1000) ON CONFLICT DO NOTHING",[LOCAL_WORKSPACE]);
 });
}
export class TrackingService {
 constructor(readonly db:DB,private provider:MailProvider,private origin:string,private from='local-test@example.invalid',private archiveKey?:string){}
 async send(workspace:string,key:string,input:SendInput,reservation?:{recipientId:string;lease:string},authorize?:(tx:DB)=>Promise<void>,channel:'panel'|'extension'|'bulk'|'legacy'='legacy'){
  validateRichMessage(input);
  if(/[\r\n]/.test(this.from)||/[\r\n]/.test(input.to)||/[\r\n]/.test(input.subject))throw new Error('INVALID_MESSAGE');
  const hash=tokenHash(JSON.stringify({...input,unsubscribe:undefined}));
  const prepared=await this.db.transaction(async tx=>{
   // Tek workspace kilidi: aynı idempotency key ve son kota hakkı eşzamanlı tüketilemez.
   const entitlement=(await tx.query<{status:string;used:number;message_limit:number}>('SELECT * FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[workspace])).rows[0];
   if(!entitlement) throw new Error('FORBIDDEN');
   if(authorize)await authorize(tx);
   const existing=(await tx.query<{id:string;state:string;payload_hash:string}>('SELECT id,state,payload_hash FROM messages WHERE workspace_id=$1 AND idempotency_key=$2',[workspace,key])).rows[0];
   if(existing){if(existing.payload_hash!==hash) throw new Error('IDEMPOTENCY_CONFLICT');return {id:existing.id,state:existing.state,replay:true};}
   if((await tx.query('SELECT 1 FROM expired_submissions WHERE workspace_id=$1 AND idempotency_key=$2',[workspace,key])).rows.length)throw Error('SUBMISSION_EXPIRED');
   const {plan,policy}=await membershipPolicy(tx,workspace);const free=plan==='free';
   if(!['active','local_test'].includes(entitlement.status)||(!policy&&!reservation&&entitlement.used>=entitlement.message_limit)) throw new Error('LIMIT_REACHED');
   if(reservation){const reserved=(await tx.query(`SELECT r.id FROM bulk_recipients r JOIN bulk_campaigns c ON c.id=r.campaign_id JOIN users u ON u.id=c.user_id JOIN access_grants g ON g.workspace_id=c.workspace_id JOIN mail_connections mc ON mc.workspace_id=c.workspace_id WHERE r.id=$1 AND r.workspace_id=$2 AND r.claim_token=$3 AND r.state='sending' AND r.reserved=true AND r.message_id IS NULL AND c.status IN ('queued','running') AND g.plan IN ('team','business') AND u.email_verified_at IS NOT NULL AND lower(mc.email)=lower($4)`,[reservation.recipientId,workspace,reservation.lease,this.from])).rows.length;if(!reserved)throw Error('BULK_RESERVATION_INVALID')}
   if(free){if(reservation)throw Error('BULK_PLAN_REQUIRED');await consumeFreeSend(tx,workspace,this.provider.name==='gmail'?this.from:undefined)}
   const id=randomUUID(),submission=randomUUID(),secret=token(),rfc=`<${submission}@${new URL(this.origin).hostname}>`;
   await tx.query(`INSERT INTO messages(id,workspace_id,submission_id,idempotency_key,payload_hash,subject,recipient_count,state,provider,rfc_message_id,tracking_enabled,send_channel,package_plan,tracking_expires_at,first_open_only)
    VALUES($1,$2,$3,$4,$5,$6,$11,'sending',$7,$8,$9,$10,$12,CASE WHEN $13::int IS NOT NULL THEN now()+($13::text||' days')::interval ELSE NULL END,$14)`,[id,workspace,submission,key,hash,input.subject,this.provider.name,rfc,input.tracking,channel,1+(input.cc?.length||0)+(input.bcc?.length||0),plan,policy?.retentionDays??null,free]);
   const html=await prepareLinks(tx,workspace,id,input,policy?.linkMailsMonthly,policy?.retentionDays||90,this.origin,this.archiveKey);
   await captureMailContent(tx,workspace,id,this.from,input,this.archiveKey);
   if(input.tracking) await tx.query('INSERT INTO tracking_tokens(hash,workspace_id,message_id) VALUES($1,$2,$3)',[tokenHash(secret),workspace,id]);
   if(reservation)await tx.query('UPDATE bulk_recipients SET message_id=$3,reserved=false WHERE id=$1 AND workspace_id=$2',[reservation.recipientId,workspace,id]);
   else await tx.query('UPDATE entitlements SET used=used+1 WHERE workspace_id=$1',[workspace]);
   return {id,state:'sending',replay:false,submission,rfc,secret,html,branding:policy?.branding||false,free,linkPeriod:input.linkTracking&&policy?.linkMailsMonthly?await usagePeriod(tx,true):null,usageDay:free?await usagePeriod(tx,false):null};
  });
  if(prepared.replay) return {id:prepared.id,state:prepared.state,replay:true};
  const pixel=`${this.origin}/t/o/${prepared.secret}.gif`;
  const raw=buildMailMime(input,{from:this.from,rfc:prepared.rfc!,pixel:input.tracking?pixel:undefined,branding:prepared.branding,html:prepared.html,unsubscribe:input.unsubscribe});
  try{
   const receipt=await this.provider.send({submissionId:prepared.submission!,rfcMessageId:prepared.rfc!,raw,...(input.threadId?{threadId:input.threadId}:{})});
   await this.db.query("UPDATE messages SET state='sent',sent_at=now(),provider_message_id=$3,provider_thread_id=$4 WHERE workspace_id=$1 AND id=$2 AND state='sending'",[workspace,prepared.id,receipt.providerMessageId,receipt.threadId]);
   return {id:prepared.id,state:'sent',replay:false,...(this.provider.name==='fake'&&input.tracking?{testPixel:pixel}:{})};
  }catch(error){
   if(error instanceof ProviderRejected){await this.db.transaction(async tx=>{await tx.query('SELECT workspace_id FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[workspace]);const changed=(await tx.query("UPDATE messages SET state='failed' WHERE workspace_id=$1 AND id=$2 AND state='sending' RETURNING id",[workspace,prepared.id])).rows.length;if(!changed)return;if(prepared.linkPeriod&&(await tx.query('SELECT id FROM tracked_links WHERE message_id=$1 LIMIT 1',[prepared.id])).rows.length)await releaseBucket(tx,workspace,'link_month',prepared.linkPeriod,1);if(!reservation)await tx.query('UPDATE entitlements SET used=greatest(0,used-1) WHERE workspace_id=$1',[workspace]);if(prepared.free&&prepared.usageDay){await tx.query('UPDATE free_daily_usage SET used=greatest(0,used-1) WHERE workspace_id=$1 AND usage_date=$2',[workspace,prepared.usageDay]);if(this.provider.name==='gmail')await tx.query('UPDATE free_sender_usage SET used=greatest(0,used-1) WHERE sender_hash=$1 AND usage_date=$2',[tokenHash(this.from.trim().toLowerCase()),prepared.usageDay])}});return {id:prepared.id,state:'failed',replay:false}}
   await this.db.query("UPDATE messages SET state='unknown' WHERE workspace_id=$1 AND id=$2 AND state='sending'",[workspace,prepared.id]);
   return {id:prepared.id,state:'unknown',replay:false};
  }
 }
 async collect(secret:string){
  const hash=tokenHash(secret),observedAt=new Date();
  await this.db.transaction(async tx=>{
   // Aynı kilit stop ile seri hale getirir; stop tamamlandıktan sonra olay eklenmez.
   const match=(await tx.query<{workspace_id:string;message_id:string}>(`SELECT t.workspace_id,t.message_id FROM tracking_tokens t JOIN messages m ON m.id=t.message_id AND m.workspace_id=t.workspace_id WHERE t.hash=$1 AND t.active=true AND m.tracking_enabled=true AND m.state<>'failed' AND (m.tracking_expires_at IS NULL OR m.tracking_expires_at>now()) AND (m.first_open_only=false OR NOT EXISTS(SELECT 1 FROM raw_events e WHERE e.message_id=m.id AND e.workspace_id=m.workspace_id)) FOR UPDATE OF t`,[hash])).rows[0];
   if(!match) return;
   const first=(await tx.query<{first_open_only:boolean}>('SELECT first_open_only FROM messages WHERE id=$1 AND workspace_id=$2',[match.message_id,match.workspace_id])).rows[0];if(first?.first_open_only&&(await tx.query('SELECT 1 FROM raw_events WHERE message_id=$1 AND workspace_id=$2 LIMIT 1',[match.message_id,match.workspace_id])).rows.length)return;
   const id=randomUUID();
   await tx.query("INSERT INTO raw_events(id,workspace_id,message_id,kind,occurred_at) VALUES($1,$2,$3,'image_fetch',$4)",[id,match.workspace_id,match.message_id,observedAt]);
   await tx.query('INSERT INTO outbox(id,workspace_id,event_id) VALUES($1,$2,$3)',[randomUUID(),match.workspace_id,id]);
  });
 }
 async stop(workspace:string,id:string){
  return this.db.transaction(async tx=>{
   const found=(await tx.query('SELECT id FROM messages WHERE workspace_id=$1 AND id=$2',[workspace,id])).rows.length;
   if(!found) return false;
   await tx.query('UPDATE tracking_tokens SET active=false WHERE workspace_id=$1 AND message_id=$2',[workspace,id]);
   await tx.query('UPDATE messages SET tracking_enabled=false WHERE workspace_id=$1 AND id=$2',[workspace,id]);
   return true;
  });
 }
 async list(workspace:string,search='',offset=0,filters:{from?:string;to?:string;channel?:string;campaign?:string}={}){
  if(filters.from||filters.to||filters.channel||filters.campaign){const {plan}=await membershipPolicy(this.db,workspace);if(plan!=='team'&&plan!=='business')throw Error('FEATURE_PLAN_REQUIRED')}
  if(filters.channel&&!['panel','extension','bulk','legacy'].includes(filters.channel)||filters.campaign&&!/^[a-f0-9-]{36}$/.test(filters.campaign))throw Error('INVALID_REQUEST');const boundary=(value:string|undefined,end=false)=>{if(!value)return null;const date=new Date(value.length===10?value+(end?'T23:59:59.999+03:00':'T00:00:00+03:00'):value);if(!Number.isFinite(+date))throw Error('INVALID_REQUEST');return date.toISOString()};const from=boundary(filters.from),to=boundary(filters.to,true);
  return (await this.db.query(`SELECT m.id,m.subject,m.state,m.provider,m.sent_at,m.created_at,m.tracking_enabled,activity.activity_count,activity.first_activity_at,activity.last_activity_at,
   (SELECT count(*)::int FROM raw_events e WHERE e.workspace_id=m.workspace_id AND e.message_id=m.id) AS raw_count,
   (SELECT count(*)::int FROM event_assessments a JOIN raw_events e ON e.id=a.event_id AND e.workspace_id=a.workspace_id WHERE e.workspace_id=m.workspace_id AND e.message_id=m.id AND a.source='unknown') AS unknown_count
   FROM messages m ${activityJoin} WHERE m.workspace_id=$1 AND (m.tracking_expires_at IS NULL OR m.tracking_expires_at>now()) AND m.subject ILIKE $2 AND ($4::timestamptz IS NULL OR m.created_at>=$4) AND ($5::timestamptz IS NULL OR m.created_at<=$5) AND ($6::text IS NULL OR m.send_channel=$6) AND ($7::uuid IS NULL OR EXISTS(SELECT 1 FROM bulk_recipients r WHERE r.message_id=m.id AND r.workspace_id=m.workspace_id AND r.campaign_id=$7)) ORDER BY m.created_at DESC,m.id LIMIT 50 OFFSET $3`,[workspace,`%${search}%`,offset,from,to,filters.channel||null,filters.campaign||null])).rows;
 }
 async detail(workspace:string,id:string){
  const message=(await this.db.query(`SELECT m.id,m.subject,m.state,m.provider,m.sent_at,m.tracking_enabled,activity.activity_count,activity.first_activity_at,activity.last_activity_at FROM messages m ${activityJoin} WHERE m.workspace_id=$1 AND m.id=$2 AND (m.tracking_expires_at IS NULL OR m.tracking_expires_at>now())`,[workspace,id])).rows[0];
  if(!message) return null;
  const events=(await this.db.query(`SELECT e.id,e.occurred_at,e.kind,a.source,a.identity_relation,a.reason_codes,a.classifier_version FROM raw_events e LEFT JOIN event_assessments a ON a.event_id=e.id AND a.workspace_id=e.workspace_id WHERE e.workspace_id=$1 AND e.message_id=$2 ORDER BY e.occurred_at DESC LIMIT 100`,[workspace,id])).rows;
  // Group a burst of fetches into one detected opening. A five-minute quiet
  // interval starts a new opening; retain the complete raw history unchanged.
  const openings=(await this.db.query(`WITH eligible AS (
   SELECT e.id,e.occurred_at,lag(e.occurred_at) OVER (ORDER BY e.occurred_at,e.id) AS previous_at
   FROM raw_events e LEFT JOIN event_assessments a ON a.event_id=e.id AND a.workspace_id=e.workspace_id
   JOIN messages m ON m.id=e.message_id AND m.workspace_id=e.workspace_id
   WHERE e.workspace_id=$1 AND e.message_id=$2 AND e.kind='image_fetch' AND m.state='sent'
   AND (a.source IS NULL OR a.source IN ('unknown','likely_human'))
  ), grouped AS (
   SELECT occurred_at,sum(CASE WHEN previous_at IS NULL OR occurred_at-previous_at>=interval '5 minutes' THEN 1 ELSE 0 END)
    OVER (ORDER BY occurred_at,id ROWS UNBOUNDED PRECEDING) AS opening_group FROM eligible
  ) SELECT min(occurred_at) AS first_at,max(occurred_at) AS last_at
   FROM grouped GROUP BY opening_group ORDER BY min(occurred_at)`,[workspace,id])).rows;
  const {policy}=await membershipPolicy(this.db,workspace);const links=policy?.csv?(await this.db.query<any>(`SELECT l.id,l.url_sealed,count(e.id) FILTER(WHERE e.source='unverified_browser')::int AS clicks,count(e.id) FILTER(WHERE e.source='suspected_automated')::int AS automated FROM tracked_links l LEFT JOIN link_events e ON e.link_id=l.id WHERE l.workspace_id=$1 AND l.message_id=$2 GROUP BY l.id`,[workspace,id])).rows.map(l=>({id:l.id,url:this.archiveKey?unseal(l.url_sealed,this.archiveKey):'',clicks:l.clicks,automated:l.automated})):[];
  return {message,events,openings,links};
 }
}
