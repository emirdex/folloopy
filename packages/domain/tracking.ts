import { createHash, randomBytes } from 'node:crypto';
export type Source = 'own_activity'|'known_automation'|'suspected_automation'|'likely_human'|'unknown';
export type Identity = 'message_only'|'intended_recipient'|'ambiguous_recipients';
export type SubmissionState = 'prepared'|'sending'|'sent'|'unknown'|'failed';
export interface Evidence { occurredAt: Date; sentAt: Date|null; recipientCount:number; ownVerified?:boolean; automationSignatureVerified?:boolean; scanPattern?:boolean; humanActionVerified?:boolean }
export function assess(e:Evidence) {
 const identity:Identity=e.recipientCount===1?'intended_recipient':'ambiguous_recipients';
 const result=(source:Source,reason:string,eligible=false)=>({source,identity,reasonCodes:[reason],classifierVersion:'rules-0.1.0',notify:eligible});
 if(!e.sentAt || e.occurredAt<e.sentAt) return result('unknown','NOT_CONFIRMED_SENT');
 if(e.ownVerified) return result('own_activity','SIGNED_LOCAL_EVIDENCE');
 if(e.automationSignatureVerified) return result('known_automation','VERIFIED_AUTOMATION_SIGNATURE');
 if(e.scanPattern) return result('suspected_automation','COMBINED_SCAN_PATTERN');
 if(e.humanActionVerified) return result('likely_human','VERIFIED_INTERACTION',true);
 return result('unknown','INSUFFICIENT_EVIDENCE');
}
export function transition(from:SubmissionState,to:SubmissionState):SubmissionState {
 const allowed:Record<SubmissionState,SubmissionState[]>={prepared:['sending'],sending:['sent','unknown','failed'],unknown:['sent','failed'],sent:[],failed:[]};
 if(!allowed[from].includes(to)) throw new Error('INVALID_SUBMISSION_TRANSITION');
 return to;
}
export const token=()=>randomBytes(32).toString('base64url');
export const tokenHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export function validateDestination(value:string):string {
 if(value.length>8192 || /[\r\n]/.test(value)) throw new Error('INVALID_URL');
 const u=new URL(value);
 if(!['https:','http:'].includes(u.protocol) || u.username || u.password) throw new Error('INVALID_URL');
 return value; // İmzalı query sırasını ve fragment'i değiştirme.
}
export function escapeHtml(value:string){return value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
