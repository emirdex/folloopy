'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,CheckCheck,FileSpreadsheet,Users,Send,Eye,Pause,Play,RotateCcw,ArrowRight,Mail} from 'lucide-react';
import {FolloopyLogo} from './folloopy-brand';
import './engagement-preview.css';
const stages=[
 {title:'Alıcı listenizi ekleyin',detail:'CSV dosyanızdaki kişiler gönderim listenize aktarılır.',duration:3000},
 {title:'Listenizi kontrol edin',detail:'Adresler ve tekrar eden kayıtlar gönderim öncesinde kontrol edilir.',duration:2800},
 {title:'Her alıcıya özel hazırlayın',detail:'Ad ve şirket alanları mesajınızda kişiye göre yerleşir.',duration:3200},
 {title:'Gönderimleriniz sırayla ilerlesin',detail:'Her alıcıya ayrı bir e-posta, her mesaja ayrı takip.',duration:3600},
 {title:'Sonuçları tek yerden izleyin',detail:'Gönderim durumlarını ve algılanan açılmaları birlikte inceleyin.',duration:6500}
];
export function EngagementPreview(){
 const [step,setStep]=useState(0),[playing,setPlaying]=useState(true),[visible,setVisible]=useState(false),[hidden,setHidden]=useState(false),[reduced,setReduced]=useState(false),[revision,setRevision]=useState(0);
 const root=useRef<HTMLDivElement>(null),remaining=useRef(stages[0].duration),generation=useRef(0);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const preference=()=>{setReduced(media.matches);if(media.matches){setPlaying(false);setStep(4);remaining.current=stages[4].duration}};preference();media.addEventListener('change',preference);const changed=()=>setHidden(document.hidden);changed();document.addEventListener('visibilitychange',changed);const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{threshold:.15});if(root.current)observer.observe(root.current);return()=>{media.removeEventListener('change',preference);observer.disconnect();document.removeEventListener('visibilitychange',changed)}},[]);
 const running=playing&&visible&&!hidden&&!reduced;
 useEffect(()=>{if(!running)return;const start=performance.now(),id=generation.current;const timer=setTimeout(()=>{const next=(step+1)%stages.length;generation.current++;remaining.current=stages[next].duration;setStep(next);setRevision(r=>r+1)},remaining.current);return()=>{clearTimeout(timer);if(id===generation.current)remaining.current=Math.max(0,remaining.current-(performance.now()-start))}},[running,step,revision]);
 function select(index:number,play=false){generation.current++;remaining.current=stages[index].duration;setStep(index);setRevision(r=>r+1);setPlaying(play&&!reduced)}
 const sent=step===4?12:step===3?7:0,opened=step===4?4:0;
 return <div ref={root} className={'bulk-preview bulk-preview-step-'+step+(running?' is-playing':'')} aria-label="CSV ile toplu e-posta gönderim akışı">
  <header className="bulk-preview-chrome"><FolloopyLogo compact/><div><button type="button" aria-label="Toplu gönderim akışını baştan oynat" onClick={()=>select(0,true)}><RotateCcw size={15}/></button><button type="button" aria-label={playing?'Toplu gönderim akışını durdur':'Toplu gönderim akışını oynat'} disabled={reduced} onClick={()=>setPlaying(p=>!p)}>{playing?<Pause size={15}/>:<Play size={15}/>}</button></div></header>
  <div className="bulk-preview-window"><header className="bulk-preview-heading"><div><span>TOPLU GÖNDERİM</span><h3>Bir liste. Kişiye özel mesajlar.</h3></div><span className="bulk-preview-plan">Signature</span></header>
   <div className="bulk-preview-route" aria-hidden="true"><span className={'bulk-preview-node '+(step===0?'is-active':'')}><FileSpreadsheet size={22}/><small>CSV</small></span><span className="bulk-preview-connector"><i/></span><span className={'bulk-preview-node '+(step===1||step===2?'is-active':'')}><Users size={22}/><small>12 alıcı</small></span><span className="bulk-preview-connector bulk-preview-mail-flight"><i/><Mail size={14}/><Mail size={14}/></span><span className={'bulk-preview-node '+(step>=3?'is-active':'')}><Send size={22}/><small>Gönderim</small></span></div>
   <section className={'bulk-preview-file '+(step===0?'is-importing':'')}><span><FileSpreadsheet size={22}/></span><div><strong>iletisim-listesi.csv</strong><small>{step===0?'Alıcı listesi aktarılıyor…':'12 alıcı · Liste kontrol edildi'}</small></div><span className="bulk-preview-file-check">{step===0?<span className="bulk-preview-loader"/>:<CheckCheck size={19}/>}</span></section>
   <div className="bulk-preview-personalize"><span><Mail size={14}/>MESAJ İÇERİĞİ</span><p>Merhaba <b key={step>=2?'name':'field'}>{step>=2?'Deniz':'{{ad}}'}</b>,</p><p><b>{step>=2?'Atlas':'{{sirket}}'}</b> için hazırladığımız çözümü sizinle paylaşmak isteriz.</p><small>{step>=2?<><Check size={12}/>Alıcı bilgileri mesaja eklendi</>:'Kişiselleştirme alanları: ad · şirket'}</small></div>
   <div className="bulk-preview-metrics"><div><span><Users size={14}/>Alıcı</span><strong>12</strong></div><div><span><Send size={14}/>Gönderilen</span><strong key={'sent'+sent}>{sent}<small>/ 12</small></strong></div><div><span><Eye size={14}/>Açılma algılanan</span><strong key={'opened'+opened}>{opened}</strong></div></div>
   <div className="bulk-preview-delivery"><span>{step<3?'Gönderime hazırlık':step===3?'Gönderimler sürüyor':'Gönderim tamamlandı'}<b>{step<3?'—':step===3?'7 / 12':'12 / 12'}</b></span><div><i style={{width:step<3?'0%':step===3?'58.33%':'100%'}}/></div></div>
   <div className="bulk-preview-recipients">{[{name:'Deniz A.',initials:'DA',company:'Atlas'},{name:'Ece K.',initials:'EK',company:'Mavi'},{name:'Mert Y.',initials:'MY',company:'Nova'}].map((person,i)=><div className="bulk-preview-recipient" key={person.initials}><span className="bulk-preview-avatar">{person.initials}</span><div><strong>{person.name}</strong><small>{person.company}</small></div><span className={'bulk-preview-recipient-status '+(step===4&&i<2?'is-open':step>=3?'is-sent':'')}>{step===4&&i<2?<Eye size={12}/>:step>=3?<Check size={12}/>:null}{step===4&&i<2?'Açılma algılandı':step>=3?'Gönderildi':step===0?'Aktarılıyor':'Hazır'}</span></div>)}</div>
  </div>
  <footer className="bulk-preview-caption"><span>{String(step+1).padStart(2,'0')}<small>/ 05</small></span><div key={revision}><h4>{stages[step].title}</h4><p>{stages[step].detail}</p></div></footer><div className="bulk-preview-steps" aria-label="Toplu gönderim aşamaları">{['CSV yükle','Kontrol et','Kişiselleştir','Gönder','Takip et'].map((label,i)=><button type="button" key={label} aria-label={label} aria-pressed={step===i} onClick={()=>select(i)}><span className={i<=step?'is-complete':''}/>{label}</button>)}</div>
 </div>
}
