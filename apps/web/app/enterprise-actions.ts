'use server';
import {accountApi} from './account-api';
export type EnterpriseState={ok:boolean;error:string}|null;
export async function requestEnterprise(_state:EnterpriseState,form:FormData):Promise<EnterpriseState>{
 const email=String(form.get('email')||'').trim(),company=String(form.get('company')||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)return {ok:false,error:'Geçerli bir e-posta adresi girin.'};
 if(company.length<2||company.length>160||/[\r\n]/.test(company))return {ok:false,error:'Şirket adını 2–160 karakter olarak girin.'};
 try{await accountApi('/api/enterprise-requests',{email,company});return {ok:true,error:''}}catch{return {ok:false,error:'Talebiniz kaydedilemedi. Lütfen tekrar deneyin.'}}
}
