const Fastify=require('fastify');
const {servePrivateApi}=require('../../packages/runtime/private-api.cjs');
const app=Fastify();
app.addHook('onRequest',async(req,reply)=>{if(req.headers.authorization!=='Bearer test-private-token')return reply.code(401).send({code:'UNAUTHORIZED'})});
app.post('/echo',async req=>req.body);
app.get('/binary',async(_req,reply)=>reply.type('application/octet-stream').send(Buffer.from([0,255,10,200])));
app.get('/slow',async()=>{await new Promise(r=>setTimeout(r,100));return {ok:true}});
servePrivateApi(app);
process.on('disconnect',async()=>{await app.close();process.exit(0)});
