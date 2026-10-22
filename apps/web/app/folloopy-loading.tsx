export function FolloopyEyes({size=124}:{size?:number}){return <span className="folloopy-loading-eyes" style={{width:size,height:size}}><img src="/icon.png" width={size} height={size} alt="" fetchPriority="high"/><span className="folloopy-loading-lid is-left"><i/><i/></span><span className="folloopy-loading-lid is-right"><i/><i/></span></span>}
export function FolloopyLoading(){
 return <span className="folloopy-loading" role="status" aria-live="polite"><span className="sr-only">Sayfa yükleniyor</span><span className="folloopy-loading-mark" aria-hidden="true"><span className="folloopy-loading-glow"/><FolloopyEyes/><span className="folloopy-loading-shadow"/></span></span>;
}
