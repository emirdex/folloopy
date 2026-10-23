import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';

// Persist once per build: next.config is evaluated again when workers start.
// A random value inside next.config would give each worker a different version.
writeFileSync(new URL('../../apps/web/.deployment-id',import.meta.url),randomUUID()+'\n');
console.log('Folloopy deployment version prepared');
