import test from 'node:test';
import assert from 'node:assert/strict';
import {fileMailHtml} from '../packages/domain/file-mail';
test('Tracked file card renders safe explicit links while preserving ordinary mail text and escaping HTML',()=>{
 const url='https://panel.example/dosya/'+'A'.repeat(43);
 const html=fileMailHtml('Merhaba\nTeklif.pdf\n'+url+'\nİyi çalışmalar <img src=x onerror=alert(1)>');
 assert.ok(html.includes('href="'+url+'"'));assert.ok(html.includes('Dosyayı görüntüle / indir'));assert.ok(html.includes('Merhaba<br>Teklif.pdf<br>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));
 assert.equal(fileMailHtml('Sıradan\nmail & <i>text</i>'),'Sıradan<br>mail &amp; &lt;i&gt;text&lt;/i&gt;');
 assert.equal(fileMailHtml('javascript:alert(1)'), 'javascript:alert(1)');
});
