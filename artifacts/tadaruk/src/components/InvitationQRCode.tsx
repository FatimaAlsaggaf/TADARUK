import {useEffect,useRef,useState} from 'react';

type Generator={clear:()=>void;makeCode:(text:string)=>void};
type QRCtor={
  new (element:HTMLElement, options:{
    text:string;width:number;height:number;colorDark:string;colorLight:string;
    correctLevel:number
  }):Generator;
  CorrectLevel:{M:number;H:number};
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
  const [available,setAvailable]=useState(true);
  useEffect(()=>{
    let active=true;
    const element=holder.current;
    if(!element||!url)return;
    element.replaceChildren();
    void loadGenerator().then(ok=>{
      if(!active||!element.isConnected)return;
      setAvailable(ok);
      if(!ok||!window.QRCode)return;
      element.replaceChildren();
      new window.QRCode(element,{
        text:url,width:192,height:192,
        colorDark:'#183c5e',colorLight:'#ffffff',
        correctLevel:window.QRCode.CorrectLevel.M
      });
    });
    return()=>{active=false;element.replaceChildren()};
  },[url]);
  return <div className="tadaruk-invite-qr" aria-label={label}>
    <div className="tadaruk-invite-qr-light" aria-hidden="true"/>
    <a href={url} className="tadaruk-invite-qr-link" aria-label={label}
      title={label}>
      <div ref={holder} className="tadaruk-invite-qr-image" role="img" aria-label={label}/>
      <span className="tadaruk-invite-qr-logo" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}brand-mark.png`} alt=""/>
      </span>
    </a>
    {!available&&<small>{'تعذر إنشاء الرمز. انسخ رابط الدعوة بدلًا منه.'}</small>}
  </div>;
}
