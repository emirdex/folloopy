import {servePrivateApi} from '../../packages/runtime/private-api.cjs';
import {productionConfig} from '../../packages/runtime/config';
import {startApi} from './runtime';
const config=productionConfig();
const runtime=await startApi(config);
if(process.env.FOLLOOPY_API_TRANSPORT==='ipc'&&process.send){
 await servePrivateApi(runtime.app);
 console.log('Folloopy API ready (private IPC)');
}else{
 await runtime.app.listen({host:'127.0.0.1',port:config.apiPort});
}
let closing=false;const close=async()=>{if(closing)return;closing=true;await runtime.close();process.exit(0)};
process.on('SIGTERM',close);process.on('SIGINT',close);process.on('disconnect',close);
