export function isMarketingMode(env:NodeJS.ProcessEnv=process.env){
 const mode=env.APP_MODE||(env.NODE_ENV==='production'?'marketing':'application');
 if(!['marketing','application'].includes(mode))throw new Error('CONFIG_APP_MODE_INVALID');
 return mode==='marketing';
}
