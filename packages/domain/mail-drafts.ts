export type MailDraftInput={title:string;subject:string;to:string;text:string;tracking:boolean};
export type MailDraft=MailDraftInput&{id:string;version:number;created_at:string;updated_at:string;locked:boolean};
export type MailDraftList={drafts:MailDraft[];used:number;limit:number};
export type DraftFormState={error?:string;success?:string;id?:string;version?:number}|null;
export function validMailDraft(value:MailDraftInput){
 if(typeof value.title!=='string'||!value.title.trim()||value.title.length>80||/[\r\n]/.test(value.title))return false;
 if(typeof value.subject!=='string'||value.subject.length>200||/[\r\n]/.test(value.subject))return false;
 if(typeof value.to!=='string'||value.to.length>254||(value.to!==''&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.to)))return false;
 return typeof value.text==='string'&&value.text.length<=10000&&typeof value.tracking==='boolean';
}
