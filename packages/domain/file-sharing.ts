export const FILE_CHUNK_SIZE=3*1024*1024;
export const FILE_MAX_SIZE=25*1024*1024;
export const FILE_TYPES={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain',csv:'text/csv',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',zip:'application/zip'} as const;
export function filePolicy(plan:string|null|undefined){
 if(plan==='individual')return {name:'Essential',files:3,fileBytes:10*1024*1024,storageBytes:50*1024*1024,days:90,advanced:false,extensions:['pdf']};
 if(plan==='team'||plan==='business')return {name:'Signature',files:100,fileBytes:FILE_MAX_SIZE,storageBytes:2*1024*1024*1024,days:365,advanced:true,extensions:Object.keys(FILE_TYPES)};
 return {name:'Free',files:0,fileBytes:0,storageBytes:0,days:7,advanced:false,extensions:[] as string[]};
}
export function fileExtension(name:string){return name.split('.').pop()?.toLowerCase()||''}
export function validFileName(name:unknown):name is string{return typeof name==='string'&&name.trim()===name&&name.length>0&&name.length<=180&&!/[\x00-\x1f\x7f/\\<>]/.test(name)&&Object.hasOwn(FILE_TYPES,fileExtension(name))}
export function validFileHeader(ext:string,bytes:Uint8Array){
 const b=bytes,ascii=(start:number,end:number)=>String.fromCharCode(...b.subarray(start,end));
 if(ext==='pdf')return ascii(0,5)==='%PDF-';
 if(ext==='png')return b[0]===137&&ascii(1,4)==='PNG'&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10;
 if(ext==='jpg'||ext==='jpeg')return b[0]===255&&b[1]===216&&b[2]===255;
 if(ext==='webp')return ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
 if(['zip','docx','xlsx','pptx'].includes(ext))return ascii(0,2)==='PK'&&b[2]===3&&b[3]===4;
 if(ext==='txt'||ext==='csv'){try{new TextDecoder('utf-8',{fatal:true}).decode(b);return !b.includes(0)}catch{return false}}
 return false;
}
export const fileEventLabels:Record<string,string>={link_visit:'Paylaşım sayfasına erişim',preview:'Önizleme görüntülendi',page_view:'PDF sayfası görüntülendi',active_time:'Yaklaşık aktif görüntüleme',download_requested:'İndirme istendi',download_received:'Dosyanın tamamı tarayıcıya ulaştı'};
export const fileErrorMessages:Record<string,string>={FILE_PLAN_REQUIRED:'Paketiniz takipli dosya paylaşımını kapsamıyor.',FILE_PLAN_LIMIT:'Dosya mevcut paketinizin sınırları dışında.',FILE_LIMIT:'Dosya sayısı veya depolama sınırınıza ulaştınız.',INVALID_FILE:'Dosya türünü, adını ve boyutunu kontrol edin.',FILE_INCOMPLETE:'Dosya yüklemesi tamamlanamadı. Yeniden deneyin.',FILE_UNAVAILABLE:'Dosya paylaşımı şu anda kullanılamıyor.',SHARE_UNAVAILABLE:'Bu paylaşım kapatılmış, süresi dolmuş veya paket sınırları dışında.',SHARE_PASSWORD:'Paylaşım şifresi geçersiz.',TOO_MANY_ATTEMPTS:'Çok fazla deneme yapıldı. Bir süre sonra yeniden deneyin.'};
export function fileError(code:string){return fileErrorMessages[code]||'İşlem tamamlanamadı. Yeniden deneyin.'}
export function fileSize(bytes:number){return bytes>=1024*1024?`${(bytes/1024/1024).toLocaleString('tr-TR',{maximumFractionDigits:1})} MB`:`${Math.ceil(bytes/1024)} KB`}
