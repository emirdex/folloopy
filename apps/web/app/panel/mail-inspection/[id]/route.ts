import {fileTransport} from '../../../file-transport';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))return Response.json({code:'NOT_FOUND'},{status:404,headers:{'Cache-Control':'no-store, private'}});
 return fileTransport(req,'/api/messages/'+id+'/inspection');
}
