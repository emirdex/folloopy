export type BillingProfile={kind:'individual'|'company';name:string;email:string;city:string;district:string;address:string;postalCode:string;companyName:string;taxOffice:string;taxNumber:string};
export function billingProfile(input:unknown):BillingProfile{
 if(!input||typeof input!=='object')throw Error('INVALID_BILLING_PROFILE');
 const values=input as Record<string,unknown>;
 const field=(key:string,min:number,max:number)=>{const value=typeof values[key]==='string'?values[key].trim():'';if(value.length<min||value.length>max||/[\u0000-\u001f]/.test(value))throw Error('INVALID_BILLING_PROFILE');return value};
 if(!['individual','company'].includes(String(values.kind)))throw Error('INVALID_BILLING_PROFILE');
 const kind=values.kind as BillingProfile['kind'];
 const profile={kind,name:field('name',2,80),email:field('email',3,254).toLowerCase(),city:field('city',2,80),district:field('district',2,80),address:field('address',10,500),postalCode:field('postalCode',0,10),companyName:kind==='company'?field('companyName',2,180):'',taxOffice:kind==='company'?field('taxOffice',2,100):'',taxNumber:kind==='company'?field('taxNumber',10,10):''};
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)||(profile.postalCode&&!/^\d{5}$/.test(profile.postalCode))||(kind==='company'&&!/^\d{10}$/.test(profile.taxNumber)))throw Error('INVALID_BILLING_PROFILE');
 return profile;
}
