'use client';
import {useEffect,useRef,useState,useTransition,type FormEvent} from 'react';
import {useRouter} from 'next/navigation';
import {leaveVerification} from './account-actions';
import {FlowHeader} from './onboarding';
import {VerificationView} from './verification-view';
import {verifyRegistrationCode,resendRegistrationCode,type VerificationResult} from './verification-actions';
export function VerificationScreen({email,preferredPlan,resendAfter=0}:{email:string;preferredPlan?:string;resendAfter?:number}){
 const router=useRouter();const[leaving,startLeaving]=useTransition();
 const[code,setCode]=useState(''),[legacy,setLegacy]=useState(''),[phase,setPhase]=useState<'entry'|'processing'|'success'>('entry');
 const[cooldown,setCooldown]=useState(resendAfter),[resending,setResending]=useState(false),[resendMessage,setResendMessage]=useState('');
 const[state,setState]=useState<VerificationResult|null>(null);const submitting=useRef(false);
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();if(submitting.current||leaving)return;
  // Capture enabled fields before the immediate processing render disables them.
  const form=new FormData(event.currentTarget);submitting.current=true;setState(null);setPhase('processing');const start=performance.now();
  let result:VerificationResult;
  try{result=await verifyRegistrationCode(form)}catch{result={ok:false,message:'Bağlantı kurulamadı. Lütfen yeniden deneyin.'}}
  await new Promise(resolve=>window.setTimeout(resolve,Math.max(0,4000-(performance.now()-start))));
  setState(result);setPhase(result.ok?'success':'entry');submitting.current=false;
 };
 useEffect(()=>{const value=new URLSearchParams(window.location.hash.slice(1)).get('token');if(value&&/^[\w-]{43}$/.test(value))setLegacy(value);if(window.location.hash)history.replaceState(null,'',window.location.pathname+window.location.search)},[]);
 useEffect(()=>{const timer=window.setInterval(()=>setCooldown(value=>Math.max(0,value-1)),1000);return ()=>window.clearInterval(timer)},[]);
 useEffect(()=>{if(!state?.ok)return;const timer=window.setTimeout(()=>router.replace(state.next||'/panel'),1400);return ()=>window.clearTimeout(timer)},[state,router]);
 const resend=async()=>{setResending(true);try{const result=await resendRegistrationCode();setResendMessage(result.message);setCooldown(result.resendAfter);if(result.ok){setLegacy('');setCode('')}}catch{setResendMessage('Kod gönderilemedi. Bağlantınızı kontrol edin.')}finally{setResending(false)}};
 return <div className="onboarding-page"><FlowHeader step={0}/><VerificationView email={email} code={legacy||code} legacy={!!legacy} preferredPlan={preferredPlan} phase={phase} onSubmit={submit} onCode={setCode} leaving={leaving} onBack={()=>startLeaving(async()=>{try{await leaveVerification()}catch{setResendMessage('Çıkış yapılamadı. Lütfen yeniden deneyin.')}})} onResend={resend} resendAfter={cooldown} resending={resending} resendMessage={resendMessage} error={state&&!state.ok?state.message:undefined}/></div>;
}
