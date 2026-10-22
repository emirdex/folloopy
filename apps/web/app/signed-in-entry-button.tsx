'use client';
import {useFormStatus} from 'react-dom';
import {ArrowRight} from 'lucide-react';
export function EntrySwitchButton({register}:{register:boolean}){const{pending}=useFormStatus();return <button className="session-entry-switch" type="submit" disabled={pending}>{pending?'Oturum kapatılıyor…':register?'Çıkış Yap ve Yeni Hesap Oluştur':'Farklı Bir Hesapla Giriş Yap'}<ArrowRight size={16}/></button>}
