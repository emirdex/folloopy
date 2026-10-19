export function productionConfig(env:NodeJS.ProcessEnv=process.env){
 const production=env.NODE_ENV==='production';
 if(production&&env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw Error('CONFIG_TLS_VERIFICATION_REQUIRED');
 const required=(name:string,min=1)=>{const value=env[name]?.trim()||'';if(production&&value.length<min)throw new Error('CONFIG_REQUIRED_'+name);return value};
 const site=env.SITE_URL||env.NEXT_PUBLIC_SITE_URL||'http://127.0.0.1:3000';
 const url=new URL(site);if(production&&(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password))throw new Error('CONFIG_SITE_URL_HTTPS_REQUIRED');
 const database=required('DATABASE_URL');if(database&&!/^postgres(?:ql)?:\/\//.test(database))throw new Error('CONFIG_DATABASE_URL_INVALID');
 const key=env.INTERNAL_API_KEY||(!production?env.DEV_API_KEY:'')||'';if(production&&key.length<32)throw new Error('CONFIG_INTERNAL_API_KEY_REQUIRED');
 const encryption=required('DATA_ENCRYPTION_KEY',1);if(production&&(Buffer.from(encryption,'base64').length!==32))throw new Error('CONFIG_ENCRYPTION_KEY_INVALID');
 const admin=required('ADMIN_OWNER_EMAIL');if(admin&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin))throw new Error('CONFIG_ADMIN_EMAIL_INVALID');
 if(production){required('RESEND_API_KEY');const from=required('MAIL_FROM');if(/[\r\n]/.test(from)||!from.includes('@'))throw Error('CONFIG_MAIL_FROM_INVALID');const actions=required('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY');if(Buffer.from(actions,'base64').length!==32)throw Error('CONFIG_ACTIONS_KEY_INVALID');}
 const billing=env.BILLING_MODE||'disabled';if(!['disabled','complimentary'].includes(billing))throw new Error('CONFIG_BILLING_MODE_INVALID');
 const apiPort=Number(env.API_PORT||4000);if(!Number.isInteger(apiPort)||apiPort<1024||apiPort>65535)throw new Error('CONFIG_API_PORT_INVALID');
 const apiUrl=env.INTERNAL_API_URL||`http://127.0.0.1:${apiPort}`;const internal=new URL(apiUrl);if(production&&(internal.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(internal.hostname)||internal.pathname!=='/'||internal.search||internal.hash||internal.username||internal.password))throw Error('CONFIG_INTERNAL_API_URL_INVALID');
 return {production,site:url.origin,database,key,encryption,admin,billing,apiPort,apiUrl};
}
