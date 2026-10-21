'use client';
import {useActionState,useState} from 'react';
import Link from '../destination-link';
import {ArrowUpRight,CheckCircle2} from 'lucide-react';
import {sendContact} from './actions';
export function ContactForm(){
 const[state,action,pending]=useActionState(sendContact,null);
 const[values,setValues]=useState({name:'',email:'',subject:'',message:''});
 const update=(key:keyof typeof values,value:string)=>setValues(previous=>({...previous,[key]:value}));
 return <form action={action} className="contact-form" aria-label="İletişim formu" aria-busy={pending}>
  <div className="contact-form-fields"><label>Ad soyad<input name="name" autoComplete="name" placeholder="Adınız ve soyadınız" required minLength={2} maxLength={100} value={values.name} onChange={e=>update('name',e.target.value)}/></label><label>E-posta adresi<input name="email" type="email" autoComplete="email" placeholder="siz@sirketiniz.com" required maxLength={254} value={values.email} onChange={e=>update('email',e.target.value)}/></label></div>
  <label>Konu<input name="subject" placeholder="Size nasıl yardımcı olabiliriz?" required minLength={3} maxLength={160} value={values.subject} onChange={e=>update('subject',e.target.value)}/></label>
  <label>Mesajınız<textarea name="message" rows={6} placeholder="Sorunuzu veya talebinizi bizimle paylaşın." required minLength={10} maxLength={5000} value={values.message} onChange={e=>update('message',e.target.value)}/></label>
  <div className="contact-form-trap" aria-hidden="true"><label>Web sitesi<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <p className="contact-privacy">Bilgileriniz yalnızca mesajınızı yanıtlamak için kullanılır. <Link href="/yasal/gizlilik-politikasi">Gizlilik politikası</Link></p>
  {state?.ok?<p className="contact-success" role="status"><CheckCircle2 size={19}/>Mesajınız alındı. En kısa sürede sizinle iletişime geçeceğiz.</p>:state?.error?<p className="contact-error" role="alert">{state.error}</p>:null}
  <button type="submit" disabled={pending||state?.ok===true} className="contact-submit">{pending?'Gönderiliyor…':state?.ok?'Mesajınız gönderildi':'Mesajı gönder'}<ArrowUpRight size={18}/></button>
 </form>
}
