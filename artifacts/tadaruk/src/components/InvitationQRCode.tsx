import {useEffect,useRef,useState} from 'react';
import {toCompactQrInviteUrl} from '../invitationQrUrl';

type Generator={clear:()=>void;makeCode:(text:string)=>void};
type QRCtor={
  new (element:HTMLElement, options:{
    text:string;width:number;height:number;colorDark:string;colorLight:string;
    correctLevel:number
  }):Generator;
  CorrectLevel:{L:number;M:number;Q:number;H:number};
};
declare global {interface Window {QRCode?:QRCtor}}
let pending:Promise<boolean>|null=null;
function loadGenerator():Promise<boolean>{
  if(window.QRCode)return Promise.resolve(true);
  if(pending)return pending;
  pending=new Promise(resolve=>{
    const script=document.createElement('script');
    script.src=`${import.meta.env.BASE_URL}vendor/qrcode.min.js`;
    script.async=true;
    script.onload=()=>resolve(Boolean(window.QRCode));
    script.onerror=()=>{pending=null;resolve(false)};
    document.head.appendChild(script);
  });
  return pending;
}
export default function InvitationQRCode({url,label}:{url:string;label:string}){
  const holder=useRef<HTMLDivElement>(null);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const qrUrl=toCompactQrInviteUrl(url);
  useEffect(()=>{
    let active=true;
    const element=holder.current;
    if(!element||!qrUrl)return;
    element.replaceChildren();
    setStatus('loading');
    void loadGenerator().then(ok=>{
      if(!active||!element.isConnected)return;
      if(!ok||!window.QRCode){setStatus('error');return;}
      let drawn=false;
      // Use the best available correction level without leaving an empty card
      // when a longer invitation URL exceeds a QR version's capacity.
      for(const correctLevel of [window.QRCode.CorrectLevel.Q,window.QRCode.CorrectLevel.M,window.QRCode.CorrectLevel.L]){
        try {
          element.replaceChildren();
          new window.QRCode(element,{
            text:qrUrl,width:192,height:192,
            colorDark:'#153d63',colorLight:'#ffffff',
            correctLevel
          });
          drawn=Boolean(element.querySelector('canvas,img,table'));
          if(drawn) break;
        }catch{ element.replaceChildren(); }
      }
      if(active)setStatus(drawn?'ready':'error');
    }).catch(()=>{if(active)setStatus('error')});
    return()=>{active=false;element.replaceChildren()};
  },[qrUrl]);
  return <div className="tadaruk-invite-qr" aria-label={label}>
    {/* Trace the exact rounded-card perimeter — never rotate an oversized gradient box. */}
    <svg className="tadaruk-invite-qr-outline" viewBox="0 0 224 224"
      preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <rect className="tadaruk-invite-qr-track" x="2" y="2" width="220" height="220"
        rx="19" pathLength="100"/>
      <rect className="tadaruk-invite-qr-trace-glow" x="2" y="2" width="220" height="220"
        rx="19" pathLength="100"/>
      <rect className="tadaruk-invite-qr-trace-core" x="2" y="2" width="220" height="220"
        rx="19" pathLength="100"/>
    </svg>
    <a href={qrUrl} className="tadaruk-invite-qr-link" aria-label={label} title={label} data-qr-status={status}>
      <div ref={holder} className="tadaruk-invite-qr-image" role="img" aria-label={label}/>
      {status==='ready'&&<span className="tadaruk-invite-qr-logo" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}brand-mark.png`} alt=""/>
      </span>}
      {status==='loading'&&<span className="tadaruk-qr-status" role="status">جارٍ تجهيز الرمز…</span>}
      {status==='error'&&<span className="tadaruk-qr-status" role="alert">تعذّر إنشاء الرمز</span>}
    </a>
    {status==='error'&&<small>يمكنك نسخ رابط الدعوة أو فتحه مباشرة.</small>}
  </div>;
}
