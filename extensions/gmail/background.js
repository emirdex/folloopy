const storageReady=chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
const BASE='https://panel.folloopy.com';
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('folloopy-keys',1);r.onupgradeneeded=()=>r.result.createObjectStore('keys');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function keyStore(value){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('keys',value?'readwrite':'readonly'),r=value?tx.objectStore('keys').put(value,'device'):tx.objectStore('keys').get('device');let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error)})}finally{db.close()}}
async function transport(body){const r=await fetch(BASE+'/eklentiler/api',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'omit',body:JSON.stringify(body)});const result=await r.json();if(!r.ok)throw Error(result.code||'SERVICE_UNAVAILABLE');return result}
async function signed(operation,payload={}){const {device}=await chrome.storage.local.get('device');const keys=await keyStore();if(!device||!keys)throw Error('NOT_PAIRED');const e={deviceId:device.deviceId,token:device.token,nonce:crypto.randomUUID(),issuedAt:Date.now(),operation,payload};const raw=JSON.stringify([e.deviceId,e.token,e.nonce,e.issuedAt,e.operation,e.payload]);e.signature=b64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(raw)));return transport(e)}
let pairing=false;
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 const gmail=sender.tab&&/^https:\/\/mail\.google\.com\//.test(sender.url||'');
 const popup=!sender.tab&&sender.id===chrome.runtime.id&&sender.url===chrome.runtime.getURL('popup.html');
 if(!gmail&&!popup)return;
 (async()=>{
  await storageReady;
  if(message.operation==='status')return signed('status');
  if(['files','file-share','messages','message','drafts','remind','notifications','schedule'].includes(message.operation)&&gmail)return signed(message.operation,message.payload||{});
  if(message.operation==='send'&&gmail)return signed('send',message.payload);
  if(message.operation==='disconnect'&&popup){try{await signed('disconnect')}finally{await chrome.storage.local.remove(['device','pair'])}return {ok:true}}
  if(message.operation==='pair'&&popup){if(pairing)throw Error('PAIR_PENDING');pairing=true;try{
   const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
   const publicKey=await crypto.subtle.exportKey('jwk',keys.publicKey);await keyStore(keys);
   const secret=b64(crypto.getRandomValues(new Uint8Array(32))),challenge=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)));
   const {pairId}=await transport({operation:'pair',payload:{publicKey,challenge}});
   await chrome.storage.local.remove('device');await chrome.storage.local.set({pair:{pairId,secret,expires:Date.now()+300000}});
   await chrome.tabs.create({url:BASE+'/panel?view=extensions&pair='+encodeURIComponent(pairId)});return {pending:true};
  }finally{pairing=false}}
  if(message.operation==='exchange'&&popup){const {pair}=await chrome.storage.local.get('pair');if(!pair||pair.expires<Date.now())throw Error('PAIR_EXPIRED');const result=await transport({operation:'exchange',payload:pair});if(!result.pending){await chrome.storage.local.set({device:result});await chrome.storage.local.remove('pair')}return result}
  throw Error('FORBIDDEN');
 })().then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));return true;
});
