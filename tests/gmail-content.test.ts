import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const source=await readFile(new URL('../extensions/gmail/gmail.js',import.meta.url),'utf8');
async function fixture(options:{attachment?:boolean;sender?:string;recipients?:string[];outcome?:string;network?:boolean;accountControl?:'tr-button'|'en-button'|'missing'}={}){
 const elements:any[]=[],calls:any[]=[];
 const element=()=>({className:'',textContent:'',disabled:false,children:[] as any[],setAttribute(){},append(...children:any[]){this.children.push(...children)},replaceChildren(){this.children=[]}});
 const parent=element(),body={innerText:'Synthetic proposal',querySelector:()=>null,closest:()=>compose};
 const compose={querySelector:(q:string)=>q==='.folloopy-compose'?null:q==='input[name="subjectbox"]'?{value:'Proposal'}:q.startsWith('[name="cc"]')?(options.attachment?{}:null):q.startsWith('[role="button"]')?{parentElement:parent}:null,querySelectorAll:(q:string)=>q==='[email]'?(options.recipients||['recipient@example.invalid']).map(email=>({getAttribute:()=>email})):[]};
 const document={body:{},querySelector:(q:string)=>{
  const mode=options.accountControl;
  if(mode==='missing'||(mode==='tr-button'&&!q.startsWith('[aria-label*="Google Hesabı:"]'))||(mode==='en-button'&&!q.startsWith('[aria-label*="Google Account:"]')))return null;
  return {getAttribute:(name:string)=>name==='aria-label'?`${mode==='tr-button'?'Google Hesabı':'Google Account'}: ${options.sender||'sender@example.invalid'}`:null};
 },querySelectorAll:()=>[body],createElement:()=>{const e=element();elements.push(e);return e},createTextNode:(s:string)=>s};
 vm.runInNewContext(source,{document,crypto:{randomUUID},confirm:()=>true,MutationObserver:class{observe(){}},setTimeout,clearTimeout,chrome:{runtime:{sendMessage:async(message:any)=>{calls.push(message);if(options.network)throw Error('Network lost');return {ok:true,result:{id:randomUUID(),state:options.outcome||'sent'}}}}}});
 return {button:elements[1],note:elements[2],calls};
}
test('Gmail button sends current compose only once; unknown outcomes and network loss stay locked',async()=>{
 for(const options of [{},{outcome:'unknown'},{network:true}]){const f=await fixture(options);await f.button.onclick();await f.button.onclick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].payload.from,'sender@example.invalid');assert.equal(f.calls[0].payload.text,'Synthetic proposal');assert.equal(f.calls[0].payload.tracking,true);assert.equal(f.button.disabled,true)}
});
test('Attachments and multiple recipients are blocked before any transport call',async()=>{
 for(const options of [{attachment:true},{recipients:['a@example.invalid','b@example.invalid']}]){const f=await fixture(options);await f.button.onclick();assert.equal(f.calls.length,0);assert.equal(f.button.disabled,false);assert.ok(f.note.textContent.length>30)}
});
test('Turkish and English account buttons identify the sender; missing account controls fail closed',async()=>{
 for(const accountControl of ['tr-button','en-button'] as const){const f=await fixture({accountControl,sender:'cicek@example.invalid'});await f.button.onclick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].payload.from,'cicek@example.invalid')}
 const f=await fixture({accountControl:'missing'});await f.button.onclick();assert.equal(f.calls.length,0);assert.match(f.note.textContent,/Gmail hesabı doğrulanamadı/);
});
