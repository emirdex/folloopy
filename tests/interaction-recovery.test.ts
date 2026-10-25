import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {homeReturnTransition} from '../packages/domain/home-return';
import {assetRecoveryScript} from '../apps/web/app/asset-recovery';

function clock(){
 let now=1000000,id=0;const jobs=new Map<number,{at:number;run:()=>void}>();
 return {schedule:(run:()=>void,ms:number)=>{jobs.set(++id,{run,at:now+ms});return id},clear:(id:unknown)=>{jobs.delete(id as number)},advance:(ms:number)=>{now+=ms;for(const [id,job] of [...jobs])if(job.at<=now){jobs.delete(id);job.run()}},now:()=>now};
}
test('a stalled logo navigation cannot retain its overlay; later actions cancel the old redirect',()=>{
 const c=clock(),navigations:string[]=[],states:boolean[]=[];
 const transition=homeReturnTransition({schedule:c.schedule,clear:c.clear,navigate:href=>navigations.push(href),visible:value=>states.push(value)});
 transition.start('/');c.advance(2000);assert.deepEqual(navigations,['/']);assert.equal(states.at(-1),true);
 c.advance(6000);assert.equal(states.at(-1),false);
 transition.start('/');c.advance(1000);transition.cancel();c.advance(9000);assert.equal(navigations.length,1);assert.equal(states.at(-1),false);
 transition.start('/');transition.dispose();c.advance(9000);assert.equal(navigations.length,1);
});

function recovery(storage=new Map<string,string>(),resources:Record<string,unknown>[]=[],styles:Record<string,unknown>[]=[]){
 const c=clock(),listeners=new Map<string,((event:any)=>void)[]>();let reloads=0;
 const location={href:'https://folloopy.example/blog',pathname:'/blog',origin:'https://folloopy.example',replace:(href:string)=>{assert.equal(href,location.href);reloads++}};
 class Element{constructor(public link=false){}closest(){return this.link?{}:null}}
 const sessionStorage={getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)};
 vm.runInNewContext(assetRecoveryScript,{document:{querySelectorAll:()=>styles},performance:{getEntriesByType:()=>resources},window:{addEventListener:(name:string,fn:(event:any)=>void)=>listeners.set(name,[...(listeners.get(name)||[]),fn])},location,sessionStorage,URL,Element,Date:{now:c.now},setTimeout:c.schedule,clearTimeout:c.clear});
 const emit=(name:string,event:any={})=>listeners.get(name)?.forEach(fn=>fn(event));
 return {emit,advance:c.advance,reloads:()=>reloads,Element,storage,chunk:()=>emit('error',{target:{tagName:'SCRIPT',src:'https://folloopy.example/_next/static/chunks/missing.js?dpl=old'}})};
}
test('failed hydration scripts recover before React loads, once per page without a reload loop',()=>{
 const f=recovery();f.chunk();f.chunk();f.advance(1500);assert.equal(f.reloads(),1);
 const next=recovery(f.storage);next.chunk();next.advance(1500);assert.equal(next.reloads(),0);
 next.advance(300001);next.emit('unhandledrejection',{reason:{name:'ChunkLoadError',message:'Loading chunk 5307 failed.'}});next.advance(1500);assert.equal(next.reloads(),1);
});
test('asset recovery never discards typed fields, submitted forms or a newer link navigation',()=>{
 for(const name of ['beforeinput','change','submit','pagehide']){const f=recovery();f.chunk();f.emit(name);f.advance(1500);assert.equal(f.reloads(),0,name)}
 const f=recovery();f.chunk();f.emit('click',{target:new f.Element(true)});f.advance(1500);assert.equal(f.reloads(),0);
});
test('ordinary application, image and third-party errors do not trigger a document reload',()=>{
 const f=recovery();
 for(const src of ['https://third-party.example/_next/static/broken.js','https://folloopy.example/other.js'])f.emit('error',{target:{tagName:'SCRIPT',src}});
 f.emit('error',{target:{tagName:'IMG',src:'https://folloopy.example/_next/static/photo.js'}});
 f.emit('unhandledrejection',{reason:Error('mail send failed')});f.advance(1500);assert.equal(f.reloads(),0);
});

test('resource failures completed before the nonblocking module starts still recover',()=>{
 const f=recovery(new Map(),[{name:'https://folloopy.example/_next/static/chunks/webpack-old.js',initiatorType:'link',responseStatus:404}]);f.advance(1500);assert.equal(f.reloads(),1);
});


test('failed or stalled own stylesheets recover once without replacing edits or newer navigation',()=>{
 const href='https://folloopy.example/_next/static/css/layout.css?dpl=old';
 const failed=recovery();failed.emit('error',{target:{tagName:'LINK',rel:'stylesheet',href}});failed.advance(1500);assert.equal(failed.reloads(),1);
 const stalled=recovery(new Map(),[],[{href,sheet:null}]);stalled.advance(20000);stalled.advance(1500);assert.equal(stalled.reloads(),1);
 const next=recovery(stalled.storage,[],[{href,sheet:null}]);next.advance(20000);next.advance(1500);assert.equal(next.reloads(),0);
 for(const event of ['beforeinput','change','submit','pagehide']){const f=recovery(new Map(),[],[{href,sheet:null}]);f.emit(event);f.advance(20000);f.advance(1500);assert.equal(f.reloads(),0,event)}
 const navigating=recovery(new Map(),[],[{href,sheet:null}]);navigating.emit('click',{target:new navigating.Element(true)});navigating.advance(20000);navigating.advance(1500);assert.equal(navigating.reloads(),0);
 const loaded=recovery(new Map(),[],[{href,sheet:{}}]);loaded.advance(20000);loaded.advance(1500);assert.equal(loaded.reloads(),0);
 const external=recovery(new Map(),[],[{href:'https://third-party.example/_next/static/layout.css',sheet:null}]);external.advance(20000);external.advance(1500);assert.equal(external.reloads(),0);
});
