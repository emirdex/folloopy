import {createHash} from 'node:crypto';
import type {DB} from '../../packages/database/index';
import {freePlan} from '../../packages/domain/commercial-plans';
// Database time is authoritative for every worker, session and browser.
export async function freeUsage(db:DB,workspace:string){
 const row=(await db.query<{used:number;resets_at:string}>(`SELECT COALESCE((SELECT used FROM free_daily_usage WHERE workspace_id=$1 AND usage_date=(now() AT TIME ZONE 'Europe/Istanbul')::date),0)::int AS used, (((now() AT TIME ZONE 'Europe/Istanbul')::date+1)::timestamp AT TIME ZONE 'Europe/Istanbul') AS resets_at`,[workspace])).rows[0];
 return {...row,message_limit:freePlan.dailyMessageLimit,period:'daily' as const};
}
export async function consumeFreeSend(db:DB,workspace:string,sender?:string){
 if(sender){const senderHash=createHash('sha256').update(sender.trim().toLowerCase()).digest('hex');const used=await db.query(`INSERT INTO free_sender_usage(sender_hash,usage_date,used) VALUES($1,(now() AT TIME ZONE 'Europe/Istanbul')::date,1) ON CONFLICT(sender_hash,usage_date) DO UPDATE SET used=free_sender_usage.used+1 WHERE free_sender_usage.used<$2 RETURNING used`,[senderHash,freePlan.dailyMessageLimit]);if(!used.rows.length)throw Error('FREE_DAILY_LIMIT')}
 const result=await db.query(`INSERT INTO free_daily_usage(workspace_id,usage_date,used) VALUES($1,(now() AT TIME ZONE 'Europe/Istanbul')::date,1) ON CONFLICT(workspace_id,usage_date) DO UPDATE SET used=free_daily_usage.used+1 WHERE free_daily_usage.used<$2 RETURNING used`,[workspace,freePlan.dailyMessageLimit]);
 if(!result.rows.length)throw Error('FREE_DAILY_LIMIT');
}
