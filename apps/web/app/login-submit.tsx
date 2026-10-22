import {ArrowUpRight} from 'lucide-react';
import {FolloopyEyes} from './folloopy-loading';
import './login-submit.css';
export function AuthSubmit({pending,label,pendingLabel,status}:{pending:boolean;label:string;pendingLabel:string;status:string}){
 return <button type="submit" className={'flow-primary login-submit'+(pending?' is-pending':'')} disabled={pending} aria-busy={pending} aria-label={pending?pendingLabel:label}><span className="login-submit-idle" aria-hidden="true"><span>{label}</span><ArrowUpRight size={19}/></span>{pending?<><span className="login-submit-aura" aria-hidden="true"/><span className="login-submit-shimmer" aria-hidden="true"/><span className="login-submit-flight" aria-hidden="true"><span className="login-submit-trail"><i/><i/><i/></span><FolloopyEyes size={39}/><span className="login-submit-caption">{pendingLabel}<span className="login-submit-dots"><i/><i/><i/></span></span></span><span className="login-submit-progress" aria-hidden="true"/><span className="sr-only" role="status">{status}</span></>:null}</button>;
}

export function LoginSubmit({pending}:{pending:boolean}){return <AuthSubmit pending={pending} label="Giriş yap" pendingLabel="Giriş yapılıyor" status="Hesabınıza giriş yapılıyor."/>}
