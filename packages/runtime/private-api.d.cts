import type {ChildProcess} from 'node:child_process';
export function installPrivateApi(child:ChildProcess,origin:string):(url:string,init?:RequestInit)=>Promise<Response>;
export function privateApiFetch(url:string,init?:RequestInit):Promise<Response>;
export function servePrivateApi(app:import('fastify').FastifyInstance,channel?:NodeJS.Process):Promise<void>;
