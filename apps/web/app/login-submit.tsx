import {ArrowUpRight} from 'lucide-react';
import {FolloopyEyes} from './folloopy-loading';
import './login-submit.css';
export function LoginSubmit({pending}:{pending:boolean}){
 return <button type="submit" className={'flow-primary login-submit'+(pending?' is-pending':'')} disabled={pending} aria-busy={pending} aria-label={pending?'Giriş yapılıyor':'Giriş yap'}><span className="login-submit-idle" aria-hidden="true"><span>Giriş yap</span><ArrowUpRight size={19}/></span>{pending?<><span className="login-submit-aura" aria-hidden="true"/><span className="login-submit-shimmer" aria-hidden="true"/><span className="login-submit-flight" aria-hidden="true"><span className="login-submit-trail"><i/><i/><i/></span><FolloopyEyes size={39}/><span className="login-submit-caption">Giriş yapılıyor<span className="login-submit-dots"><i/><i/><i/></span></span></span><span className="login-submit-progress" aria-hidden="true"/><span className="sr-only" role="status">Hesabınıza giriş yapılıyor.</span></>:null}</button>;
}
