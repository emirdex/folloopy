import type {DB} from '../../packages/database';

// Caller holds the user row lock. Share the sender's entitlement boundary so
// a security change cannot race a scheduled message into provider delivery.
export async function pauseAccountWork(tx:DB,userId:string){
 await tx.query('SELECT e.workspace_id FROM entitlements e JOIN users u ON u.workspace_id=e.workspace_id WHERE u.id=$1 FOR UPDATE OF e',[userId]);
 await tx.query("UPDATE bulk_campaigns SET status='paused',reason='ACCOUNT_SECURITY_CHANGED',updated_at=now() WHERE user_id=$1 AND status IN ('queued','running')",[userId]);
 // An already accepted/uncertain send must never be made resumable: that could
 // duplicate delivery. Only work with no submission record can be paused.
 await tx.query(`UPDATE scheduled_mail s SET status='paused',reason='ACCOUNT_SECURITY_CHANGED'
  WHERE s.user_id=$1 AND s.status IN ('queued','sending') AND s.message_id IS NULL
  AND NOT EXISTS(SELECT 1 FROM messages m WHERE m.workspace_id=s.workspace_id AND m.idempotency_key='scheduled_'||s.id)`,[userId]);
}
