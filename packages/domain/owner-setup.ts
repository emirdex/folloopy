import {validNewPassword,PASSWORD_HELP} from './password-policy';
export type OwnerSetupIssue={field:'name'|'token'|'password'|'confirmation';error:string};
export function ownerSetupIssue(form:Pick<FormData,'get'>):OwnerSetupIssue|null{
 const name=String(form.get('name')||'').trim(),token=String(form.get('token')||'').trim(),password=String(form.get('password')||'');
 if(name.length<2||name.length>80)return {field:'name',error:'Adınızı ve soyadınızı 2–80 karakter olarak girin.'};
 if(token.length<32||token.length>128)return {field:'token',error:'Kurulum anahtarı eksik veya geçersiz. Size özel tek kullanımlık anahtarı girin.'};
 if(!validNewPassword(password))return {field:'password',error:PASSWORD_HELP};
 if(password!==String(form.get('confirmation')||''))return {field:'confirmation',error:'Şifreler eşleşmiyor. İki alana da aynı şifreyi yazın.'};
 return null;
}
