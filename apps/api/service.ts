import { randomUUID } from 'node:crypto';
import type { DB } from '../../packages/database/index';
import { token,tokenHash,escapeHtml } from '../../packages/domain/tracking';
import type { MailProvider } from '../../packages/provider-adapters/index';
const activityJoin=`LEFT JOIN LATERAL (
 SELECT count(*)::int AS activity_count,min(e.occurred_at) AS first_activity_at,max(e.occurred_at) AS last_activity_at
 FROM raw_events e LEFT JOIN event_assessments a ON a.event_id=e.id AND a.workspace_id=e.workspace_id
 WHERE e.workspace_id=m.workspace_id AND e.message_id=m.id AND e.kind='image_fetch' AND m.state='sent'
 AND (a.source IS NULL OR a.source IN ('unknown','likely_human'))
) activity ON true`;
export const LOCAL_WORKSPACE='00000000-0000-4000-8000-000000000001';
export interface SendInput {subject:string;to:string;text:string;tracking:boolean}
export async function seedLocal(db:DB){
 await db.transaction(async tx=>{
  await tx.query('INSERT INTO workspaces(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING',[LOCAL_WORKSPACE,'Folloopy çalışma alanı']);
  await tx.query("INSERT INTO entitlements(workspace_id,status,message_limit) VALUES($1,'local_test',1000) ON CONFLICT DO NOTHING",[LOCAL_WORKSPACE]);
 });
}
export class TrackingService {
 constructor(readonly db:DB,private provider:MailProvider,private origin:string,private from='local-test@example.invalid'){}
 async send(workspace:string,key:string,input:SendInput,reservation?:{recipientId:string;lease:string},authorize?:(tx:DB)=>Promise<void>){
  if(/[\r\n]/.test(this.from)||/[\r\n]/.test(input.to)||/[\r\n]/.test(input.subject))throw new Error('INVALID_MESSAGE');
  const hash=tokenHash(JSON.stringify(input));
  const prepared=await this.db.transaction(async tx=>{
   // Tek workspace kilidi: aynı idempotency key ve son kota hakkı eşzamanlı tüketilemez.
   const entitlement=(await tx.query<{status:string;used:number;message_limit:number}>('SELECT * FROM entitlements WHERE workspace_id=$1 FOR UPDATE',[workspace])).rows[0];
   if(!entitlement) throw new Error('FORBIDDEN');
   if(authorize)await authorize(tx);
   const existing=(await tx.query<{id:string;state:string;payload_hash:string}>('SELECT id,state,payload_hash FROM messages WHERE workspace_id=$1 AND idempotency_key=$2',[workspace,key])).rows[0];
   if(existing){if(existing.payload_hash!==hash) throw new Error('IDEMPOTENCY_CONFLICT');return {id:existing.id,state:existing.state,replay:true};}
   if(!['active','local_test'].includes(entitlement.status)||(!reservation&&entitlement.used>=entitlement.message_limit)) throw new Error('LIMIT_REACHED');
   if(reservation){const reserved=(await tx.query(`SELECT r.id FROM bulk_recipients r JOIN bulk_campaigns c ON c.id=r.campaign_id JOIN users u ON u.id=c.user_id JOIN access_grants g ON g.workspace_id=c.workspace_id JOIN mail_connections mc ON mc.workspace_id=c.workspace_id WHERE r.id=$1 AND r.workspace_id=$2 AND r.claim_token=$3 AND r.state='sending' AND r.reserved=true AND r.message_id IS NULL AND c.status IN ('queued','running') AND g.plan IN ('team','business') AND u.email_verified_at IS NOT NULL AND lower(mc.email)=lower($4)`,[reservation.recipientId,workspace,reservation.lease,this.from])).rows.length;if(!reserved)throw Error('BULK_RESERVATION_INVALID')}
   const id=randomUUID(),submission=randomUUID(),secret=token(),rfc=`<${submission}@${new URL(this.origin).hostname}>`;
   await tx.query(`INSERT INTO messages(id,workspace_id,submission_id,idempotency_key,payload_hash,subject,recipient_count,state,provider,rfc_message_id,tracking_enabled)
    VALUES($1,$2,$3,$4,$5,$6,1,'sending',$7,$8,$9)`,[id,workspace,submission,key,hash,input.subject,this.provider.name,rfc,input.tracking]);
   if(input.tracking) await tx.query('INSERT INTO tracking_tokens(hash,workspace_id,message_id) VALUES($1,$2,$3)',[tokenHash(secret),workspace,id]);
   if(reservation)await tx.query('UPDATE bulk_recipients SET message_id=$3,reserved=false WHERE id=$1 AND workspace_id=$2',[reservation.recipientId,workspace,id]);
   else await tx.query('UPDATE entitlements SET used=used+1 WHERE workspace_id=$1',[workspace]);
   return {id,state:'sending',replay:false,submission,rfc,secret};
  });
  if(prepared.replay) return {id:prepared.id,state:prepared.state,replay:true};
  const pixel=`${this.origin}/t/o/${prepared.secret}.gif`;
  // Kontrollü prototip yalnızca düz metin girdisinden MIME üretir; mevcut imzalı maili değiştirmez.
  const boundary=`mt-${randomUUID()}`;
  const html=`<div>${escapeHtml(input.text).replace(/\n/g,'<br>')}</div>${input.tracking?`<img src="${pixel}" width="1" height="1" alt="" />`:''}`;
  const raw=[`From: ${this.from}`,`To: ${input.to}`,`Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,`Message-ID: ${prepared.rfc}`,
   'MIME-Version: 1.0',`Content-Type: multipart/alternative; boundary="${boundary}"`,'',`--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',Buffer.from(input.text).toString('base64').match(/.{1,76}/g)?.join('\r\n')||'',`--${boundary}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',Buffer.from(html).toString('base64').match(/.{1,76}/g)?.join('\r\n')||'',`--${boundary}--`].join('\r\n');
  try{
   const receipt=await this.provider.send({submissionId:prepared.submission!,rfcMessageId:prepared.rfc!,raw});
   await this.db.query("UPDATE messages SET state='sent',sent_at=now(),provider_message_id=$3,provider_thread_id=$4 WHERE workspace_id=$1 AND id=$2 AND state='sending'",[workspace,prepared.id,receipt.providerMessageId,receipt.threadId]);
   return {id:prepared.id,state:'sent',replay:false,...(this.provider.name==='fake'&&input.tracking?{testPixel:pixel}:{})};
  }catch{
   await this.db.query("UPDATE messages SET state='unknown' WHERE workspace_id=$1 AND id=$2 AND state='sending'",[workspace,prepared.id]);
   return {id:prepared.id,state:'unknown',replay:false};
  }
 }
 async collect(secret:string){
  const hash=tokenHash(secret),observedAt=new Date();
  await this.db.transaction(async tx=>{
   // Aynı kilit stop ile seri hale getirir; stop tamamlandıktan sonra olay eklenmez.
   const match=(await tx.query<{workspace_id:string;message_id:string}>(`SELECT t.workspace_id,t.message_id FROM tracking_tokens t JOIN messages m ON m.id=t.message_id AND m.workspace_id=t.workspace_id WHERE t.hash=$1 AND t.active=true AND m.tracking_enabled=true FOR UPDATE OF t`,[hash])).rows[0];
   if(!match) return;
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
 async list(workspace:string,search='',offset=0){
  return (await this.db.query(`SELECT m.id,m.subject,m.state,m.provider,m.sent_at,m.created_at,m.tracking_enabled,activity.activity_count,activity.first_activity_at,activity.last_activity_at,
   (SELECT count(*)::int FROM raw_events e WHERE e.workspace_id=m.workspace_id AND e.message_id=m.id) AS raw_count,
   (SELECT count(*)::int FROM event_assessments a JOIN raw_events e ON e.id=a.event_id AND e.workspace_id=a.workspace_id WHERE e.workspace_id=m.workspace_id AND e.message_id=m.id AND a.source='unknown') AS unknown_count
   FROM messages m ${activityJoin} WHERE m.workspace_id=$1 AND m.subject ILIKE $2 ORDER BY m.created_at DESC,m.id LIMIT 50 OFFSET $3`,[workspace,`%${search}%`,offset])).rows;
 }
 async detail(workspace:string,id:string){
  const message=(await this.db.query(`SELECT m.id,m.subject,m.state,m.provider,m.sent_at,m.tracking_enabled,activity.activity_count,activity.first_activity_at,activity.last_activity_at FROM messages m ${activityJoin} WHERE m.workspace_id=$1 AND m.id=$2`,[workspace,id])).rows[0];
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
  return {message,events,openings};
 }
}
