import {Check} from 'lucide-react';
import './flow-progress.css';

export function FlowProgress({step}:{step:number}){return <nav className="flow-progress" aria-label="Hesap kurulum adımları"><ol>{['Hesap','Paket','Tamamla'].map((label,index)=>{
 const position=index+1,done=step>position,current=step===position;
 return <li key={label} className={done?'is-complete':current?'is-current':'is-upcoming'} aria-current={current?'step':undefined}><div className="flow-progress-step"><b className="flow-progress-number" aria-hidden="true">{done?<Check size={13}/>:position}</b><span>{label}</span>{done?<span className="sr-only"> · Tamamlandı</span>:null}</div>{position<3?<span className="flow-progress-connector" aria-hidden="true"><i/></span>:null}</li>;
 })}</ol></nav>}
