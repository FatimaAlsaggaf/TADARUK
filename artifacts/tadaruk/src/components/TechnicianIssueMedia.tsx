import { createElement, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { Box, Camera, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import './technician-issue-media.css';
type Lang = 'ar' | 'en';
type ModelStatus = {status:'unavailable'|'queued'|'running'|'failed'|'ready';modelUrl?:string;validated?:boolean;approved?:boolean};
const tr=(lang:Lang,ar:string,en:string)=>lang==='ar'?ar:en;
function isValidModel(status:ModelStatus|null):status is ModelStatus & {modelUrl:string}{
  if(!status||status.status!=='ready'||!status.validated||!status.approved||!status.modelUrl)return false;
  try{const url=new URL(status.modelUrl,window.location.origin);
    return url.origin===window.location.origin&&url.pathname.startsWith('/api/3d-assets/')&&/\.glb$/i.test(url.pathname);
  }catch{return false;}
}
let loader:Promise<void>|undefined;
function loadViewer(){
  if(customElements.get('model-viewer'))return Promise.resolve();
  loader??=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.type='module';
    script.src='https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js';
    script.onload=()=>resolve();script.onerror=()=>reject(new Error('model-viewer unavailable'));
    document.head.appendChild(script);
  });
  return loader;
}
export default function TechnicianIssueMedia({ticketId,imageUrl,lang,approximateSink=false}:{
  ticketId:string;imageUrl:string;lang:Lang;approximateSink?:boolean
}){
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<'photo'|'approx'|'model'>('photo');
  const [zoom,setZoom]=useState(1);
  const [offset,setOffset]=useState({x:0,y:0});
  const [model,setModel]=useState<ModelStatus|null>(null);
  const [viewerFailed,setViewerFailed]=useState(false);
  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  const fullscreenRef=useRef<HTMLDivElement|null>(null);
  const viewer=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    let alive=true;
    fetch(`/api/tickets/${encodeURIComponent(ticketId)}/3d`,{credentials:'same-origin',headers:{Accept:'application/json'}})
      .then(async res=>res.ok&&res.headers.get('content-type')?.includes('application/json')?res.json() as Promise<ModelStatus>:null)
      .then(m=>{if(alive)setModel(m)}).catch(()=>{if(alive)setModel(null)});
    return()=>{alive=false};
  },[ticketId]);
  const hasModel=isValidModel(model)&&!viewerFailed;
  const showApprox=approximateSink||ticketId==='ticket-demo-2401';
  const reset=()=>{setZoom(1);setOffset({x:0,y:0})};
  const close=()=>{setOpen(false);setMode('photo');reset()};
  const openMode=(next:'photo'|'approx'|'model')=>{reset();setMode(next);setOpen(true)};
  useEffect(()=>{
    if(!open)return;
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[open]);
  useEffect(()=>{
    if(!open||mode!=='model'||!hasModel)return;
    let alive=true;loadViewer().catch(()=>{if(alive){setViewerFailed(true);setMode('photo')}});
    return()=>{alive=false};
  },[open,mode,hasModel]);
  const start=(e:PointerEvent<HTMLDivElement>)=>{
    if(mode!=='photo'||zoom===1)return;
    drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move=(e:PointerEvent<HTMLDivElement>)=>{
    if(!drag.current)return;
    setOffset({x:drag.current.ox+e.clientX-drag.current.x,y:drag.current.oy+e.clientY-drag.current.y});
  };
  const zoomTo=(amount:number)=>setZoom(z=>Math.max(1,Math.min(5,z+amount)));
  const fullscreen=()=>{
    if(document.fullscreenElement)void document.exitFullscreen?.();
    else if(fullscreenRef.current)void fullscreenRef.current.requestFullscreen?.();
  };
  return <>
    <div className="tadaruk-photo-mini tadaruk-photo-mini--clean">
      <div className="tadaruk-photo-surface">
        <button className="tadaruk-photo-mini-image" type="button"
          onClick={()=>openMode('photo')} aria-label={tr(lang,'عرض صورة العطل','View issue photo')}>
          <img src={imageUrl} alt={tr(lang,'صورة العطل الأصلية','Original issue photo')}/>
        </button>
        <div className="tadaruk-photo-overlay-actions">
          {showApprox&&<button className="tadaruk-photo-focus-trigger" type="button"
            onClick={()=>openMode('approx')} data-testid="button-approximate-3d">
            <Box size={15}/>{tr(lang,'عرض 3D تقريبي','Approximate 3D')}
          </button>}
          {hasModel&&<button className="tadaruk-photo-model-button" type="button"
            onClick={()=>openMode('model')}><Box size={15}/>{tr(lang,'3D معتمد','Verified 3D')}</button>}
          {!showApprox&&!hasModel&&<button className="tadaruk-photo-focus-trigger" type="button"
            onClick={()=>openMode('photo')}><Maximize2 size={15}/>{tr(lang,'عرض الصورة','View photo')}</button>}
        </div>
      </div>
    </div>
    {open&&<div className="tadaruk-media-backdrop" role="presentation" onClick={close}>
      <div className="tadaruk-media-dialog tadaruk-media-dialog--minimal tadaruk-media-dialog--tabs"
        ref={fullscreenRef} onClick={e=>e.stopPropagation()} role="dialog"
        aria-modal="true" aria-label={tr(lang,'عرض صورة البلاغ','Ticket media viewer')}>
        <header className="tadaruk-media-toolbar">
          <strong>{tr(lang,'تفاصيل العطل','Issue details')}</strong>
          <div className="tadaruk-media-actions">
            <button type="button" onClick={fullscreen} aria-label={tr(lang,'ملء الشاشة','Fullscreen')} title={tr(lang,'ملء الشاشة','Fullscreen')}><Maximize2 size={17}/></button>
            <button type="button" onClick={close} aria-label={tr(lang,'إغلاق','Close')}><X size={20}/></button>
          </div>
        </header>
        <div className="tadaruk-media-mode-tabs" role="tablist" aria-label={tr(lang,'طرق عرض البلاغ','Issue views')}>
          <button role="tab" aria-selected={mode==='photo'} className={mode==='photo'?'active':''}
            onClick={()=>{reset();setMode('photo')}} type="button"><Camera size={16}/>{tr(lang,'الصورة الأصلية','Original photo')}</button>
          {showApprox&&<button role="tab" aria-selected={mode==='approx'} className={mode==='approx'?'active':''}
            onClick={()=>setMode('approx')} type="button"><Box size={16}/>{tr(lang,'3D تقريبي','Approximate 3D')}</button>}
          {hasModel&&<button role="tab" aria-selected={mode==='model'} className={mode==='model'?'active':''}
            onClick={()=>setMode('model')} type="button"><Box size={16}/>{tr(lang,'3D معتمد','Verified 3D')}</button>}
        </div>
        {mode==='approx' && showApprox ?
          <div className="tadaruk-approx-scene">
            <iframe className="tadaruk-approx-frame" src="/approximate-sink-3d.html"
              title={tr(lang,'مجسم تقريبي للمغسلة قابل للدوران','Rotatable illustrative 3D sink')}
              sandbox="allow-scripts" loading="eager"/>
          </div> :
          mode==='model'&&hasModel&&model ?
          <div className="tadaruk-media-stage tadaruk-media-stage--model">
            {createElement('model-viewer',{ref:viewer,src:model.modelUrl,
              alt:tr(lang,'نموذج ثلاثي الأبعاد معتمد','Verified 3D issue model'),
              'camera-controls':'','shadow-intensity':'1',style:{width:'100%',height:'100%'}})}
          </div> :
          <div className="tadaruk-photo-stage-wrap">
            <div className="tadaruk-media-stage" onPointerDown={start}
              onPointerMove={move} onPointerUp={()=>drag.current=null}
              onPointerCancel={()=>drag.current=null}
              onWheel={(e:WheelEvent<HTMLDivElement>)=>zoomTo(e.deltaY<0?.2:-.2)}
              style={{cursor:zoom>1?'grab':'zoom-in'}}>
              <img src={imageUrl} draggable={false} alt={tr(lang,'الصورة الأصلية','Original photo')}
                onDoubleClick={()=>{if(zoom>1)reset();else zoomTo(1)}}
                style={{transform:`translate(${offset.x}px,${offset.y}px) scale(${zoom})`}}/>
            </div>
            <div className="tadaruk-photo-zoom-controls">
              <button type="button" aria-label={tr(lang,'تكبير','Zoom in')} onClick={()=>zoomTo(.5)}><Plus size={17}/></button>
              <button type="button" aria-label={tr(lang,'تصغير','Zoom out')} onClick={()=>{zoomTo(-.5);if(zoom<=1.5)setOffset({x:0,y:0})}}><Minus size={17}/></button>
              <button type="button" aria-label={tr(lang,'إرجاع الصورة','Reset image')} onClick={reset}><RotateCcw size={17}/></button>
            </div>
          </div>}
        {mode==='approx'&&<p className="tadaruk-approx-disclaimer">
          {tr(lang,'مجسم توضيحي تقريبي لمشهد التسريب، وليس إعادة بناء دقيقة من الصورة. اسحب لتدويره.','Illustrative sink scene, not an exact reconstruction from the photo. Drag to rotate.')}
        </p>}
      </div>
    </div>}
  </>;
}
