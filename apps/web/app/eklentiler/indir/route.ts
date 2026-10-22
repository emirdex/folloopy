import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {requirePanel,accountApi} from '../../account-api';
export const dynamic='force-dynamic';
export async function GET(){const user=await requirePanel();if(!user||!['team','business'].includes(user.plan||''))return new Response('Signature üyeliği gerekli.',{status:403});if(!(await accountApi('/api/extension/status')).allowed)return new Response('Aktif üyelik gerekli.',{status:403});const bytes=await readFile(resolve(process.cwd(),'apps/web/extension-release/folloopy-gmail.zip'));return new Response(bytes,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="folloopy-gmail.zip"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
