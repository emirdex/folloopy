import {createHash} from 'node:crypto';
import type {DB} from '../../packages/database/index';
export async function allowRequest(db:DB,bucket:string,value:string,limit:number,seconds=900){
 const key=createHash('sha256').update(bucket+':'+value).digest('hex');
 const row=(await db.query<{count:number}>(`INSERT INTO request_limits(key,count,expires_at) VALUES($1,1,now()+($2::text||' seconds')::interval) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.expires_at<now() THEN 1 ELSE request_limits.count+1 END, expires_at=CASE WHEN request_limits.expires_at<now() THEN excluded.expires_at ELSE request_limits.expires_at END RETURNING count`,[key,seconds])).rows[0];
 return row.count<=limit;
}
