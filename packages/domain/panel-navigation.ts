type Destination={url:URL;replace:boolean};
type Options={current:()=>string;recover:(href:string,replace:boolean)=>void;schedule:(run:()=>void,ms:number)=>unknown;cancel:(timer:unknown)=>void;timeoutMs?:number;paths?:readonly ('/panel'|'/admin')[]};

// A timeout belongs to the latest intent, not whichever response commits first.
// Normal client transitions never reload a document; only an unresolved target
// that is still the latest user choice can reach recovery.
export function panelNavigationGuard(options:Options){
 let pending:Destination|null=null,timer:unknown=null;
 const key=(url:URL)=>url.origin+url.pathname+url.search;
 const clear=()=>{if(timer!==null)options.cancel(timer);timer=null;pending=null};
 return {
  navigate(href:string,replace=false){
   clear();
   let current:URL,target:URL;
   try{current=new URL(options.current());target=new URL(href,current)}catch{return false}
   if(target.origin!==current.origin||!(options.paths??['/panel']).includes(target.pathname as '/panel'|'/admin')||target.username||target.password)return false;
   if(key(target)===key(current))return false;
   const intent:Destination={url:target,replace};pending=intent;
   timer=options.schedule(()=>{
    if(pending!==intent)return;
    timer=null;pending=null;
    if(key(new URL(options.current()))!==key(target))options.recover(target.href,replace);
   },options.timeoutMs??10000);
   return true;
  },
  commit(href:string){
   if(!pending)return;
   try{if(key(new URL(href,options.current()))===key(pending.url))clear()}catch{}
  },
  cancel:clear,
 };
}
