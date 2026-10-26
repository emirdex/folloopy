import {escapeHtml} from '../../packages/domain/tracking';
import sanitizeHtml from 'sanitize-html';
import {randomUUID} from 'node:crypto';
import {fileMailHtml} from '../../packages/domain/file-mail';
export type MailAttachment={name:string;mime:string;data:string;cid?:string};
export type RichMessage={to:string;subject:string;text:string;html?:string;cc?:string[];bcc?:string[];attachments?:MailAttachment[];threadId?:string;inReplyTo?:string;references?:string;linkTracking?:boolean};
const email=/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
export function validateRichMessage(p:RichMessage){
 if(!p||typeof p.to!=='string'||!email.test(p.to)||p.to.length>254||typeof p.subject!=='string'||!p.subject.trim()||p.subject.length>200||/[\r\n]/.test(p.subject)||typeof p.text!=='string'||!p.text.trim()||p.text.length>10000)throw Error('INVALID_MESSAGE');
 for(const field of ['cc','bcc'] as const)if(p[field]!==undefined&&(!Array.isArray(p[field])||p[field]!.length>20||p[field]!.some(v=>typeof v!=='string'||v.length>254||!email.test(v))))throw Error('INVALID_MESSAGE');
 if(p.linkTracking!==undefined&&typeof p.linkTracking!=='boolean')throw Error('INVALID_MESSAGE');
 if(p.html!==undefined&&(typeof p.html!=='string'||p.html.length>200000))throw Error('INVALID_MESSAGE');
 if(p.threadId!==undefined&&(typeof p.threadId!=='string'||!/^[a-fA-F0-9]{8,64}$/.test(p.threadId)||!p.inReplyTo))throw Error('INVALID_MESSAGE');
 for(const f of ['inReplyTo','references'] as const)if(p[f]!==undefined&&(typeof p[f]!=='string'||p[f]!.length>2000||!/^<[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~@]+>(?:\s+<[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~@]+>)*$/.test(p[f]!)))throw Error('INVALID_MESSAGE');
 if(p.attachments!==undefined&&(!Array.isArray(p.attachments)||p.attachments.length>20))throw Error('INVALID_MESSAGE');let total=0;
 for(const a of p.attachments||[]){if(!a||typeof a.name!=='string'||!a.name.trim()||a.name.length>180||/[\r\n\x00/\\]/.test(a.name)||typeof a.mime!=='string'||!/^[-\w.+]+\/[-\w.+]+$/.test(a.mime)||typeof a.data!=='string'||!a.data.length||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(a.data)||a.cid!==undefined&&!/^[A-Za-z0-9_-]{1,80}$/.test(a.cid))throw Error('INVALID_MESSAGE');total+=Buffer.from(a.data,'base64').length}
 if(total>10*1024*1024)throw Error('ATTACHMENTS_TOO_LARGE');
}
export function cleanMailHtml(html:string,rewrite?:(url:string)=>string){return sanitizeHtml(html,{allowedTags:[...sanitizeHtml.defaults.allowedTags,'img','font'],allowedAttributes:{'*':['style','dir'],a:['href','title','target','rel'],img:['src','alt','width','height'],font:['color','face','size'],td:['colspan','rowspan'],th:['colspan','rowspan'],ol:['start']},allowedSchemes:['https','http','mailto','tel','cid'],allowProtocolRelative:false,allowedStyles:{'*':{'color':[/^(?:#[0-9a-f]{3,8}|rgba?\([\d.,% ]+\)|[a-z]+)$/i],'background-color':[/^(?:#[0-9a-f]{3,8}|rgba?\([\d.,% ]+\)|[a-z]+)$/i],'font-size':[/^\d+(?:\.\d+)?(?:px|pt|em|rem|%)$/],'font-family':[/^[\w ,"'-]+$/],'font-weight':[/^(?:normal|bold|[1-9]00)$/],'font-style':[/^(?:normal|italic)$/],'text-align':[/^(?:left|right|center|justify)$/],'text-decoration':[/^(?:none|underline|line-through)$/],'white-space':[/^(?:normal|pre-wrap|pre)$/]}},transformTags:{a:(tagName,attrs)=>({tagName,attribs:{...attrs,...(attrs.href&&rewrite?{href:rewrite(attrs.href)}:{}),rel:'noreferrer noopener'}})}})}
export function textMailHtml(text:string){let html='',offset=0;for(const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)){const url=match[0].replace(/[.,;!?]+$/,'');html+=escapeHtml(text.slice(offset,match.index)).replace(/\n/g,'<br>');html+=/\/dosya\/[A-Za-z0-9_-]{43}$/.test(url)?fileMailHtml(url):`<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`;offset=match.index!+url.length}return html+escapeHtml(text.slice(offset)).replace(/\n/g,'<br>')}
const b64=(s:string|Buffer)=>Buffer.from(s).toString('base64').match(/.{1,76}/g)?.join('\r\n')||'';
export function buildMailMime(input:RichMessage,options:{from:string;rfc:string;pixel?:string;branding?:boolean;html?:string;unsubscribe?:string}){
 const alt='alt-'+randomUUID(),mixed='mixed-'+randomUUID(),html=(options.html??(input.html?cleanMailHtml(input.html):textMailHtml(input.text)))+(options.branding?'<p style="font-size:11px;color:#778399">Folloopy ile gönderildi · <a href="https://folloopy.com/">E-posta takibi</a></p>':'')+(options.unsubscribe?`<p><a href="${options.unsubscribe}">Bu göndericiden kampanya e-postası almayı durdur</a></p>`:'')+(options.pixel?`<img src="${options.pixel}" width="1" height="1" alt="" />`:'');
 const plain=input.text+(options.branding?'\n\nFolloopy ile gönderildi · https://folloopy.com/':'')+(options.unsubscribe?'\n\nKampanya e-postalarını durdur: '+options.unsubscribe:'');
 const headers=[`From: ${options.from}`,`To: ${input.to}`,...(input.cc?.length?[`Cc: ${input.cc.join(', ')}`]:[]),...(input.bcc?.length?[`Bcc: ${input.bcc.join(', ')}`]:[]),`Subject: =?UTF-8?B?${Buffer.from(input.subject).toString('base64')}?=`,`Message-ID: ${options.rfc}`,...(input.inReplyTo?[`In-Reply-To: ${input.inReplyTo}`]:[]),...(input.references?[`References: ${input.references}`]:[]),'MIME-Version: 1.0',...(options.unsubscribe?[`List-Unsubscribe: <${options.unsubscribe}>`]:[])];
 const content=[`Content-Type: multipart/alternative; boundary="${alt}"`,'',`--${alt}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(plain),`--${alt}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',b64(html),`--${alt}--`];
 if(!input.attachments?.length)return [...headers,...content].join('\r\n');
 const parts=[...headers,`Content-Type: multipart/mixed; boundary="${mixed}"`,'',`--${mixed}`,...content];
 for(const a of input.attachments){parts.push(`--${mixed}`,`Content-Type: ${a.mime}`,`Content-Disposition: ${a.cid?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(a.name)}`,...(a.cid?[`Content-ID: <${a.cid}>`]:[]),'Content-Transfer-Encoding: base64','',b64(Buffer.from(a.data,'base64')))}
 return [...parts,`--${mixed}--`].join('\r\n');
}
