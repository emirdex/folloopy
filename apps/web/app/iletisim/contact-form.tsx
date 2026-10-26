'use client';
import {useActionState,useState} from 'react';
import Link from '../destination-link';
import {ArrowUpRight,CheckCircle2} from 'lucide-react';
import {sendContact} from './actions';
export function ContactForm(){
 const[state,action,pending]=useActionState(sendContact,null);
 const[values,setValues]=useState({firstName:'',lastName:'',email:'',phone:'',subject:'',message:''});
 const[kvkkAcknowledged,setKvkkAcknowledged]=useState(false);
 const update=(key:keyof typeof values,value:string)=>setValues(previous=>({...previous,[key]:value}));
 return <form action={action} className="contact-form" aria-label="İletişim formu" aria-busy={pending}>
  <div className="contact-form-fields"><label>Ad<input name="firstName" autoComplete="given-name" placeholder="Adınız" required maxLength={50} value={values.firstName} onChange={e=>update('firstName',e.target.value)}/></label><label>Soyad<input name="lastName" autoComplete="family-name" placeholder="Soyadınız" required maxLength={50} value={values.lastName} onChange={e=>update('lastName',e.target.value)}/></label></div>
  <div className="contact-form-fields"><label>E-posta adresi<input name="email" type="email" autoComplete="email" placeholder="siz@sirketiniz.com" required maxLength={254} value={values.email} onChange={e=>update('email',e.target.value)}/></label><label>Telefon numarası<span className="contact-phone"><span className="contact-phone-prefix" aria-hidden="true"><svg viewBox="0 0 30 20" width="24" height="16"><rect width="30" height="20" rx="2" fill="#e30a17"/><circle cx="11" cy="10" r="5" fill="#fff"/><circle cx="12.4" cy="10" r="4" fill="#e30a17"/><path d="m18.3 6.9.74 2.28h2.4l-1.94 1.41.74 2.28-1.94-1.41-1.94 1.41.74-2.28-1.94-1.41h2.4Z" fill="#fff"/></svg><span>+90</span></span><input name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="5XXXXXXXXX" required minLength={10} maxLength={10} pattern="[1-9][0-9]{9}" title="Başında 0 olmadan 10 haneli telefon numaranızı yazın." value={values.phone} onPaste={event=>{event.preventDefault();let digits=event.clipboardData.getData('text').replace(/\D/g,'').replace(/^0+/,'');if(digits.length===12&&digits.startsWith('90'))digits=digits.slice(2);const start=event.currentTarget.selectionStart??values.phone.length,end=event.currentTarget.selectionEnd??start;update('phone',(values.phone.slice(0,start)+digits+values.phone.slice(end)).replace(/^0+/,'').slice(0,10))}} onChange={e=>update('phone',e.target.value.replace(/\D/g,'').replace(/^0+/,'').slice(0,10))}/></span></label></div>
  <label>Konu<input name="subject" placeholder="Size nasıl yardımcı olabiliriz?" required minLength={3} maxLength={160} value={values.subject} onChange={e=>update('subject',e.target.value)}/></label>
  <label>Mesajınız<textarea name="message" rows={6} placeholder="Sorunuzu veya talebinizi bizimle paylaşın." required minLength={10} maxLength={5000} value={values.message} onChange={e=>update('message',e.target.value)}/></label>
  <div className="contact-form-trap" aria-hidden="true"><label>Web sitesi<input name="website" tabIndex={-1} autoComplete="off"/></label></div>
  <label className="contact-kvkk"><input type="checkbox" name="kvkkAcknowledged" value="on" required checked={kvkkAcknowledged} onChange={event=>setKvkkAcknowledged(event.target.checked)}/><span>ArcByte Yazılım Teknolojileri Limited Şirketi tarafından kişisel verilerimin işlenmesine ilişkin <Link href="/yasal/kvkk-aydinlatma-metni" target="_blank" rel="noopener noreferrer">KVKK Aydınlatma Metni</Link>’ni okudum ve bilgilendirildim.</span></label>
  <p className="contact-privacy">Bilgileriniz yalnızca mesajınızı yanıtlamak için kullanılır. <Link href="/yasal/gizlilik-politikasi">Gizlilik politikası</Link></p>
  {state?.ok?<p className="contact-success" role="status"><CheckCircle2 size={19}/>Mesajınız alındı. En kısa sürede sizinle iletişime geçeceğiz.</p>:state?.error?<p className="contact-error" role="alert">{state.error}</p>:null}
  <button type="submit" disabled={pending||state?.ok===true} className="contact-submit">{pending?'Gönderiliyor…':state?.ok?'Mesajınız gönderildi':'Mesajı gönder'}<ArrowUpRight size={18}/></button>
 </form>
}
