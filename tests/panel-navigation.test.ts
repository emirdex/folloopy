import {test} from 'node:test';
import assert from 'node:assert/strict';
import Link from '../apps/web/app/destination-link';
import {panelNavigationGuard} from '../packages/domain/panel-navigation';

test('panel links keep client navigation and avoid automatic authenticated prefetches',()=>{
 for(const href of ['/panel','/panel?view=drafts','/panel?view=setup','/panel?view=extensions','/panel?view=account#billing','/admin?view=members','/admin?view=members&id=example','/panel?id=example','https://panel.folloopy.com/panel?view=compose']){
  const onClick=()=>{};
  const link=Link({href,className:'nav-item',children:'Hedef',scroll:false,'aria-current':'page',onClick});
  assert.notEqual(link.type,'a',href);
  assert.equal(link.props.href,href);
  assert.equal(link.props.className,'nav-item');
  assert.equal(link.props['aria-current'],'page');
  assert.equal(link.props.prefetch,false);
  assert.equal(link.props.scroll,false);
  assert.equal(link.props.onClick,onClick);
 }
 assert.equal(Link({href:'/panel',prefetch:true}).props.prefetch,true);
 for(const href of ['/blog','/#planlar','/panel-other'])assert.equal(Link({href}).props.prefetch,undefined);
});

test('only accepted panel navigations notify recovery; caller cancellation is respected',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),events:CustomEvent[]=[];
 Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:(event:CustomEvent)=>events.push(event)}});
 try{
  let prevented=false;
  Link({href:'/panel?view=compose',replace:true}).props.onNavigate({preventDefault(){prevented=true}});
  assert.equal(prevented,false);
  assert.deepEqual(events[0].detail,{href:'/panel?view=compose',replace:true});
  Link({href:'/panel',onNavigate:event=>event.preventDefault()}).props.onNavigate({preventDefault(){prevented=true}});
  assert.equal(prevented,true);assert.equal(events.length,1);
  assert.equal(Link({href:'/blog'}).type,'a');
  assert.equal(events.length,1);
 }finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window')}
});

function fixture(){
 let current='https://panel.example/panel',sequence=0;
 const jobs=new Map<number,()=>void>(),recoveries:{href:string;replace:boolean}[]=[];
 const guard=panelNavigationGuard({current:()=>current,recover:(href,replace)=>recoveries.push({href,replace}),schedule:(run,ms)=>{assert.equal(ms,10000);jobs.set(++sequence,run);return sequence},cancel:timer=>{jobs.delete(timer as number)}});
 return {guard,recoveries,jobs,setCurrent:(url:string)=>{current=new URL(url,current).href},run:()=>{for(const [id,run] of [...jobs]){jobs.delete(id);run()}}};
}

test('normal client commits cancel recovery and never reload the document',()=>{
 const f=fixture();f.guard.navigate('/panel?view=drafts');assert.equal(f.jobs.size,1);
 f.setCurrent('/panel?view=drafts');f.guard.commit('/panel?view=drafts');
 assert.equal(f.jobs.size,0);f.run();assert.deepEqual(f.recoveries,[]);
 // Also safe if the address commits before React reports the completed render.
 f.guard.navigate('/panel?view=account');f.setCurrent('/panel?view=account');f.run();
 assert.deepEqual(f.recoveries,[]);
});

test('a superseded or late intermediate response cannot cancel or recover the latest destination',()=>{
 const f=fixture();f.guard.navigate('/panel?view=setup');const superseded=[...f.jobs.values()][0];
 f.guard.navigate('/panel?view=drafts');assert.equal(f.jobs.size,1);
 f.setCurrent('/panel?view=setup');f.guard.commit('/panel?view=setup');
 assert.equal(f.jobs.size,1);superseded();assert.deepEqual(f.recoveries,[]);
 f.setCurrent('/panel?view=drafts');f.guard.commit('/panel?view=drafts');f.run();
 assert.deepEqual(f.recoveries,[]);
});

test('only a genuinely stalled latest destination reaches document recovery',()=>{
 const f=fixture();f.guard.navigate('/panel?view=setup');f.guard.navigate('/panel?view=account',true);f.run();
 assert.deepEqual(f.recoveries,[{href:'https://panel.example/panel?view=account',replace:true}]);
 f.run();assert.equal(f.recoveries.length,1);
});

test('back, page hide, current-page and external destinations cancel outstanding recovery',()=>{
 for(const next of ['/panel','#section','/blog','https://other.example/panel','https://user:pass@panel.example/panel?view=drafts']){
  const f=fixture();f.guard.navigate('/panel?view=setup');f.guard.navigate(next);f.run();assert.deepEqual(f.recoveries,[],next);
 }
 const f=fixture();f.guard.navigate('/panel?view=setup');f.guard.cancel();f.run();assert.deepEqual(f.recoveries,[]);
});

test('real-page links remain native without waiting on router responses or prefetched chunks',()=>{
 for(const href of ['/','/#planlar','/blog','/blog?q=takip','/blog/mail-takibi','/iletisim','/yasal/kvkk-aydinlatma-metni','/hakkimizda','/giris','/kayit','/sifremi-unuttum','/paketler','/odeme','https://folloopy.com/blog']){
  const link=Link({href,children:'Sayfa',className:'same-design',target:'_blank',rel:'noreferrer',prefetch:true,scroll:false,replace:true});
  assert.equal(link.type,'a',href);assert.equal(link.props.href,href);assert.equal(link.props.className,'same-design');assert.equal(link.props.target,'_blank');assert.equal(link.props.rel,'noreferrer');
  for(const prop of ['prefetch','scroll','replace','onNavigate'])assert.equal(prop in link.props,false,prop);
 }
});

test('native page links preserve cancellation, modified clicks and download behavior',()=>{
 function click(extra:Record<string,unknown>={}){let prevented=false;return {event:{button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,defaultPrevented:false,currentTarget:{target:'',hasAttribute:()=>false},preventDefault(){prevented=true;this.defaultPrevented=true},...extra},prevented:()=>prevented}}
 const normal=click();Link({href:'/blog'}).props.onClick(normal.event);assert.equal(normal.prevented(),false);
 const stopped=click();Link({href:'/blog',onClick:e=>e.preventDefault()}).props.onClick(stopped.event);assert.equal(stopped.prevented(),true);
 const cancelled=click();Link({href:'/blog',onNavigate:e=>e.preventDefault()}).props.onClick(cancelled.event);assert.equal(cancelled.prevented(),true);
 for(const extra of [{metaKey:true},{ctrlKey:true},{shiftKey:true},{altKey:true},{button:1},{currentTarget:{target:'_blank',hasAttribute:()=>false}},{currentTarget:{target:'',hasAttribute:()=>true}}]){
  const modified=click(extra);Link({href:'/blog',onNavigate:()=>{throw Error('modified click intercepted')}}).props.onClick(modified.event);assert.equal(modified.prevented(),false);
 }
});

test('admin and member workspaces recover only the latest genuinely stalled transition',()=>{
 let current='https://panel.example/admin?view=members',task:(()=>void)|null=null;const recovered:string[]=[];
 const guard=panelNavigationGuard({paths:['/panel','/admin'],current:()=>current,recover:href=>recovered.push(href),schedule:fn=>{task=fn;return 1},cancel:()=>{task=null}});
 assert.equal(guard.navigate('/admin?view=posts'),true);const obsolete=task!;
 assert.equal(guard.navigate('/admin?view=purchases'),true);obsolete();assert.equal(recovered.length,0);
 current='https://panel.example/admin?view=purchases';guard.commit(current);assert.equal(task,null);
 assert.equal(guard.navigate('/panel?view=account'),true);task!();assert.deepEqual(recovered,['https://panel.example/panel?view=account']);
 assert.equal(guard.navigate('/blog'),false);
});
