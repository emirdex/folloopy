import test from 'node:test';
import assert from 'node:assert/strict';
import {BLOG_IMAGE_LIMIT,blogImageType,isBlogImage} from '../packages/domain/blog-media';
test('Blog görselleri SVG/HTML, yol geçişi ve büyük dosyaları kabul etmez',()=>{
 assert.equal(blogImageType(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')),null);
 assert.equal(blogImageType(new Uint8Array(BLOG_IMAGE_LIMIT+1)),null);
 assert.equal(isBlogImage('/blog/media/../../secret.png'),false);
 assert.equal(isBlogImage('https://example.com/image.png'),false);
 assert.deepEqual(blogImageType(new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0])),{ext:'png',mime:'image/png'});
});
