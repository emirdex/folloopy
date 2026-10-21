'use client';
import {useActionState,useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {FlowHeader} from './onboarding';
import {VerificationView} from './verification-view';
import {verifyRegistrationCode,resendRegistrationCode,type VerificationResult} from './verification-actions';
export function VerificationScreen({email,preferredPlan,resendAfter=0}:{email:string;preferredPlan?:string;resendAfter?:number}){
 const router=useRouter();
 const[code,setCode]=useState(''),[legacy,setLegacy]=useState(''),[phase,setPhase]=useState<'entry'|'processing'|'success'>('entry');
 const[cooldown,setCooldown]=useState(resendAfter),[resending,setResending]=useState(false),[resendMessage,setResendMessage]=useState('');
 const[state,action]=useActionState(async(_previous:VerificationResult|null,form:FormData)=>{
  setPhase('processing');const start=performance.now();
  let result:VerificationResult;
  try{result=await verifyRegistrationCode(form)}catch{result={ok:false,message:'Bağlantı kurulamadı. Lütfen yeniden deneyin.'}}
  await new Promise(resolve=>window.setTimeout(resolve,Math.max(0,4000-(performance.now()-start))));
  setPhase(result.ok?'success':'entry');return result;
 },null);
 useEffect(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get('token');if(value&&/^[\w-]{43}$/.test(value))setLegacy(value);if(window.location.hash)history.replaceState(null,'',window.location.pathname+window.location.search)},[]);
 useEffect(()=>{const timer=window.setInterval(()=>setCooldown(value=>Math.max(0,value-1)),1000);return ()=>window.clearInterval(timer)},[]);
 useEffect(()=>{if(!state?.ok)return;const timer=window.setTimeout(()=>router.replace(state.next||'/panel'),1400);return ()=>window.clearTimeout(timer)},[state,router]);
 const resend=async()=>{setResending(true);try{const result=await resendRegistrationCode();setResendMessage(result.message);setCooldown(result.resendAfter);if(result.ok){setLegacy('');setCode('')}}catch{setResendMessage('Kod gönderilemedi. Bağlantınızı kontrol edin.')}finally{setResending(false)}};
 return <div className="onboarding-page"><FlowHeader step={0}/><VerificationView email={email} code={legacy||code} legacy={!!legacy} preferredPlan={preferredPlan} phase={phase} action={action} onCode={setCode} onBack={()=>router.push('/giris')} onResend={resend} resendAfter={cooldown} resending={resending} resendMessage={resendMessage} error={state&&!state.ok?state.message:undefined}/></div>;
}
