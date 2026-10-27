'use client';
import {FolloopyLogo} from './folloopy-brand';
import {useEffect,useRef,useState} from 'react';
import {Check,Send,Activity,Eye,Mail,Pause,Play,RotateCcw,Clock3} from 'lucide-react';
import './flow-demo.css';
const stages=[
 {label:'Maili hazırlayın',title:'Teklifinizi Folloopy’den gönderin.',copy:'Mailinizi hazırlayın, takibi açın ve kendi bağlı hesabınızdan gönderin.'},
 {label:'Gönderimi görün',title:'Gönderdiğiniz mail panelinize düşer.',copy:'Konu, gönderim durumu ve takip bilgisi aynı kayıtta bir araya gelir.'},
 {label:'Açılmayı takip edin',title:'Açılma kaydı geldiğinde paneliniz güncellenir.',copy:'İlk açılma zamanı grafiğe ve mailinizin etkinlik geçmişine yansır.'},
 {label:'Sonraki adımı planlayın',title:'Tekrar açılmayı da gözden kaçırmayın.',copy:'Yeni hareketi zaman çizelgesinde görün; takip görüşmenizi buna göre planlayın.'}
];
export function FlowDemo(){
 const root=useRef<HTMLDivElement>(null),elapsed=useRef(0),generation=useRef(0);
 const[step,setStep]=useState(0),[playing,setPlaying]=useState(true),[visible,setVisible]=useState(false),[foreground,setForeground]=useState(true),[reduced,setReduced]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const preference=()=>{setReduced(media.matches);if(media.matches){setPlaying(false);elapsed.current=18000;setStep(3)}};preference();media.addEventListener('change',preference);const observer=new IntersectionObserver(entries=>setVisible(entries[0].isIntersecting),{threshold:.15});if(root.current)observer.observe(root.current);const visibility=()=>setForeground(!document.hidden);visibility();document.addEventListener('visibilitychange',visibility);return()=>{media.removeEventListener('change',preference);observer.disconnect();document.removeEventListener('visibilitychange',visibility)}},[]);
 const running=playing&&visible&&foreground&&!reduced;
 useEffect(()=>{
  if(!running)return;
  const start=performance.now(),id=generation.current,offset=elapsed.current%6000,remaining=6000-offset;
  // Animate only the small progress track; avoid invalidating the whole demo's
  // inherited styles and dispatching React updates every 80 milliseconds.
  const track=root.current?.querySelector<HTMLElement>('.flow-navigation>.active .flow-stage-track i');
  const progress=track?.animate([{transform:`scaleX(${offset/6000})`},{transform:'scaleX(1)'}],{duration:remaining,easing:'linear',fill:'forwards'});
  const timer=setTimeout(()=>{generation.current++;elapsed.current=((step+1)%4)*6000;root.current?.style.setProperty('--flow-progress','0');setStep((step+1)%4)},remaining);
  return()=>{clearTimeout(timer);if(id===generation.current){elapsed.current=(elapsed.current+performance.now()-start)%24000;root.current?.style.setProperty('--flow-progress',String((elapsed.current%6000)/6000))}progress?.cancel()};
 },[running,step,revision]);
 function seek(index:number){generation.current++;setRevision(value=>value+1);elapsed.current=index*6000;root.current?.style.setProperty('--flow-progress','0');setStep(index);setPlaying(false)}
 function replay(){generation.current++;setRevision(value=>value+1);elapsed.current=0;root.current?.style.setProperty('--flow-progress','0');setStep(0);setPlaying(!reduced)}
 const sent=step>=1,opened=step>=2,reopened=step>=3;
 const events=[{title:'Mail gönderildi',time:'10:24',icon:Send,shown:sent},{title:'İlk açılma algılandı',time:'10:27',icon:Eye,shown:opened},{title:'Tekrar açılma algılandı',time:'10:42',icon:Activity,shown:reopened}];
 return <div ref={root} className={'flow-demo '+(running?'flow-running':'flow-paused')} aria-label="Folloopy ile mail takibinin işleyişi"><div className="flow-topline"><span><Activity size={15}/>Folloopy ile takip</span><button onClick={replay} aria-label="Akışı baştan oynat" title="Baştan oynat"><RotateCcw size={14}/></button><button onClick={()=>setPlaying(p=>!p)} disabled={reduced} aria-label={playing?'Akışı durdur':'Akışı oynat'} title={reduced?'Azaltılmış hareket tercihi açık':playing?'Duraklat':'Oynat'}>{playing?<Pause size={14}/>:<Play size={14}/>}</button></div>
 <div className={'flow-workspace flow-step-'+step}><div className="flow-app-header"><FolloopyLogo compact/><span>Genel bakış</span><i/><span className="flow-avatar">EK</span></div><div className="flow-panel-body"><div className="flow-panel-heading"><div><small>ÇALIŞMA ALANINIZ</small><h3>Mailinizin takibi, tek yerde.</h3></div><span className="flow-panel-time"><Clock3 size={11}/>{reopened?'10:42':opened?'10:27':'10:24'}</span></div>
 <div className="flow-metrics">{[{label:'Gönderilen mail',value:sent?'1':'0',icon:Send,tint:'blue'},{label:'Açılma algılanan',value:opened?'1':'0',icon:Eye,tint:'mint'},{label:'Tekrar açılma',value:reopened?'1':'0',icon:Activity,tint:'violet'}].map(metric=><div className={'flow-metric metric-'+metric.tint} key={metric.label}><span>{metric.label}<metric.icon size={13}/></span><strong key={metric.value}>{metric.value}</strong></div>)}</div>
 <div className="flow-insights"><section className="flow-chart"><header><h4>Mailin hareketleri</h4><span>Bugün</span></header><div className="flow-chart-legend"><span><i/>Gönderim</span><span><i/>Açılma</span></div><div className="flow-plot" role="img" aria-label={`${sent?1:0} gönderim ve ${reopened?2:opened?1:0} açılma kaydı`}><span className="flow-chart-max">1</span><span className="flow-chart-zero">0</span><div className="flow-plot-grid"><i/><i/><i/></div><div className="flow-columns">{[{time:'10:24',shown:sent,kind:'sent'},{time:'10:27',shown:opened,kind:'opened'},{time:'10:42',shown:reopened,kind:'opened'}].map(bar=><div className="flow-column" key={bar.time}><div><span className={'flow-bar bar-'+bar.kind+(bar.shown?' is-visible':'')}/></div><small>{bar.time}</small></div>)}</div></div></section><section className="flow-history"><header><Activity size={12}/><h4>Etkinlik geçmişi</h4></header><div className="flow-event-list">{events.map(event=><div key={event.title} className={'flow-event '+(event.shown?'is-visible':'is-waiting')}><span><event.icon size={12}/></span><div><strong>{event.shown?event.title:'Hareket bekleniyor'}</strong><small>{event.shown?event.time:'—'}</small></div>{event.shown?<Check size={11}/>:null}</div>)}</div></section></div>
 <div className="flow-mail-record"><span className="flow-mail-icon"><Mail size={16}/></span><div><strong>Web sitesi projesi · Teklifimiz</strong><small>{sent?'Deniz A. · Bugün, 10:24':'Deniz A. · Gönderime hazır'}</small></div><span className={'flow-mail-status '+(opened?'has-opened':'')}>{opened?<Eye size={11}/>:sent?<Check size={11}/>:<Clock3 size={11}/>}<span>{reopened?'Tekrar açıldı':opened?'Açılma algılandı':sent?'Gönderildi':'Hazır'}</span></span></div>
 </div>{!sent?<div className="flow-compose-preview"><div className="flow-compose-title"><span><Mail size={14}/>Yeni mail</span><span>Folloopy</span></div><div className="flow-compose-fields"><span>Alıcı<strong>deniz@example.com</strong></span><span>Konu<strong>Web sitesi projesi · Teklifimiz</strong></span></div><p>Merhaba Deniz,<br/>Görüşmemizin ardından teklifimizi paylaşıyorum.<br/>Görüşlerinizi bekliyorum.</p><footer><span><i/>Takip açık</span><span className="flow-send-preview">Gönder<Send size={12}/></span></footer></div>:null}
 </div>
 <div className="flow-explanation"><span>0{step+1}<small>/ 04</small></span><div><h3>{stages[step].title}</h3><p>{stages[step].copy}</p></div></div><div className="flow-navigation" aria-label="Folloopy kullanım adımları">{stages.map((stage,index)=><button key={stage.label} onClick={()=>seek(index)} aria-pressed={index===step} className={index===step?'active':index<step?'complete':''}><span className="flow-stage-track"><i/></span><span>{stage.label}</span></button>)}</div></div>;
}
