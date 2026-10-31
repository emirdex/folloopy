import {validBulkEmail} from './bulk-mail';
export const MAX_MAIL_RECIPIENTS=20;
export function splitRecipients(value:string){return value.trim().split(/[\s,;]+/).filter(Boolean).map(v=>v.toLowerCase())}
export function mailRecipients(input:{to:string;cc?:string[];bcc?:string[]}){
 if(typeof input.to!=='string'||input.to.length>6000||/[\r\n\x00]/.test(input.to))throw Error('INVALID_MESSAGE');
 const to=splitRecipients(input.to),cc=input.cc??[],bcc=input.bcc??[];
 if(!to.length||!Array.isArray(cc)||!Array.isArray(bcc))throw Error('INVALID_MESSAGE');
 const all=[...to,...cc,...bcc];
 if(all.length>MAX_MAIL_RECIPIENTS||all.some(v=>typeof v!=='string'||!validBulkEmail(v))||new Set(all.map(v=>v.toLowerCase())).size!==all.length)throw Error('INVALID_MESSAGE');
 return {to,cc,bcc,count:all.length};
}
