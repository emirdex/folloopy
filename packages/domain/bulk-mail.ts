export const BULK_MAX_RECIPIENTS=500;
export const BULK_CSV_LIMIT=512*1024;
export type BulkRecipient={email:string;ad:string;soyad:string;sirket:string};
export type CsvIssue={row:number;message:string};
export type CsvReport={recipients:BulkRecipient[];issues:CsvIssue[];duplicates:number;rows:number};
export type BulkInput={name:string;subject:string;text:string;tracking:boolean;csv:string;requestId:string};
export type BulkCounts={queued:number;sending:number;sent:number;unknown:number;failed:number;cancelled:number};
export type BulkCampaign={id:string;name:string;subject:string;status:string;reason:string|null;sender:string;total:number;created_at:string;counts:BulkCounts};
export type BulkDetail=BulkCampaign&{text:string;tracking:boolean;recipients:{id:string;email:string;ad:string;soyad:string;sirket:string;state:string;message_id:string|null;error:string|null;sent_at:string|null}[];offset:number;hasMore:boolean};
export type BulkPreview={report:CsvReport;id?:string;sender?:string;remaining?:number;samples?:{email:string;subject:string;text:string}[]};
export function bulkAllowed(plan:string|null|undefined){return plan==='team'||plan==='business'}
export function validBulkEmail(email:string){const parts=email.split('@');if(parts.length!==2||email.length>254||parts[0].length>64||!parts[0]||parts[0].startsWith('.')||parts[0].endsWith('.')||parts[0].includes('..')||!/^[a-zA-Z0-9._%+-]+$/.test(parts[0]))return false;const labels=parts[1].split('.');return labels.length>=2&&/^[a-zA-Z]{2,63}$/.test(labels.at(-1)!)&&labels.every(label=>/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label))}
const normalizeHeader=(value:string)=>value.trim().toLowerCase().replace(/ı/g,'i').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\s_-]/g,'');
const headers:Record<string,keyof BulkRecipient>={email:'email',eposta:'email',mail:'email',emailaddress:'email',epostaadresi:'email',ad:'ad',isim:'ad',name:'ad',firstname:'ad',adsoyad:'ad',fullname:'ad',soyad:'soyad',surname:'soyad',lastname:'soyad',sirket:'sirket',firma:'sirket',company:'sirket',companyname:'sirket'};
export function parseBulkCsv(input:string):CsvReport{
 const fail=(message:string,row=1):CsvReport=>({recipients:[],issues:[{row,message}],duplicates:0,rows:0});
 if(typeof input!=='string'||new TextEncoder().encode(input).length>BULK_CSV_LIMIT)return fail('CSV dosyası en fazla 512 KB olabilir.');
 let source=input.replace(/^\uFEFF/,'');if(source.includes('\0'))return fail('Dosya geçerli bir CSV metni değil.');
 const lines:{cells:string[];row:number}[]=[];let cells:string[]=[],field='',quoted=false,closed=false,row=1,startRow=1;
 let commas=0,semicolons=0,inQuote=false;for(let i=0;i<source.length;i++){const c=source[i];if(c==='"'){if(inQuote&&source[i+1]==='"'){i++;continue}inQuote=!inQuote;continue}if(!inQuote){if(c==='\r'||c==='\n')break;if(c===',')commas++;if(c===';')semicolons++}}
 const delimiter=semicolons>commas?';':',';
 const pushField=()=>{cells.push(field.trim());field='';closed=false};
 const pushRow=()=>{pushField();if(cells.some(cell=>cell!==''))lines.push({cells,row:startRow});cells=[];if(lines.length>BULK_MAX_RECIPIENTS+1)throw Error('TOO_MANY_ROWS')};
 try{for(let i=0;i<source.length;i++){const c=source[i];if(quoted){if(c==='"'){if(source[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else{field+=c;if(c==='\n')row++}continue}
  if(c==='"'){if(field.trim()||closed)return fail('Tırnak işaretlerini ve sütun ayırıcılarını kontrol edin.',row);field='';quoted=true;continue}
  if(c===delimiter){pushField();continue}
  if(c==='\r'||c==='\n'){pushRow();if(c==='\r'&&source[i+1]==='\n')i++;row++;startRow=row;continue}
  if(closed&&c.trim())return fail('Kapanan tırnaktan sonra ayırıcı bekleniyor.',row);if(!closed)field+=c;
 }if(quoted)return fail('Kapatılmamış tırnak işareti var.',startRow);if(field||cells.length||closed)pushRow()}catch{return fail(`Bir işlemde en fazla ${BULK_MAX_RECIPIENTS} alıcı içe aktarabilirsiniz.`)}
 if(!lines.length)return fail('CSV dosyası boş.');
 const mapping=lines[0].cells.map(header=>headers[normalizeHeader(header)]);
 if(!mapping.includes('email'))return fail('İlk satırda email veya e-posta adlı bir sütun bulunmalı.');
 const recognized=mapping.filter(Boolean);if(new Set(recognized).size!==recognized.length)return fail('Aynı bilgiyi içeren birden fazla sütun var. Sütun başlıklarını kontrol edin.');
 if(lines.length===1)return fail('CSV dosyasına en az bir alıcı ekleyin.');
 const recipients:BulkRecipient[]=[],issues:CsvIssue[]=[],seen=new Set<string>();let duplicates=0;
 for(const entry of lines.slice(1)){if(entry.cells.length!==mapping.length){issues.push({row:entry.row,message:'Sütun sayısı başlık satırıyla uyuşmuyor.'});continue}const recipient:BulkRecipient={email:'',ad:'',soyad:'',sirket:''};mapping.forEach((key,index)=>{if(key)recipient[key]=entry.cells[index]});recipient.email=recipient.email.toLowerCase();
  if(!validBulkEmail(recipient.email)){issues.push({row:entry.row,message:'Geçerli bir e-posta adresi girin.'});continue}
  if([recipient.ad,recipient.soyad,recipient.sirket].some(value=>value.length>100||/[\r\n]/.test(value))){issues.push({row:entry.row,message:'Ad, soyad ve şirket bilgisi tek satır ve en fazla 100 karakter olmalı.'});continue}
  if(seen.has(recipient.email)){duplicates++;continue}seen.add(recipient.email);recipients.push(recipient);
 }
 return {recipients,issues,duplicates,rows:lines.length-1};
}
export function renderBulkText(template:string,recipient:BulkRecipient){const values:Record<string,string>={ad:recipient.ad,soyad:recipient.soyad,sirket:recipient.sirket,eposta:recipient.email};const result=template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g,(_match,key:string)=>{if(!Object.hasOwn(values,key))throw Error('BULK_INVALID_TEMPLATE');return values[key]});if(result.includes('{{')||result.includes('}}'))throw Error('BULK_INVALID_TEMPLATE');return result}
export function validateBulkInput(input:BulkInput){
 if(!input||typeof input.name!=='string'||!input.name.trim()||input.name.length>80||/[\r\n]/.test(input.name)||typeof input.subject!=='string'||!input.subject.trim()||input.subject.length>200||/[\r\n]/.test(input.subject)||typeof input.text!=='string'||!input.text.trim()||input.text.length>10000||typeof input.tracking!=='boolean'||typeof input.csv!=='string'||!/^[a-f0-9-]{36}$/.test(input.requestId))throw Error('BULK_INVALID_INPUT');
 const report=parseBulkCsv(input.csv);if(report.issues.length||!report.recipients.length)return report;
 for(let i=0;i<report.recipients.length;i++){const recipient=report.recipients[i],subject=renderBulkText(input.subject,recipient),text=renderBulkText(input.text,recipient);if(subject.length>200||text.length>10000||!subject.trim()||!text.trim()||/[\r\n]/.test(subject))throw Error('BULK_INVALID_TEMPLATE')}
 return report;
}
export function csvCell(value:string){const safe=/^[\t\r\n]|^\s*[=+@-]/.test(value)?"'"+value:value;return '"'+safe.replace(/"/g,'""')+'"'}
export function bulkCsvTemplate(){return '\uFEFFemail,ad,soyad,sirket\r\n'}
export function decodeBulkCsv(bytes:Uint8Array){if(bytes.byteLength>BULK_CSV_LIMIT)throw Error('CSV_TOO_LARGE');if(bytes[0]===0xff&&bytes[1]===0xfe)return new TextDecoder('utf-16le',{fatal:true}).decode(bytes);if(bytes[0]===0xfe&&bytes[1]===0xff)return new TextDecoder('utf-16be',{fatal:true}).decode(bytes);try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return new TextDecoder('windows-1254').decode(bytes)}}
