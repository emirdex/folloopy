'use client';
import {useActionState} from 'react';
import {createMember} from './actions';
import {PASSWORD_PATTERN,PASSWORD_HELP} from '../../../../packages/domain/password-policy';
export function CreateMemberForm(){
 const[state,action,pending]=useActionState(createMember,null);
 return <form action={action} className="admin-surface admin-detail-card admin-form">
  <label>Ad soyad<input name="name" autoComplete="off" required minLength={2} maxLength={80}/></label>
  <label>E-posta adresi<input name="email" type="email" autoComplete="off" required maxLength={254}/></label>
  <label>İlk giriş şifresi<input name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} pattern={PASSWORD_PATTERN} title={PASSWORD_HELP}/><small>{PASSWORD_HELP}</small></label>
  <label>Şifre tekrar<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={8} maxLength={128}/></label>
  <label>Paket<select name="plan" defaultValue="individual"><option value="individual">Essential</option><option value="team">Signature</option></select></label>
  <p className="admin-note">Paket tahsilatsız atanır. E-posta doğrulaması ilk girişte istenir. Mevcut bir hesap değiştirilmez.</p>
  {state?.error?<p className="admin-error" role="alert">{state.error}</p>:null}
  <button className="admin-primary" disabled={pending}>{pending?'Üye oluşturuluyor…':'Üyeyi oluştur'}</button>
 </form>;
}
