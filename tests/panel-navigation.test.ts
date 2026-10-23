import {test} from 'node:test';
import assert from 'node:assert/strict';
import Link from '../apps/web/app/destination-link';
import {panelNavigationGuard} from '../packages/domain/panel-navigation';

test('panel links keep client navigation and avoid automatic authenticated prefetches',()=>{
 for(const href of ['/panel','/panel?view=drafts','/panel?view=setup','/panel?view=extensions','/panel?view=account#billing','/panel?id=example','https://panel.folloopy.com/panel?view=compose']){
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
 for(const href of ['/blog','/#planlar','/admin?view=members','/panel-other'])assert.equal(Link({href}).props.prefetch,undefined);
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
  Link({href:'/blog'}).props.onNavigate({preventDefault(){throw Error('unexpected cancellation')}});
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
