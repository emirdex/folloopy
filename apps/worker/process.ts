import type { DB } from '../../packages/database/index';
import { assess } from '../../packages/domain/tracking';
export async function processBatch(db:DB){
 return db.transaction(async tx=>{
  const jobs=(await tx.query<{id:string;workspace_id:string;event_id:string;occurred_at:Date;sent_at:Date|null;recipient_count:number}>(`SELECT o.id,o.workspace_id,o.event_id,e.occurred_at,m.sent_at,m.recipient_count FROM outbox o JOIN raw_events e ON e.id=o.event_id AND e.workspace_id=o.workspace_id JOIN messages m ON m.id=e.message_id AND m.workspace_id=e.workspace_id WHERE o.processed_at IS NULL ORDER BY e.received_at LIMIT 100 FOR UPDATE OF o SKIP LOCKED`)).rows;
  for(const job of jobs){
   const result=assess({occurredAt:new Date(job.occurred_at),sentAt:job.sent_at?new Date(job.sent_at):null,recipientCount:job.recipient_count});
   await tx.query(`INSERT INTO event_assessments(event_id,workspace_id,source,identity_relation,reason_codes,classifier_version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,[job.event_id,job.workspace_id,result.source,result.identity,JSON.stringify(result.reasonCodes),result.classifierVersion]);
   await tx.query('UPDATE outbox SET processed_at=now() WHERE id=$1 AND workspace_id=$2',[job.id,job.workspace_id]);
  }
  return jobs.length;
 });
}
