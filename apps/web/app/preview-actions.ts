'use server';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
export async function startPurchasePreview(){
 // This is a local UI preview, never a payment confirmation or production entitlement.
 if(process.env.NODE_ENV==='production')throw new Error('LOCAL_PURCHASE_PREVIEW_DISABLED');
 const store=await cookies();
 store.set('mail_tracking_preview','active',{httpOnly:true,sameSite:'lax',path:'/',maxAge:8*60*60,secure:false});
 redirect('/panel');
}
export async function endPurchasePreview(){
 const store=await cookies();store.delete('mail_tracking_preview');redirect('/');
}
