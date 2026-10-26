import {fileTransport} from '../../../../file-transport';
export const dynamic='force-dynamic';
async function handle(req:Request,{params}:{params:Promise<{path?:string[]}>}){const {path=[]}=await params;const part=path.join('/');const uuid='[a-f0-9-]{36}';if(!new RegExp(`^(?:${uuid}(?:/(?:chunks/[0-8]|complete|delete|shares(?:/${uuid}/revoke)?))?)?$`).test(part))return Response.json({code:'NOT_FOUND'},{status:404});const search=new URL(req.url).searchParams;const offset=search.get('offset');return fileTransport(req,'/api/files'+(part?'/'+part:'')+(offset&&/^\d{1,6}$/.test(offset)?'?offset='+offset:''))}
export {handle as GET,handle as POST};
