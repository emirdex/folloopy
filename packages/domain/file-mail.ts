import {escapeHtml} from './tracking';
/** Only render the explicit hosted-file links; never turn user HTML into markup. */
export function fileMailHtml(text:string){
 const pattern=/https?:\/\/[^\s<>"']+\/dosya\/[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g;
 let result='',offset=0;
 for(const match of text.matchAll(pattern)){result+=escapeHtml(text.slice(offset,match.index)).replace(/\n/g,'<br>');const href=escapeHtml(match[0]);result+=`<div style="margin:16px 0;padding:16px;border:1px solid #dce5f5;border-radius:14px;background:#f6f9ff"><strong>Takipli dosya paylaşımı</strong><br><a href="${href}" style="color:#456ca9;display:inline-block;margin-top:10px">Dosyayı görüntüle / indir</a><br><small>Dosyaya erişim, önizleme ve indirme hareketleri kaydedilir.</small></div>`;offset=match.index!+match[0].length}
 return result+escapeHtml(text.slice(offset)).replace(/\n/g,'<br>');
}
