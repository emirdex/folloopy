export type StreamEvent={id:string;message:{id:string;subject:string};at:string;type:'send'|'load';label:string;description:string};
export type ActivityFeed={events:StreamEvent[];total:number;offset:number;pageSize:number;sent:number;opens:number;openedMessages:number;messageCount:number;latest:StreamEvent|null};
export type ActivityQuery={q?:string;filter?:string;range?:string;offset?:number};
export function activityHref(query:ActivityQuery={}){
 const params=new URLSearchParams({view:'activity'});
 if(query.q)params.set('q',query.q);
 if(query.filter&&query.filter!=='all')params.set('filter',query.filter);
 if(query.range&&query.range!=='all')params.set('range',query.range);
 if(query.offset)params.set('offset',String(query.offset));
 return '/panel?'+params.toString();
}
