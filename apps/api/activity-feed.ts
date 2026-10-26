import type {DB} from '../../packages/database';
import type {ActivityFeed,ActivityQuery,StreamEvent} from '../../packages/domain/activity-feed';

export async function activityFeed(db:DB,workspace:string,query:ActivityQuery={}):Promise<ActivityFeed>{
 const filter=query.filter==='send'||query.filter==='load'?query.filter:'all';
 const days=['7','30','90'].includes(query.range||'')?Number(query.range):0;
 const offset=Number.isSafeInteger(query.offset)&&typeof query.offset==='number'&&query.offset>0?Math.min(query.offset,100000):0;
 // Group the same five-minute opening bursts as the mail detail screen before
 // applying time/type filters. No per-message requests or unbounded browser list.
 const result=(await db.query<any>(`WITH matching AS (
  SELECT id,subject,sent_at FROM messages WHERE workspace_id=$1 AND state='sent' AND (tracking_expires_at IS NULL OR tracking_expires_at>now()) AND subject ILIKE $2
 ), eligible AS (
  SELECT e.id,e.message_id,e.occurred_at,lag(e.occurred_at) OVER(PARTITION BY e.message_id ORDER BY e.occurred_at,e.id) AS previous_at
  FROM raw_events e JOIN matching m ON m.id=e.message_id
  LEFT JOIN event_assessments a ON a.event_id=e.id AND a.workspace_id=e.workspace_id
  WHERE e.workspace_id=$1 AND e.kind='image_fetch' AND (a.source IS NULL OR a.source IN ('unknown','likely_human'))
 ), bursts AS (
  SELECT *,sum(CASE WHEN previous_at IS NULL OR occurred_at-previous_at>=interval '5 minutes' THEN 1 ELSE 0 END)
   OVER(PARTITION BY message_id ORDER BY occurred_at,id ROWS UNBOUNDED PRECEDING) AS opening_group FROM eligible
 ), openings AS (
  SELECT message_id,min(occurred_at) AS at,row_number() OVER(PARTITION BY message_id ORDER BY min(occurred_at)) AS ordinal
  FROM bursts GROUP BY message_id,opening_group
 ), history AS (
  SELECT 'send-'||m.id AS id,m.id AS message_id,m.subject,m.sent_at AS at,'send' AS type,0::bigint AS ordinal FROM matching m
  UNION ALL SELECT 'open-'||o.message_id||'-'||o.ordinal,o.message_id,m.subject,o.at,'load',o.ordinal FROM openings o JOIN matching m ON m.id=o.message_id
 ), scoped AS (
  SELECT * FROM history WHERE ($3::int=0 OR at>=now()-($3::text||' days')::interval)
 ), filtered AS (SELECT * FROM scoped WHERE ($4='all' OR type=$4)),
 totals AS (SELECT count(*)::int AS total FROM filtered),
 bounds AS (SELECT total,least($5::int,(greatest(total-1,0)/10)*10) AS "offset" FROM totals),
 page AS (SELECT * FROM filtered ORDER BY at DESC,id DESC LIMIT 10 OFFSET (SELECT "offset" FROM bounds))
 SELECT bounds.*,
  (SELECT coalesce(json_agg(p ORDER BY p.at DESC,p.id DESC),'[]'::json) FROM page p) AS events,
  (SELECT row_to_json(s) FROM (SELECT * FROM scoped ORDER BY at DESC,id DESC LIMIT 1) s) AS latest,
  (SELECT count(*)::int FROM scoped WHERE type='send') AS sent,
  (SELECT count(*)::int FROM scoped WHERE type='load') AS opens,
  (SELECT count(DISTINCT message_id)::int FROM scoped WHERE type='load') AS opened_messages,
  (SELECT count(DISTINCT message_id)::int FROM scoped) AS message_count
 FROM bounds`,[workspace,`%${query.q?.slice(0,200)||''}%`,days,filter,Math.floor(offset/10)*10])).rows[0];
 const event=(row:any):StreamEvent=>({id:row.id,message:{id:row.message_id,subject:row.subject},at:new Date(row.at).toISOString(),type:row.type,label:row.type==='send'?'Mail Gönderildi':Number(row.ordinal)===1?'Açılma Algılandı':`${row.ordinal}. Açılma Algılandı`,description:row.type==='send'?'E-postanız başarıyla gönderildi.':Number(row.ordinal)===1?'E-postanız için ilk açılma bilgisi alındı.':'E-postanız için yeni bir açılma bilgisi alındı.'});
 return {events:result.events.map(event),total:result.total,offset:result.offset,pageSize:10,sent:result.sent,opens:result.opens,openedMessages:result.opened_messages,messageCount:result.message_count,latest:result.latest?event(result.latest):null};
}
