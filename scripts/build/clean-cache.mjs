import {rm} from 'node:fs/promises';
// Compilation caches are reproducible build inputs, not runtime assets or user data.
// Keep Next's image/data cache, build output, static files, uploads and dependencies.
for(const directory of ['webpack','swc','turbopack'])await rm(new URL('../../apps/web/.next/cache/'+directory,import.meta.url),{recursive:true,force:true});
console.log('Folloopy disposable compilation caches removed');
