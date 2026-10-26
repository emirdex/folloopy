import {mkdir,copyFile,cp} from 'node:fs/promises';
const destination=new URL('../apps/web/public/file-viewer/',import.meta.url),source=new URL('../node_modules/pdfjs-dist/',import.meta.url);
await mkdir(destination,{recursive:true});
await copyFile(new URL('build/pdf.worker.min.mjs',source),new URL('pdf.worker.min.mjs',destination));
for(const name of ['cmaps','standard_fonts','wasm'])await cp(new URL(name,source),new URL(name,destination),{recursive:true});
