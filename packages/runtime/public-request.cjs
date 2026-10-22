// Pin all host-derived URLs to configuration before invoking the custom Next server.
function publicOrigin(env){
 const value=env.DEPLOYMENT_ROLE==='panel'?(env.APP_URL||env.SITE_URL):env.SITE_URL;
 if(!value)throw Error('CONFIG_PUBLIC_ORIGIN_REQUIRED');
 const url=new URL(value);
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('CONFIG_PUBLIC_ORIGIN_INVALID');
 return url.origin;
}
function guardPublicRequest(req,origin){
 const trusted=new URL(origin),host=req.headers?.host;
 // Health probes can use the configured host; arbitrary aliases are not trusted.
 if(typeof host!=='string'||host.toLowerCase()!==trusted.host.toLowerCase())return 421;
 const unsafe=!['GET','HEAD','OPTIONS'].includes(req.method||'GET');
 if(unsafe){
  const source=req.headers.origin;
  if(typeof source!=='string'||source!==trusted.origin)return 403;
 }
 // Upstream forwarded values are not an authority for redirects or action forwarding.
 req.headers.host=trusted.host;
 req.headers['x-forwarded-host']=trusted.host;
 req.headers['x-forwarded-proto']=trusted.protocol.slice(0,-1);
 return null;
}
function canonicalRedirect(req,origin,allowWww){
 const trusted=new URL(origin);
 if(!allowWww||trusted.hostname.startsWith('www.')||!['GET','HEAD'].includes(req.method||'GET'))return null;
 if(typeof req.headers?.host!=='string'||req.headers.host.toLowerCase()!=='www.'+trusted.host.toLowerCase())return null;
 if(typeof req.url!=='string'||!req.url.startsWith('/')||req.url.startsWith('//'))return null;
 return trusted.origin+req.url;
}
module.exports={publicOrigin,guardPublicRequest,canonicalRedirect};
