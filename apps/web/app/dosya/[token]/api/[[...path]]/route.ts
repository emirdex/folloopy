import {fileTransport} from '../../../../file-transport';
export const dynamic='force-dynamic';
async function handle(req:Request,{params}:{params:Promise<{token:string;path?:string[]}>}){const {token,path=[]}=await params;const part=path.join('/');if(!/^[A-Za-z0-9_-]{43}$/.test(token)||!/^(?:open|download|events|chunks\/[0-8])?$/.test(part))return Response.json({code:'NOT_FOUND'},{status:404});const download=new URL(req.url).searchParams.get('download');return fileTransport(req,'/public/files/'+token+(part?'/'+part:'')+(download&&/^[a-f0-9-]{36}$/.test(download)?'?download='+download:''),true)}
export {handle as GET,handle as POST};
