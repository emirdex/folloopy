import type {DB} from '../../packages/database';
const pageSize=40;
const timelineSql=`
 SELECT 'action:'||a.id AS id,a.action AS type,a.created_at AS at,NULL::text AS subject,NULL::text AS channel,NULL::text AS state FROM member_activity a WHERE a.user_id=$1
 UNION ALL SELECT 'message:'||m.id,'message',COALESCE(m.sent_at,m.created_at),m.subject,m.send_channel,m.state FROM messages m JOIN users u ON u.workspace_id=m.workspace_id WHERE u.id=$1
 UNION ALL SELECT 'opened:'||r.id,'opening',r.occurred_at,m.subject,m.send_channel,NULL::text FROM raw_events r JOIN messages m ON m.id=r.message_id AND m.workspace_id=r.workspace_id JOIN users u ON u.workspace_id=m.workspace_id WHERE u.id=$1 AND r.kind='image_fetch'`;
export class AdminMemberInsights{
 constructor(private db:DB){}
 async activity(id:string,offset=0){
  const rows=(await this.db.query(`SELECT * FROM (${timelineSql}) activity ORDER BY at DESC,id DESC LIMIT ${pageSize} OFFSET $2`,[id,offset])).rows;
  const total=Number((await this.db.query<{total:number}>(`SELECT count(*)::int AS total FROM (${timelineSql}) activity`,[id])).rows[0].total);
  return {rows,total,offset,pageSize};
 }
 async messages(id:string,offset=0){
  const rows=(await this.db.query(`SELECT m.id,m.subject,EXISTS(SELECT 1 FROM message_content_archive a WHERE a.message_id=m.id AND a.workspace_id=m.workspace_id) AS content_stored,m.provider,m.send_channel,m.state,m.tracking_enabled,m.created_at,m.sent_at,(SELECT count(*)::int FROM raw_events r WHERE r.message_id=m.id AND r.workspace_id=m.workspace_id AND r.kind='image_fetch') AS opening_count FROM messages m JOIN users u ON u.workspace_id=m.workspace_id WHERE u.id=$1 ORDER BY m.created_at DESC,m.id DESC LIMIT ${pageSize} OFFSET $2`,[id,offset])).rows;
  const total=Number((await this.db.query<{total:number}>('SELECT count(*)::int AS total FROM messages m JOIN users u ON u.workspace_id=m.workspace_id WHERE u.id=$1',[id])).rows[0].total);
  return {rows,total,offset,pageSize};
 }
 async detail(id:string){
  const user=(await this.db.query<any>(`SELECT u.id,u.name,u.email,u.role,COALESCE(ms.enabled,false) AS mail_content_storage_enabled,ms.updated_at AS mail_content_storage_updated_at,u.workspace_id,u.created_at,u.last_login_at,u.email_verified_at,w.name AS workspace_name,COALESCE(g.plan,p.plan) AS plan,g.plan AS access_plan,g.granted_at,e.status AS entitlement_status,CASE WHEN g.plan='free' THEN COALESCE((SELECT used FROM free_daily_usage f WHERE f.workspace_id=u.workspace_id AND f.usage_date=(now() AT TIME ZONE 'Europe/Istanbul')::date),0) ELSE e.used END AS used,e.message_limit FROM users u JOIN workspaces w ON w.id=u.workspace_id LEFT JOIN member_mail_storage ms ON ms.user_id=u.id AND ms.workspace_id=u.workspace_id LEFT JOIN preview_purchases p ON p.workspace_id=u.workspace_id LEFT JOIN access_grants g ON g.workspace_id=u.workspace_id LEFT JOIN entitlements e ON e.workspace_id=u.workspace_id WHERE u.id=$1`,[id])).rows[0];
  if(!user)return null;const workspace=user.workspace_id;
  const [connection,devices,sessions,summary,purchases,billing,drafts,campaigns,activity,messages]=await Promise.all([
   this.db.query<any>('SELECT email,created_at,updated_at,scopes FROM mail_connections WHERE workspace_id=$1',[workspace]),
   this.db.query<any>(`SELECT d.id,d.sender,d.revoked,d.created_at,d.last_seen_at,d.expires_at,EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=d.user_id AND s.token_hash=d.session_hash AND s.expires_at>now()) AS session_active FROM extension_devices d WHERE d.user_id=$1 ORDER BY d.created_at DESC,d.id DESC LIMIT 50`,[id]),
   this.db.query('SELECT count(*)::int AS active_count,min(created_at) AS oldest_active_at,max(created_at) AS newest_active_at FROM sessions WHERE user_id=$1 AND expires_at>now()',[id]),
   this.db.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE state='sent')::int AS sent,count(*) FILTER(WHERE tracking_enabled)::int AS tracking,count(*) FILTER(WHERE send_channel='panel' AND state='sent')::int AS panel_count,count(*) FILTER(WHERE send_channel='extension' AND state='sent')::int AS extension_count,count(*) FILTER(WHERE send_channel='bulk' AND state='sent')::int AS bulk_count,count(*) FILTER(WHERE send_channel='legacy' AND state='sent')::int AS legacy_count,max(sent_at) FILTER(WHERE state='sent') AS last_sent_at,max(sent_at) FILTER(WHERE state='sent' AND send_channel='panel') AS last_panel_at,max(sent_at) FILTER(WHERE state='sent' AND send_channel='extension') AS last_extension_at,max(sent_at) FILTER(WHERE state='sent' AND send_channel='bulk') AS last_bulk_at FROM messages WHERE workspace_id=$1`,[workspace]),
   this.db.query('SELECT id,plan,mode,status,amount_minor,currency,created_at,completed_at,source FROM purchases WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[id]),
   this.db.query('SELECT profile,updated_at FROM billing_profiles WHERE user_id=$1 AND workspace_id=$2',[id,workspace]),
   this.db.query('SELECT count(*)::int AS active_count,max(updated_at) AS last_updated_at FROM mail_drafts WHERE user_id=$1 AND workspace_id=$2 AND deleted_at IS NULL',[id,workspace]),
   this.db.query('SELECT c.id,c.status,c.total,c.created_at,c.updated_at,c.sender_email,(SELECT count(*)::int FROM bulk_recipients r WHERE r.campaign_id=c.id AND r.workspace_id=c.workspace_id AND r.state=\'sent\') AS sent FROM bulk_campaigns c WHERE c.user_id=$1 AND c.workspace_id=$2 ORDER BY c.created_at DESC,c.id DESC LIMIT 30',[id,workspace]),
   this.activity(id),this.messages(id)
  ]);
  const gmail=connection.rows[0]||null,allowed=!!user.email_verified_at&&['team','business'].includes(user.access_plan)&&user.entitlement_status==='active';
  const safeDevices=devices.rows.map(d=>{const expired=new Date(d.expires_at).getTime()<=Date.now();const senderMatches=!!gmail&&gmail.email.toLowerCase()===d.sender.toLowerCase();const reason=d.revoked?'revoked':expired?'expired':!d.session_active?'session_closed':!allowed?'plan_or_verification':!senderMatches?'sender_changed':'active';return {...d,effective:reason==='active',reason}});
  const {scopes,...safeConnection}=gmail||{};
  const security=(await this.db.query<any>("SELECT max(created_at) AS last_activity_at,max(created_at) FILTER(WHERE action='password_reset') AS password_reset_at,max(created_at) FILTER(WHERE action='email_changed') AS email_change_at FROM member_activity WHERE user_id=$1",[id])).rows[0];
  const pendingEmail=(await this.db.query('SELECT new_email,created_at,expires_at,old_confirmed,new_confirmed FROM account_email_changes WHERE user_id=$1 AND expires_at>now()',[id])).rows[0]||null;
  return {snapshot_at:new Date().toISOString(),user:{...user,message_count:summary.rows[0].total},connection:gmail?{...safeConnection,provider:'gmail',send_permission:scopes.split(/\s+/).includes('https://www.googleapis.com/auth/gmail.send')}:null,extension:{allowed,active_count:safeDevices.filter(d=>d.effective).length,devices:safeDevices},sessions:sessions.rows[0],summary:summary.rows[0],purchases:purchases.rows,billing:billing.rows[0]||null,drafts:drafts.rows[0],campaigns:campaigns.rows,activity,messages,last_activity_at:security.last_activity_at,security:{...security,pending_email_change:pendingEmail},outside_tracking_available:false};
 }
}
