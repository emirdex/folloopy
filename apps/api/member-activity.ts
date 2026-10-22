import {randomUUID} from 'node:crypto';
import type {DB} from '../../packages/database';
export async function recordMemberActivity(db:DB,userId:string,action:string){await db.query('INSERT INTO member_activity(id,user_id,action) VALUES($1,$2,$3)',[randomUUID(),userId,action]);}
export function memberAction(path:string){
 const exact:Record<string,string>={'/api/account/profile':'profile_updated','/api/account/billing':'billing_updated','/api/account/email/request':'email_change_requested','/api/account/email/cancel':'email_change_cancelled','/api/gmail/callback':'gmail_connected','/api/gmail/disconnect':'gmail_disconnected','/api/extension/approve':'extension_approved','/api/extension/revoke':'extension_revoked','/api/access/activate':'plan_activated','/api/purchase-preview':'plan_activated','/api/drafts':'draft_saved','/api/bulk/preview':'bulk_prepared'};
 if(exact[path])return exact[path];
 if(/^\/api\/messages\/[a-f0-9-]{36}\/stop$/.test(path))return 'tracking_stopped';
 if(/^\/api\/drafts\/[a-f0-9-]{36}$/.test(path))return 'draft_updated';
 if(/^\/api\/drafts\/[a-f0-9-]{36}\/delete$/.test(path))return 'draft_deleted';
 if(/^\/api\/bulk\/[a-f0-9-]{36}\/confirm$/.test(path))return 'bulk_confirmed';
 if(/^\/api\/bulk\/[a-f0-9-]{36}\/control$/.test(path))return 'bulk_controlled';
 return null;
}
