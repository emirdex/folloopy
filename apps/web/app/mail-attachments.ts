import type {MailAttachment} from '../../../apps/api/mail-format';
export async function readMailAttachments(form:FormData):Promise<MailAttachment[]>{
 const files=form.getAll('attachments').filter((v):v is File=>v instanceof File&&v.size>0);
 if(files.length>20||files.reduce((sum,f)=>sum+f.size,0)>10*1024*1024)throw Error('ATTACHMENTS_TOO_LARGE');
 return Promise.all(files.map(async file=>({name:file.name,mime:file.type||'application/octet-stream',data:Buffer.from(await file.arrayBuffer()).toString('base64')})));
}
