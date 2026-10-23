type Options={schedule:(run:()=>void,ms:number)=>unknown;clear:(timer:unknown)=>void;navigate:(href:string)=>void;visible:(value:boolean)=>void};

// The animation is cosmetic. A cancelled or stalled document navigation must
// never leave it covering the current page, or override a newer user action.
export function homeReturnTransition(options:Options){
 let flight:unknown=null,deadline:unknown=null,active=false;
 const clear=()=>{if(flight!==null)options.clear(flight);if(deadline!==null)options.clear(deadline);flight=deadline=null;active=false};
 const cancel=()=>{clear();options.visible(false)};
 return {
  start(href:string){
   if(active)return;
   active=true;options.visible(true);
   flight=options.schedule(()=>{flight=null;options.navigate(href)},2000);
   deadline=options.schedule(cancel,8000);
  },
  cancel,
  dispose:clear,
 };
}
