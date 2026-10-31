'use client';
import {useRef,useState} from 'react';
import {X} from 'lucide-react';
import {validBulkEmail} from '../../../../packages/domain/bulk-mail';
import {splitRecipients,MAX_MAIL_RECIPIENTS} from '../../../../packages/domain/recipients';
export function RecipientInput({name,label,value,onChange,disabled=false,required=false}:{name:string;label:string;value:string;onChange:(value:string)=>void;disabled?:boolean;required?:boolean}){
 const [pending,setPending]=useState(''),[error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 const addresses=splitRecipients(value);
 function add(source:string){const tokens=splitRecipients(source);if(tokens.some(v=>!validBulkEmail(v))){setPending(source);setError('Geçerli bir e-posta adresi girin.');return false}const all=Array.from(new Set([...addresses,...tokens]));if(all.length>MAX_MAIL_RECIPIENTS){setError(`En fazla ${MAX_MAIL_RECIPIENTS} alıcı ekleyebilirsiniz.`);return false}onChange(all.join(', '));setPending('');setError('');return true}
 return <div className="recipient-field"><span className="recipient-label">{label}</span><div className="recipient-tokens" onClick={()=>input.current?.focus()}>
 {addresses.map(address=><span className="recipient-token" key={address}>{address}<button type="button" disabled={disabled} aria-label={address+' adresini kaldır'} onClick={e=>{e.stopPropagation();onChange(addresses.filter(v=>v!==address).join(', '));input.current?.focus()}}><X size={12}/></button></span>)}
 <input ref={input} type="text" aria-label={label+' e-posta adresleri'} aria-describedby={error?name+'-error':undefined} autoComplete="off" autoCapitalize="none" spellCheck={false} inputMode="email" required={required&&!addresses.length} disabled={disabled} value={pending} placeholder={addresses.length?'Başka alıcı ekleyin':'alici@sirketiniz.com'} pattern="[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}" onChange={e=>{const next=e.target.value;setError('');if(/[,;\s]$/.test(next)&&next.trim())add(next);else setPending(next)}} onPaste={e=>{const text=e.clipboardData.getData('text');if(/[\s,;]/.test(text)){e.preventDefault();add(pending+text)}}} onBlur={()=>{if(pending.trim())add(pending)}} onKeyDown={e=>{if(['Enter',',',';',' '].includes(e.key)&&pending.trim()){e.preventDefault();add(pending)}if(e.key==='Backspace'&&!pending&&addresses.length)onChange(addresses.slice(0,-1).join(', '))}}/>
 <input type="hidden" name={name} value={[value,pending.trim()].filter(Boolean).join(', ')}/></div>{error?<small id={name+'-error'} role="alert">{error}</small>:null}</div>;
}
