import { createElement, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { Box, Camera, Maximize2, Minus, Move, Plus, RotateCcw, X } from 'lucide-react';
import './technician-issue-media.css';

type Lang = 'ar' | 'en';
type ModelStatus = {status:'unavailable'|'queued'|'running'|'failed'|'ready';modelUrl?:string;validated?:boolean;approved?:boolean;hotspot?:{label:string;position:string}};
const tr=(lang:Lang,ar:string,en:string)=>lang==='ar'?ar:en;

// No public third-party model URL is assumed safe. The backend must return a
// reviewed, stored GLB from our own origin. Temporary provider URLs are unsuitable.
function isValidModel(status:ModelStatus|null):status is ModelStatus & {modelUrl:string}{
  if(!status||status.status!=='ready'||status.validated!==true||status.approved!==true||!status.modelUrl)return false;
  try{
    const url=new URL(status.modelUrl,window.location.origin);
    return url.origin===window.location.origin && url.pathname.startsWith('/api/3d-assets/') && /\.glb$/i.test(url.pathname);
  }catch{return false;}
}
let modelViewerScript:Promise<void>|undefined;
function loadRealModelViewer():Promise<void>{
  if(customElements.get('model-viewer'))return Promise.resolve();
  modelViewerScript??=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.type='module';
    script.src='https://ajax.googleapis.com/ajax/libs/model-viewer/4.4.0/model-viewer.min.js';
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error('Unable to load the 3D viewer'));
    document.head.appendChild(script);
  });
  return modelViewerScript;
}

export default function TechnicianIssueMedia({ticketId,imageUrl,lang}:{ticketId:string;imageUrl:string;lang:Lang}){
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<'photo'|'model'>('photo');
  const [zoom,setZoom]=useState(1);
  const [offset,setOffset]=useState({x:0,y:0});
  const [model,setModel]=useState<ModelStatus|null>(null);
  const [viewerLoaded,setViewerLoaded]=useState(false);
  const [viewerFailed,setViewerFailed]=useState(false);
  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  const fullscreenRef=useRef<HTMLDivElement|null>(null);
  const modelRef=useRef<HTMLElement|null>(null);

  useEffect(()=>{
    let active=true;
    setModel(null);
    fetch(`/api/tickets/${encodeURIComponent(ticketId)}/3d`,{credentials:'same-origin',headers:{Accept:'application/json'}})
      .then(async r=>{
        if(!r.ok || !r.headers.get('content-type')?.includes('application/json'))return null;
        return r.json() as Promise<ModelStatus>;
      })
      .then(data=>{if(active)setModel(data);})
      .catch(()=>{if(active)setModel(null);});
    return()=>{active=false;};
  },[ticketId]);
  useEffect(()=>{
    if(!open)return;
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);setMode('photo');}};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[open]);
  useEffect(()=>{
    if(!open||mode!=='model'||!isValidModel(model))return;
    let live=true;
    setViewerLoaded(false);
    setViewerFailed(false);
    loadRealModelViewer()
      .then(()=>{
        if(!live)return;
        const el=modelRef.current;
        if(!el)return;
        const done=()=>{if(live)setViewerLoaded(true);};
        const fail=()=>{if(live){setViewerFailed(true);setMode('photo');}};
        el.addEventListener('load',done);
        el.addEventListener('error',fail);
        if((el as HTMLElement & {loaded?:boolean}).loaded)done();
        cleanup=()=>{el.removeEventListener('load',done);el.removeEventListener('error',fail);};
      }).catch(()=>{if(live){setViewerFailed(true);setMode('photo');}});
    let cleanup=()=>{};
    return()=>{live=false;cleanup();};
  },[open,mode,model]);

  const hasModel=isValidModel(model)&&!viewerFailed;
  const reset=()=>{setZoom(1);setOffset({x:0,y:0});};
  const changeZoom=(n:number)=>setZoom(Math.min(5,Math.max(1,n)));
  const moveStart=(e:PointerEvent<HTMLDivElement>)=>{
    if(mode!=='photo'||zoom===1)return;
    drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move=(e:PointerEvent<HTMLDivElement>)=>{
    if(!drag.current)return;
    setOffset({x:drag.current.ox+e.clientX-drag.current.x,y:drag.current.oy+e.clientY-drag.current.y});
  };
  const moveEnd=()=>{drag.current=null;};
  const wheel=(e:WheelEvent<HTMLDivElement>)=>{if(mode==='photo')changeZoom(zoom+(e.deltaY<0?.2:-.2));};
  const toggleFullscreen=()=>{
    const el=fullscreenRef.current;
    if(!el)return;
    if(document.fullscreenElement)void document.exitFullscreen?.();
    else void el.requestFullscreen?.();
  };
  const close=()=>{setOpen(false);setMode('photo');reset();};
  return <>
    <div className="tadaruk-photo-mini">
      <button className="tadaruk-photo-mini-image" onClick={()=>{reset();setMode('photo');setOpen(true);}} type="button" aria-label={tr(lang,'تكبير صورة العطل','Enlarge issue photo')}>
        <img src={imageUrl} alt={tr(lang,'صورة العطل الأصلية','Original issue photo')}/>
        <span><Maximize2 size={15}/>{tr(lang,'استعراض الصورة','View image')}</span>
      </button>
      {hasModel && <button className="tadaruk-photo-model-button" type="button"
        onClick={()=>{setMode('model');setOpen(true);}}><Box size={17}/>{tr(lang,'عرض ثلاثي الأبعاد','Explore 3D')}</button>}
    </div>
    {open&&<div className="tadaruk-media-backdrop" onClick={close} role="presentation">
      <div ref={fullscreenRef} className="tadaruk-media-dialog" onClick={e=>e.stopPropagation()} role="dialog"
        aria-modal="true" aria-label={tr(lang,'استعراض العطل','Inspect issue')}>
        <div className="tadaruk-media-toolbar">
          <strong><Camera size={17}/>{mode==='photo'?tr(lang,'الصورة الأصلية','Original photo'):tr(lang,'استكشاف العطل ثلاثي الأبعاد','3D issue inspection')}</strong>
          <div className="tadaruk-media-actions">
            {hasModel&&<button onClick={()=>{setMode(mode==='photo'?'model':'photo');reset();}} type="button"><Box size={16}/>{mode==='photo'?tr(lang,'عرض 3D','View 3D'):tr(lang,'الأصلية','Original')}</button>}
            {mode==='photo'&&<>
              <button onClick={()=>changeZoom(zoom+.3)} type="button" aria-label={tr(lang,'تكبير','Zoom in')}><Plus size={17}/></button>
              <button onClick={()=>{changeZoom(zoom-.3);if(zoom<=1.3)setOffset({x:0,y:0});}} type="button" aria-label={tr(lang,'تصغير','Zoom out')}><Minus size={17}/></button>
              <button onClick={reset} type="button" aria-label={tr(lang,'إعادة الضبط','Reset')}><RotateCcw size={17}/></button>
            </>}
            <button onClick={toggleFullscreen} type="button" aria-label={tr(lang,'ملء الشاشة','Fullscreen')}><Maximize2 size={17}/></button>
            <button onClick={close} type="button" aria-label={tr(lang,'إغلاق','Close')}><X size={19}/></button>
          </div>
        </div>
        {mode==='photo'?
          <div className="tadaruk-media-stage" onPointerDown={moveStart} onPointerMove={move}
            onPointerUp={moveEnd} onPointerCancel={moveEnd} onWheel={wheel}
            style={{cursor:zoom>1?'grab':'zoom-in'}}>
            <img draggable={false} src={imageUrl} alt={tr(lang,'الصورة الأصلية دون تعديل','Unmodified original photo')}
              onDoubleClick={()=>{changeZoom(zoom===1?2:1);setOffset({x:0,y:0});}}
              style={{transform:`translate(${offset.x}px,${offset.y}px) scale(${zoom})`}}/>
          </div>:
          <div className="tadaruk-media-stage tadaruk-media-stage--model">
            {!viewerLoaded&&!viewerFailed&&<span className="tadaruk-media-loading" role="status">{tr(lang,'جارٍ تحميل النموذج الحقيقي...','Loading verified 3D model...')}</span>}
            {hasModel&&createElement('model-viewer',{
              ref:modelRef,src:model.modelUrl,
              alt:tr(lang,'نموذج ثلاثي الأبعاد مولد من صورة البلاغ','AI-generated model from the issue photo'),
              'camera-controls':'','interaction-prompt':'auto','shadow-intensity':'1',
              exposure:'1.1','touch-action':'pan-y',
              style:{width:'100%',height:'100%',minHeight:'320px'}
            })}
            {viewerLoaded&&model?.hotspot?.label&&<span className="tadaruk-media-hotspot">{model.hotspot.label}</span>}
          </div>
        }
        <div className="tadaruk-media-footer">
          {mode==='photo'?<><Move size={15}/><span>{tr(lang,'قرّب الصورة ثم اسحب للتحريك. تبقى الصورة الأصلية دون تعديل.','Zoom, then drag to pan. The original photo is unchanged.')}</span></>:
          <span>{tr(lang,'النموذج المولد تقديري؛ تحقق من الصورة الأصلية قبل أي إصلاح.','Generated geometry is approximate; always verify the original photo.')}</span>}
        </div>
      </div>
    </div>}
  </>;
}
