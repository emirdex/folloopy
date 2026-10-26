import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));
test('Compiled production API boots, applies copied migrations and serves health without tsx or an esbuild runtime service',{timeout:60000},async()=>{
 await exec(process.execPath,['scripts/build-api-runtime.mjs'],{cwd:root,timeout:20000});
 const bundle=await readFile(new URL('../runtime-build/application.mjs',import.meta.url),'utf8');
 assert.equal(/(?:from|import\()\s*['"](?:tsx|esbuild)(?:\/|['"])/.test(bundle),false);
 const directory=await mkdtemp(join(tmpdir(),'folloopy-compiled-runtime-'));
 try{
  await mkdir(join(directory,'.data'));
  const script=`const {startApi}=await import(${JSON.stringify(new URL('../runtime-build/application.mjs',import.meta.url).href)});
   const runtime=await startApi({production:false,site:'http://localhost',appSite:'http://localhost',trackingSite:'http://localhost',backgroundWorkers:false,role:'combined',database:'',key:'synthetic-local-key-with-at-least-32-characters',encryption:'',admin:'qa@example.invalid',billing:'disabled',apiPort:4000,apiUrl:'http://127.0.0.1:4000'});
   try{const r=await runtime.app.inject({method:'GET',url:'/health'});if(r.statusCode!==200)throw Error('BUNDLE_HEALTH_FAILED');console.log('COMPILED_RUNTIME_HEALTH_OK')}finally{await runtime.close()}`;
  const result=await exec(process.execPath,['--input-type=module','-e',script],{cwd:directory,timeout:40000,env:{...process.env,NODE_ENV:'test',DATABASE_URL:'',SEED_BLOG:'false'}});
  assert.match(result.stdout,/COMPILED_RUNTIME_HEALTH_OK/);
 }finally{await rm(directory,{recursive:true,force:true})}
});
