/** Configuration diagnostics only. This does not enable an integration or expose secret values. */
export const OUTLOOK_REDIRECT_URI='https://panel.folloopy.com/api/oauth/microsoft/callback';
export const OUTLOOK_DELEGATED_SCOPES=['openid','profile','offline_access','https://graph.microsoft.com/User.Read','https://graph.microsoft.com/Mail.Send'] as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function outlookReadiness(env:Record<string,string|undefined>){
 const issues:string[]=[];
 if(!uuid.test(env.MICROSOFT_CLIENT_ID||''))issues.push('MICROSOFT_CLIENT_ID_REQUIRED');
 if(!env.MICROSOFT_CLIENT_SECRET?.trim())issues.push('MICROSOFT_CLIENT_SECRET_REQUIRED');
 // Folloopy is intended for both personal Outlook and Microsoft 365 accounts.
 if(env.MICROSOFT_TENANT!=='common')issues.push('MICROSOFT_TENANT_COMMON_REQUIRED');
 if(env.MICROSOFT_REDIRECT_URI!==OUTLOOK_REDIRECT_URI)issues.push('MICROSOFT_REDIRECT_URI_MISMATCH');
 if(env.MICROSOFT_CLIENT_SECRET_EXPIRES_AT){
  const expires=Date.parse(env.MICROSOFT_CLIENT_SECRET_EXPIRES_AT);
  if(!Number.isFinite(expires)||expires<=Date.now())issues.push('MICROSOFT_CLIENT_SECRET_EXPIRED');
 }
 return {configured:issues.length===0,issues,
  // A configuration flag alone cannot certify mailbox, callback or add-in support.
  available:false as const,reason:'OUTLOOK_IMPLEMENTATION_AND_CLIENT_VERIFICATION_PENDING' as const};
}
