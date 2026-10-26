import {ProviderRejected} from './index';
/** Prepared adapter only. No production route enables it until Microsoft setup and client tests pass.
 * Graph returns no message identifier for MIME sendMail. Do not invent a provider receipt.
 * Never retry this request automatically: acceptance can precede a lost response.
 */
export class OutlookSubmissionGateway{
 constructor(private accessToken:string,private verified=false,private request:typeof fetch=fetch){}
 async submit(rawMime:string){
  if(!this.verified||!this.accessToken.trim())throw Error('OUTLOOK_UNAVAILABLE');
  if(!rawMime.trim())throw Error('OUTLOOK_INVALID_MIME');
  let response:Response;
  try{response=await this.request('https://graph.microsoft.com/v1.0/me/sendMail',{
   method:'POST',redirect:'error',headers:{Authorization:'Bearer '+this.accessToken,'Content-Type':'text/plain'},
   body:Buffer.from(rawMime,'utf8').toString('base64'),signal:AbortSignal.timeout(15000)
  })}catch{throw Error('OUTLOOK_SEND_UNCONFIRMED')}
  if([400,401,403,404,413,422,429].includes(response.status))throw new ProviderRejected();
  if(response.status!==202)throw Error('OUTLOOK_SEND_UNCONFIRMED');
  return {status:'accepted' as const,deliveryConfirmed:false as const};
 }
}
