import {fileTransport} from '../../../../file-transport';
export const dynamic='force-dynamic';
async function handle(req:Request,{params}:{params:Promise<{path?:string[]}>}){const {path=[]}=await params,part=path.join('/');if(!/^(?:settings|report|account-export|reminders|schedules|reminders\/[a-f0-9-]{36}\/cancel|schedules\/[a-f0-9-]{36}\/(?:cancel|resume)|notifications\/[a-f0-9-]{36}\/read)?$/.test(part))return Response.json({code:'NOT_FOUND'},{status:404});const url=new URL(req.url),query=new URLSearchParams();for(const key of ['range','from','to'])if(url.searchParams.has(key))query.set(key,url.searchParams.get(key)!);return fileTransport(req,'/api/member-tools'+(part?'/'+part:'')+(query.size?'?'+query:''))}
export {handle as GET,handle as POST};
