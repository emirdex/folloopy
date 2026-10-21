'use server';
import {revalidatePath} from 'next/cache';
import {accountApi,requireAccount} from '../account-api';
import {billingProfile} from '../../../../packages/domain/billing-profile';
export async function saveBilling(_previous:{ok:boolean;message:string}|null,form:FormData){
 await requireAccount();
 try{
  const profile=billingProfile(Object.fromEntries(['kind','name','email','city','district','address','postalCode','companyName','taxOffice','taxNumber'].map(key=>[key,String(form.get(key)||'')])));
  await accountApi('/api/account/billing',profile);
 }catch{return {ok:false,message:'Bilgilerinizi kontrol edin. Kurumsal fatura için şirket unvanı, vergi dairesi ve 10 haneli vergi numarası gereklidir.'}}
 revalidatePath('/panel');return {ok:true,message:'Fatura bilgileriniz kaydedildi.'};
}
