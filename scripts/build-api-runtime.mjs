import {mkdir,copyFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
// Bound Go helper threads during builds on the shared host, too.
process.env.GOMAXPROCS||='2';
const {build,stop}=await import('esbuild');
const output=new URL('../runtime-build/',import.meta.url);
await mkdir(new URL('migrations/',output),{recursive:true});
try{
 await build({entryPoints:[fileURLToPath(new URL('../packages/runtime/application.ts',import.meta.url))],outfile:fileURLToPath(new URL('application.mjs',output)),bundle:true,platform:'node',target:'node22',format:'esm',packages:'external',logLevel:'warning'});
 // Database migration URLs are relative to import.meta.url in the bundled file.
 const migrations=new URL('../packages/database/migrations/',import.meta.url);
 for(const file of await readdir(migrations))if(file.endsWith('.sql'))await copyFile(new URL(file,migrations),new URL('migrations/'+file,output));
}finally{stop()}
console.log('Folloopy production API compiled; runtime TypeScript service is not required');
