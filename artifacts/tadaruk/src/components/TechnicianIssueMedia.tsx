import { createElement, useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { Box, Camera, Maximize2, Move, X } from 'lucide-react';
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
  const [mode,setMode]=useState<'photo'|'perspective'|'model'>('photo');
  const [zoom,setZoom]=useState(1);
  const [offset,setOffset]=useState({x:0,y:0});
  const [tilt,setTilt]=useState({x:0,y:0});
  const [reduceMotion,setReduceMotion]=useState(false);
  const [model,setModel]=useState<ModelStatus|null>(null);
  const [viewerLoaded,setViewerLoaded]=useState(false);
  const [viewerFailed,setViewerFailed]=useState(false);
  const drag=useRef<{x:number;y:number;ox:number;oy:number}|null>(null);
  const fullscreenRef=useRef<HTMLDivElement|null>(null);
  const modelRef=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduceMotion(media.matches);
    update();media.addEventListener?.('change',update);
    return()=>media.removeEventListener?.('change',update);
  },[]);


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
  const reset=()=>{setZoom(1);setOffset({x:0,y:0});setTilt({x:0,y:0});};
  const changeZoom=(n:number)=>setZoom(Math.min(5,Math.max(1,n)));
  const moveStart=(e:PointerEvent<HTMLDivElement>)=>{
    if(mode==='model'||zoom===1)return;
    drag.current={x:e.clientX,y:e.clientY,ox:offset.x,oy:offset.y};
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move=(e:PointerEvent<HTMLDivElement>)=>{
    if(!drag.current)return;
    setOffset({x:drag.current.ox+e.clientX-drag.current.x,y:drag.current.oy+e.clientY-drag.current.y});
  };
  const moveEnd=()=>{drag.current=null;};
  const wheel=(e:WheelEvent<HTMLDivElement>)=>{if(mode!=='model')changeZoom(zoom+(e.deltaY<0?.2:-.2));};
  const perspectiveMove=(e:PointerEvent<HTMLDivElement>)=>{
    if(mode!=='perspective'||reduceMotion||drag.current||e.pointerType==='touch')return;
    const rect=e.currentTarget.getBoundingClientRect();
    setTilt({
      x:Math.max(-1,Math.min(1,((e.clientX-rect.left)/rect.width-.5)*2)),
      y:Math.max(-1,Math.min(1,((e.clientY-rect.top)/rect.height-.5)*2)),
    });
  };
  const toggleFullscreen=()=>{
    const el=fullscreenRef.current;
    if(!el)return;
    if(document.fullscreenElement)void document.exitFullscreen?.();
    else void el.requestFullscreen?.();
  };
  const close=()=>{setOpen(false);setMode('photo');reset();};
  return <>
    <div className="tadaruk-photo-mini tadaruk-photo-mini--clean">
      <button className="tadaruk-photo-mini-image" onClick={()=>{reset();setMode('photo');setOpen(true);}}
        type="button" aria-label={tr(lang,'استعراض صورة العطل','View issue photo')}>
        <img src={imageUrl} alt={tr(lang,'صورة العطل الأصلية','Original issue photo')}/>
        <span><Maximize2 size={15}/>{tr(lang,'استعراض الصورة','View photo')}</span>
      </button>
      <button type="button" className="tadaruk-photo-focus-trigger" data-testid="button-photo-perspective"
        onClick={()=>{reset();setMode(reduceMotion?'photo':'perspective');setOpen(true);}}>
        <Move size={15}/>{tr(lang,'استعراض تفاعلي','Interactive view')}
      </button>
      {hasModel&&<button className="tadaruk-photo-model-button" type="button"
        onClick={()=>{reset();setMode('model');setOpen(true);}}>
        <Box size={16}/>{tr(lang,'عرض ثلاثي الأبعاد','View 3D')}
      </button>}
    </div>
    {open&&<div className="tadaruk-media-backdrop" onClick={close} role="presentation">
      <div ref={fullscreenRef} className="tadaruk-media-dialog tadaruk-media-dialog--minimal"
        onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true"
        aria-label={tr(lang,'استعراض صورة العطل','Issue image viewer')}>
        <div className="tadaruk-media-toolbar">
          <strong><Camera size={17}/>{mode==='model'?tr(lang,'نموذج ثلاثي الأبعاد','3D model'):tr(lang,'صورة العطل','Issue photo')}</strong>
          <div className="tadaruk-media-actions">
            {hasModel && mode==='model'&&<button type="button" onClick={()=>{setMode('photo');reset();}}>
              <Camera size={16}/>{tr(lang,'الصورة الأصلية','Original photo')}
            </button>}
            {mode!=='model'&&!reduceMotion&&<button type="button"
              className={mode==='perspective'?'is-active':''}
              onClick={()=>{setMode(mode==='perspective'?'photo':'perspective');reset();}}>
              <Move size={16}/>{mode==='perspective'?tr(lang,'العرض العادي','Normal view'):tr(lang,'تأثير منظور','Perspective')}
            </button>}
            <button type="button" onClick={toggleFullscreen} aria-label={tr(lang,'ملء الشاشة','Fullscreen')}>
              <Maximize2 size={17}/>
            </button>
            <button type="button" onClick={close} aria-label={tr(lang,'إغلاق','Close')}><X size={19}/></button>
          </div>
        </div>
        {mode==='model' ?
          <div className="tadaruk-media-stage tadaruk-media-stage--model">
            {!viewerLoaded&&!viewerFailed&&<span className="tadaruk-media-loading" role="status">{tr(lang,'جارٍ تحميل النموذج...','Loading model...')}</span>}
            {hasModel&&model&&createElement('model-viewer',{
              ref:modelRef,src:model.modelUrl,
              alt:tr(lang,'نموذج ثلاثي الأبعاد معتمد للبلاغ','Verified 3D ticket model'),
              'camera-controls':'','shadow-intensity':'1',exposure:'1.1',
              'touch-action':'pan-y',style:{width:'100%',height:'100%',minHeight:'320px'}
            })}
            {viewerLoaded&&model?.hotspot?.label&&<span className="tadaruk-media-hotspot">{model.hotspot.label}</span>}
          </div>
          : <div className={`tadaruk-media-stage ${mode==='perspective'?'tadaruk-media-stage--perspective':''}`}
            onPointerDown={moveStart} onPointerMove={e=>{move(e);perspectiveMove(e);}}
            onPointerUp={moveEnd} onPointerCancel={moveEnd}
            onPointerLeave={()=>setTilt({x:0,y:0})} onWheel={wheel}
            style={{cursor:zoom>1?'grab':'zoom-in'}}>
            <img draggable={false} src={imageUrl}
              alt={tr(lang,'صورة العطل الأصلية غير المعدلة','Unaltered original issue photo')}
              onDoubleClick={()=>{changeZoom(zoom===1?2:1);setOffset({x:0,y:0});}}
              style={{transform:mode==='perspective' && !reduceMotion
                ?`perspective(1100px) rotateY(${tilt.x*5}deg) rotateX(${-tilt.y*5}deg) translate(${offset.x}px,${offset.y}px) scale(${zoom*1.025})`
                :`translate(${offset.x}px,${offset.y}px) scale(${zoom})`}}/>
          </div>}
        <div className="tadaruk-media-footer">
          {mode==='model'
            ?tr(lang,'قد يحتوي النموذج على تفاصيل تقديرية؛ تأكد من صورة البلاغ قبل الصيانة.','The model may be approximate; verify against the report photo.')
            :mode==='perspective'
              ?tr(lang,'تأثير منظور للصورة نفسها، وليس مجسمًا ثلاثي الأبعاد أو كشفًا لأجزاء مخفية. استخدم التمرير للتكبير والسحب للتحريك.','Perspective effect on the same image, not real 3D or hidden details. Scroll to zoom and drag to pan.')
              :tr(lang,'الصورة الأصلية كما رفعها المبلّغ. استخدم التمرير للتكبير والسحب للتحريك.','Original uploaded photo. Scroll to zoom and drag to pan.')}
        </div>
      </div>
    </div>}
  </>;
}
