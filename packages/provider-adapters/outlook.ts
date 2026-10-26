/** Prepared adapter only. No production route enables it until Microsoft setup and client tests pass. */
export class OutlookSubmissionGateway{
 constructor(private accessToken:string,private verified=false){}
 async submit(rawMime:string){if(!this.verified||!this.accessToken)throw Error('OUTLOOK_UNAVAILABLE');const response=await fetch('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{Authorization:'Bearer '+this.accessToken,'Content-Type':'text/plain'},body:Buffer.from(rawMime).toString('base64'),signal:AbortSignal.timeout(15000)});if(response.status!==202)throw Error('OUTLOOK_SEND_UNCONFIRMED');return {status:'accepted' as const,deliveryConfirmed:false as const};}
}
