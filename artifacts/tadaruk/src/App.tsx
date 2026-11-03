import { type ReactNode, type FormEvent, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation, useParams } from 'wouter';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import BlurText from '@/components/BlurText';
import SpotlightCard from '@/components/SpotlightCard';
import PhotoAttachmentCard from '@/components/PhotoAttachmentCard';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Building2, Check,
  CheckCircle2, ChevronDown, ClipboardList, Clock3, Filter, Languages, LayoutDashboard,
  MapPin, Menu, Plus, Search, Settings2, ShieldCheck, Users, Wrench, X, CircleAlert,
  LogOut, UserRound, RotateCcw, ChevronLeft, LoaderCircle, MapPinned,
  Mic, Square
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  useHealthCheck, useListDemoUsers, useGetDemoSession, useSelectDemoAccount, useClearDemoSession, useGetOverview,
  useListTickets, useGetTicket, usePerformTicketAction,
  useListBranches, useCreateBranch, useUpdateBranch, useListTechnicians, useCreateTechnician,
  useUpdateTechnician, useListKnowledge, useListReporterBranches, getListReporterBranchesQueryKey,
  getGetDemoSessionQueryKey, getGetOverviewQueryKey,
  getListTicketsQueryKey, getGetTicketQueryKey, getListBranchesQueryKey, getListTechniciansQueryKey,
  getListKnowledgeQueryKey,
  type DemoUser, type Ticket,
  type Branch, type BranchInput, type BranchUpdate, type Technician, type KnowledgeEntry, type ReporterBranch
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ReporterHomePage, ReporterNewTicketPage, ReporterTicketsPage } from '@/ReporterWorkspace';
import ReporterAccessPanel from '@/ReporterAccessPanel';
import { TicketCancellationAction } from '@/components/TicketCancellationAction';
import SunMoonThemeToggle from '@/components/ui/sun-moon-theme-toggle';
import './tadaruk.css';
import './tadaruk-interactions.css';

const qc = new QueryClient();
type Lang = 'ar' | 'en';
type ReporterBranchContextValue = {
  branches: ReporterBranch[];
  selectedBranchId: string;
  selectBranch: (branchId: string) => void;
  status: 'loading' | 'error' | 'success';
};
const ReporterBranchContext = createContext<ReporterBranchContextValue | null>(null);
const tr = (lang: Lang, ar: string, en: string) => lang === 'ar' ? ar : en;
const roleText = (role?: string, lang: Lang = 'ar') => {
  const roles: Record<string, [string,string]> = { manager:['مدير العمليات','Operations manager'], reporter:['المبلّغ','Reporter'], technician:['الفني','Technician'] };
  return roles[role || '']?.[lang === 'ar' ? 0 : 1] || '';
};
const statusText = (status: string, lang: Lang) => {
  const m: Record<string,[string,string]> = {new:['جديد','New'],review:['قيد المراجعة','In review'],in_progress:['جاري العمل','In progress'],awaiting_confirmation:['بانتظار التأكيد','Awaiting confirmation'],closed:['مغلق','Closed'],cancelled:['ملغي','Cancelled']};
  return m[status]?.[lang === 'ar' ? 0 : 1] || status;
};
const priorityText = (priority: string, lang: Lang) => {
  const m: Record<string,[string,string]> = {urgent:['طارئ','Urgent'],high:['عالٍ','High'],medium:['متوسط','Medium'],low:['منخفض','Low']};
  return m[priority]?.[lang === 'ar' ? 0 : 1] || priority;
};
const classificationText = (value: string, lang: Lang) => {
  const m: Record<string,[string,string]> = {cooling:['تكييف وتبريد','Cooling'],electrical:['كهرباء','Electrical'],plumbing:['سباكة','Plumbing'],general:['عام','General']};
  return m[value]?.[lang === 'ar' ? 0 : 1] || value;
};
const dateText = (date: string, lang: Lang) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {day:'numeric',month:'short'}).format(new Date(date));
const branchMapUrl = (latitude:number|null|undefined,longitude:number|null|undefined,address:string,city='') => {
  const hasCoordinates=typeof latitude==='number'&&Number.isFinite(latitude)&&latitude>=-90&&latitude<=90&&typeof longitude==='number'&&Number.isFinite(longitude)&&longitude>=-180&&longitude<=180;
  const searchAddress=address.trim()?[address.trim(),city.trim()].filter(Boolean).join(', '):'';
  const destination=hasCoordinates?`${latitude},${longitude}`:searchAddress;
  return destination?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`:'';
};
function Brand({darkMode=false}:{darkMode?:boolean}) {
  const logo = darkMode ? 'brand-logo-dark.png' : 'brand-logo.png';
  return <span className={`brand-lockup ${darkMode?'brand-lockup-dark':''}`}><img className="brand-logo" src={`${import.meta.env.BASE_URL}${logo}`} alt="TADARUK تدارك"/></span>;
}
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
function VoiceRecorder({lang,onTranscript}:{lang:Lang;onTranscript:(text:string)=>void}) {
  const [active,setActive]=useState(false);
  const [processing,setProcessing]=useState(false);
  const [seconds,setSeconds]=useState(0);
  const [error,setError]=useState('');
  const [bars,setBars]=useState<number[]>(()=>Array.from({length:18},()=>4));
  const recognition=useRef<SpeechRecognitionLike|null>(null);
  const stream=useRef<MediaStream|null>(null);
  const audioContext=useRef<AudioContext|null>(null);
  const frame=useRef<number|undefined>(undefined);
  const timer=useRef<number|undefined>(undefined);
  const releaseTimer=useRef<number|undefined>(undefined);
  const transcriptSegments=useRef<Map<number,string>>(new Map());
  const cancelled=useRef(false);
  const completed=useRef(false);
  const stopping=useRef(false);

  const release=()=>{
    if(frame.current!==undefined){cancelAnimationFrame(frame.current);frame.current=undefined;}
    if(timer.current!==undefined){window.clearInterval(timer.current);timer.current=undefined;}
    if(releaseTimer.current!==undefined){window.clearTimeout(releaseTimer.current);releaseTimer.current=undefined;}
    stream.current?.getTracks().forEach(track=>track.stop());
    stream.current=null;
    if(audioContext.current){void audioContext.current.close();audioContext.current=null;}
    recognition.current=null;
    setActive(false);
    setBars(Array.from({length:18},()=>4));
  };
  const finish=()=>{
    if(completed.current)return;
    completed.current=true;
    if(!cancelled.current){
      const transcript=Array.from(transcriptSegments.current.entries())
        .sort(([left],[right])=>left-right)
        .map(([,value])=>value)
        .join(' ')
        .trim();
      if(transcript)onTranscript(transcript);
      else setError(tr(lang,'لم نلتقط كلمات واضحة. حاول مرة أخرى أو اكتب الوصف.','No clear words were detected. Try again or type the description.'));
    }
    setProcessing(false);
    stopping.current=false;
    release();
  };
  useEffect(()=>()=>{cancelled.current=true;release();},[]);

  const stop=(cancel=false)=>{
    const current=recognition.current;
    if(cancel){
      cancelled.current=true;
      stopping.current=false;
      transcriptSegments.current.clear();
      setProcessing(false);
      try{current?.abort();}catch{}
      release();
      return;
    }
    if(!current){finish();return;}
    setProcessing(true);
    setActive(false);
    if(timer.current!==undefined){window.clearInterval(timer.current);timer.current=undefined;}
    if(frame.current!==undefined){cancelAnimationFrame(frame.current);frame.current=undefined;}
    try{
      stopping.current=true;
      current.stop();
      releaseTimer.current=window.setTimeout(finish,1500);
    }catch{finish();}
  };

  const start=async()=>{
    setError('');
    const speechWindow=window as Window&{SpeechRecognition?:SpeechRecognitionConstructor;webkitSpeechRecognition?:SpeechRecognitionConstructor;webkitAudioContext?:typeof AudioContext};
    const Speech=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
    if(!navigator.mediaDevices?.getUserMedia){setError(tr(lang,'المتصفح لا يدعم الوصول إلى الميكروفون.','This browser cannot access the microphone.'));return;}
    if(!Speech){setError(tr(lang,'التعرّف الصوتي غير متاح في هذا المتصفح. يمكنك الكتابة بدلاً منه.','Speech recognition is unavailable in this browser. You can type instead.'));return;}
    cancelled.current=false;
    completed.current=false;
    stopping.current=false;
    transcriptSegments.current.clear();
    setProcessing(false);
    try{
      const liveStream=await navigator.mediaDevices.getUserMedia({audio:true});
      stream.current=liveStream;
      const AudioContextCtor=window.AudioContext||speechWindow.webkitAudioContext;
      if(AudioContextCtor){
        const context=new AudioContextCtor();
        audioContext.current=context;
        if(context.state==='suspended')await context.resume();
        const analyser=context.createAnalyser();
        analyser.fftSize=128;
        context.createMediaStreamSource(liveStream).connect(analyser);
        const samples=new Uint8Array(analyser.frequencyBinCount);
        const draw=()=>{
          analyser.getByteFrequencyData(samples);
          setBars(Array.from({length:18},(_,index)=>Math.max(4,Math.min(30,(samples[Math.floor(index*samples.length/18)]||0)/7))));
          frame.current=requestAnimationFrame(draw);
        };
        draw();
      }
      const recognizer=new Speech();
      recognition.current=recognizer;
      recognizer.lang=lang==='ar'?'ar-SA':'en-US';
      recognizer.continuous=true;
      recognizer.interimResults=true;
      recognizer.onresult=event=>{
        for(let index=event.resultIndex;index<event.results.length;index++){
          const result=event.results[index];
          const transcript=result[0]?.transcript?.trim();
          if(result.isFinal&&transcript)transcriptSegments.current.set(index,transcript);
        }
      };
      recognizer.onerror=event=>{
        if(cancelled.current||completed.current){release();return;}
        if(stopping.current&&event.error==='aborted'){finish();return;}
        cancelled.current=true;
        transcriptSegments.current.clear();
        setProcessing(false);
        setError(event.error==='not-allowed'
          ?tr(lang,'يرجى السماح باستخدام الميكروفون.','Allow microphone access to record.')
          :tr(lang,'توقف التعرّف الصوتي. حاول مرة أخرى.','Speech recognition stopped. Try again.'));
        release();
      };
      recognizer.onend=()=>cancelled.current?release():finish();
      setSeconds(0);
      setActive(true);
      timer.current=window.setInterval(()=>setSeconds(value=>value+1),1000);
      recognizer.start();
    }catch{
      cancelled.current=true;
      setProcessing(false);
      release();
      setError(tr(lang,'تعذر بدء التسجيل. تحقق من إذن الميكروفون.','Could not start recording. Check microphone permission.'));
    }
  };

  const clock=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  return <div className="voice-capture">
    <div className="voice-controls"><button type="button" className={`voice-button ${active?'voice-active':''}`} onClick={()=>active?stop():void start()} aria-pressed={active}>{active?<Square size={15}/>:<Mic size={16}/>}<span>{active?tr(lang,'إيقاف التسجيل','Stop recording'):tr(lang,'تسجيل صوتي','Record a voice note')}</span></button>{active&&<><span className="voice-timer" aria-live="polite">{clock}</span><button type="button" className="voice-cancel" onClick={()=>stop(true)}>{tr(lang,'إلغاء','Cancel')}</button></>}</div>
    {active&&<div className="voice-wave" role="img" aria-label={tr(lang,'موجة صوتية مباشرة','Live audio waveform')}>{bars.map((height,index)=><i key={index} style={{height:`${height}px`}}/>)}</div>}
    {processing&&<small className="voice-hint" role="status"><LoaderCircle size={14}/>{tr(lang,'جارٍ تفريغ التسجيل…','Transcribing recording…')}</small>}
    {error&&<small className="voice-error" role="alert">{error}</small>}
    {active&&<small className="voice-hint">{tr(lang,'بعد الإيقاف سيضاف النص النهائي ويمكنك تعديله.','After stopping, the final transcript will be added for you to edit.')}</small>}
  </div>;
}
function Avatar({name, size='md'}:{name:string;size?:'sm'|'md'|'lg'}) {
  const iconSize = size === 'lg' ? 27 : size === 'sm' ? 16 : 20;
  return <span className={`avatar avatar-${size}`} role="img" aria-label={name}><UserRound size={iconSize} strokeWidth={1.8} aria-hidden="true"/></span>;
}
function StatusBadge({status,lang}:{status:string;lang:Lang}) {
  const Icon=status==='closed'?CheckCircle2:status==='in_progress'?Wrench:status==='awaiting_confirmation'?Clock3:status==='review'?Activity:CircleAlert;
  return <span className={`status-pill status-${status}`}><span className="status-icon"><Icon size={13}/></span><span className="status-label">{statusText(status,lang)}</span></span>;
}
function PriorityBadge({priority,lang}:{priority:string;lang:Lang}) {
  const Icon=priority==='urgent'?CircleAlert:priority==='high'?ArrowUpRight:priority==='low'?ArrowDownLeft:Activity;
  return <span className={`priority-badge priority-${priority}`}><Icon size={13}/><span>{priorityText(priority,lang)}</span></span>;
}
function Button({children,onClick,href,kind='primary',disabled=false,className='',type='button'}:{children:ReactNode;onClick?:()=>void;href?:string;kind?:'primary'|'soft'|'outline'|'ghost'|'danger';disabled?:boolean;className?:string;type?:'button'|'submit'}) {
  const cls=`btn btn-${kind} ${className}`;
  return href ? <Link href={href} className={cls} data-testid={`link-${href.replaceAll('/','-')}`}>{children}</Link> : <button type={type} disabled={disabled} onClick={onClick} className={cls} data-testid="button-action">{children}</button>;
}
function State({title,detail,retry,loading=false}:{title:string;detail?:string;retry?:()=>void;loading?:boolean}) {
  return <div className="state-panel">{loading?<span className="loader-ring"><LoaderCircle/></span>:<CircleAlert size={25}/>}<strong>{title}</strong>{detail&&<p>{detail}</p>}{retry&&<Button kind="outline" onClick={retry}><RotateCcw size={16}/> إعادة المحاولة</Button>}</div>;
}
function TicketRow({ticket,lang}:{ticket:Ticket;lang:Lang}) {
  return <Link href={`/workspace/tickets/${ticket.id}`} className="ticket-row" data-testid={`ticket-row-${ticket.id}`}>
    <span className="ticket-number">{ticket.number}</span><span className="ticket-summary"><b>{ticket.title}</b><small>{ticket.branchName} · {ticket.location} · {ticket.technicianName||tr(lang,'بانتظار الإسناد','Awaiting assignment')}</small></span>
    <PriorityBadge priority={ticket.priority} lang={lang}/><StatusBadge status={ticket.status} lang={lang}/>
    <span className="ticket-date">{dateText(ticket.createdAt,lang)}</span><ChevronLeft size={16} className="row-arrow"/>
  </Link>;
}
function TicketList({tickets,lang,empty='لا توجد بلاغات هنا بعد'}:{tickets:Ticket[];lang:Lang;empty?:string}) {
  if (!tickets.length) return <div className="empty-inline" role="status" aria-live="polite"><ClipboardList size={23}/><b>{empty}</b><span>{tr(lang,'ستظهر البلاغات الجديدة هنا','New reports will appear here')}</span></div>;
  return <div className="ticket-list">{tickets.map(t=><TicketRow key={t.id} ticket={t} lang={lang}/>)}</div>;
}
function TadarukMark({reduced}:{reduced:boolean}) {
  const bodyTransition={duration:reduced?0:.55,ease:[.22,.72,.18,1] as const,delay:reduced?0:1.28};
  const firstTransition={duration:.9,ease:[.22,.72,.18,1] as const,delay:.12};
  const secondTransition={duration:.9,ease:[.22,.72,.18,1] as const,delay:.3};
  return <motion.svg className="hero-mark" viewBox="279 0 477 410" role="img" aria-label="TADARUK تدارك" initial={reduced?false:'hidden'} animate="visible">
    <defs>
      <linearGradient id="tadaruk-mark-gradient" x1="279.799" y1="146.019" x2="755.841" y2="146.019" gradientUnits="userSpaceOnUse">
        <stop offset=".03" stopColor="#1E3263"/><stop offset=".17" stopColor="#1F3565"/><stop offset=".31" stopColor="#22416E"/><stop offset=".45" stopColor="#28557C"/><stop offset=".59" stopColor="#307190"/><stop offset=".73" stopColor="#3A95AA"/><stop offset=".86" stopColor="#47C0CA"/><stop offset="1" stopColor="#56F4EF"/>
      </linearGradient>
      <clipPath id="tadaruk-mark-clip"><rect x="279.799" width="476.042" height="409"/></clipPath>
    </defs>
    <motion.g variants={{hidden:{opacity:0},visible:{opacity:1,transition:bodyTransition}}}>
      <g clipPath="url(#tadaruk-mark-clip)">
        <path d="M723.359 0H312.3C294.347 0 279.799 14.5485 279.799 32.5015V72.0298C279.799 89.9828 294.347 104.531 312.3 104.531H373.859V292.058L424.868 130.996C429.856 115.24 444.484 104.531 461.011 104.531H723.359C741.312 104.531 755.86 89.9828 755.86 72.0298V32.5015C755.86 14.5485 741.312 0 723.359 0Z" fill="url(#tadaruk-mark-gradient)"/>
        <path d="M372.731 332.358L363.804 313.415C361.251 307.972 355.768 304.508 349.75 304.508H312.281C294.328 304.508 279.779 319.057 279.779 337.01V376.538C279.779 394.491 294.328 409.039 312.281 409.039H723.339C741.292 409.039 755.841 394.491 755.841 376.538V337.01C755.841 319.057 741.292 304.508 723.339 304.508H661.78V116.962L610.772 278.024C605.784 293.78 591.156 304.488 574.628 304.488H385.795" fill="#1E3263"/>
      </g>
    </motion.g>
    <motion.path d="M569.838 246.156H536.624V279.37H569.838V246.156Z" fill="#1E3263" initial={reduced?false:{opacity:0,x:-58,y:-48}} animate={reduced?{opacity:1,x:0,y:0}:{opacity:[0,1,1,1],x:[-58,-35,-12,0],y:[-48,-57,-20,0]}} transition={reduced?{duration:0}:firstTransition}/>
    <motion.path d="M489.14 246.374H455.926V279.588H489.14V246.374Z" fill="#1E3263" initial={reduced?false:{opacity:0,x:60,y:44}} animate={reduced?{opacity:1,x:0,y:0}:{opacity:[0,1,1,1],x:[60,48,19,0],y:[44,22,8,0]}} transition={reduced?{duration:0}:secondTransition}/>
  </motion.svg>;
}
function Landing({lang,setLang,dark,setDark}:{lang:Lang;setLang:(x:Lang)=>void;dark:boolean;setDark:(x:boolean)=>void}) {
  const health=useHealthCheck();
  const reduced=useReducedMotion()===true || (typeof window!=='undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  const [headlineDone,setHeadlineDone]=useState(reduced);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [dividerPulse,setDividerPulse]=useState(0);
  const [activeSection,setActiveSection]=useState('top');
  const [roadmapProgress,setRoadmapProgress]=useState(reduced?3:-1);
  const roadmapRef=useRef<HTMLElement|null>(null);
  const sectionIds=['top','how','impact','final'];
  const sectionLabels=lang==='ar'?['الرئيسية','رحلة البلاغ','الأثر','استكشف']:['Home','The journey','The impact','Explore'];
  useEffect(()=>{if(reduced)setHeadlineDone(true);},[reduced]);
  useEffect(()=>{
    const sections=sectionIds.map(id=>document.getElementById(id)).filter((node):node is HTMLElement=>Boolean(node));
    const observer=new IntersectionObserver(entries=>{
      const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(visible)setActiveSection(visible.target.id);
    },{rootMargin:'-22% 0px -58% 0px',threshold:[0,.15,.35,.6]});
    sections.forEach(section=>observer.observe(section));
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(reduced){setRoadmapProgress(3);return;}
    const section=roadmapRef.current;
    if(!section)return;
    let timers:number[]=[];
    const observer=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){
        setRoadmapProgress(0);
        timers=[1,2,3].map((step)=>window.setTimeout(()=>setRoadmapProgress(step),step*1450));
        observer.disconnect();
      }
    },{threshold:.28});
    observer.observe(section);
    return ()=>{observer.disconnect();timers.forEach(window.clearTimeout);};
  },[reduced]);
  const goToSection=(id:string)=>{
    setMobileOpen(false);
    const target=document.getElementById(id);
    if(target){
      setDividerPulse(pulse=>pulse+1);
      window.scrollTo({top:target.getBoundingClientRect().top+window.scrollY-86,behavior:reduced?'auto':'smooth'});
    }
  };
  const labels=lang==='ar'?['بلاغ جديد','تحليل ذكي','إسناد للفني','تم الإصلاح']:['New report','Smart analysis','Technician assigned','Repair confirmed'];
  const impact=lang==='ar'?[
    ['بلاغات لا تضيع','كل بلاغ في سجل واحد.'],
    ['مسؤولية واضحة','كل مهمة لها مسؤول وحالة.'],
    ['متابعة من مكان واحد','اعرف حالة البلاغ بوضوح.'],
    ['معرفة تتراكم','حلول الأعطال السابقة متاحة للرجوع إليها.']
  ]:[
    ['Nothing gets lost','Every report has one clear record.'],
    ['Ownership is clear','Every task has an owner and a status.'],
    ['One place to follow','See where every report stands.'],
    ['Knowledge carries forward','Past repair guidance stays available.']
  ];
  const impactIcons=[ClipboardList,Users,Activity,BookOpen];
  const closeMenu=()=>setMobileOpen(false);
  return <main className="landing" dir={lang==='ar'?'rtl':'ltr'}>
    <header className="landing-nav wrap">
      <Link href="/" className="landing-brand" aria-label="TADARUK home" onClick={closeMenu}><Brand darkMode={dark}/></Link>
      <nav className={`landing-links ${mobileOpen?'is-open':''}`} aria-label={tr(lang,'التنقل الرئيسي','Main navigation')}>
        {sectionIds.map((id,index)=><button key={id} className={`landing-nav-link ${activeSection===id?'is-active':''}`} onClick={()=>goToSection(id)} aria-current={activeSection===id?'location':undefined}>{sectionLabels[index]}</button>)}
      </nav>
      <div className="nav-actions">
        <button className="nav-lang" onClick={()=>setLang(lang==='ar'?'en':'ar')} aria-label={tr(lang,'التبديل إلى الإنجليزية','Switch to Arabic')}><Languages size={16}/><span>{lang==='ar'?'English':'العربية'}</span></button>
        <SunMoonThemeToggle
          className="landing-theme-toggle"
          theme={dark?'dark':'light'}
          onThemeChange={theme=>setDark(theme==='dark')}
          aria-label={dark?tr(lang,'تفعيل الوضع الفاتح','Switch to light mode'):tr(lang,'تفعيل الوضع الداكن','Switch to dark mode')}
          data-testid="theme-toggle-landing"
          size={40}
          duration={860}
        />
        <button className="landing-menu-toggle" onClick={()=>setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-label={mobileOpen?tr(lang,'إغلاق القائمة','Close menu'):tr(lang,'فتح القائمة','Open menu')}>{mobileOpen?<X size={20}/>:<Menu size={20}/>}</button>
      </div>
      <div className="landing-nav-divider" aria-hidden="true">
        <span className="landing-nav-divider-track"/>
        <span className="landing-nav-divider-reveal"/>
        <span key={dividerPulse} className={`landing-nav-divider-pulse ${dividerPulse?'is-active':''}`}/>
      </div>
    </header>
    <section className="hero wrap" id="top" aria-labelledby="landing-title">
      <div className="hero-mark-stage"><div className="mark-halo" aria-hidden="true"/><TadarukMark reduced={reduced}/></div>
      <div className="hero-copy">
        <motion.div className="hero-light-reveal" aria-hidden="true" initial={reduced?false:{opacity:0,x:'-28%',scaleX:.62}} animate={reduced?{opacity:0,x:0,scaleX:1}:{opacity:[0,.2,0],x:['-28%','0%','28%'],scaleX:[.62,1,.62]}} transition={reduced?{duration:0}:{duration:.95,delay:1.84,ease:[.22,.72,.18,1]}}/>
        <h1 id="landing-title" className={lang==='ar'?'display-ar':''}><BlurText text={tr(lang,'كل بلاغ يستحق أن يُتدارك','Every report deserves to be put right')} animateBy="words" trigger="load" startDelay={reduced?0:1880} reducedMotion={reduced} delay={70} stepDuration={.22} animationFrom={{opacity:0,y:12}} animationTo={[{opacity:.82,y:-1},{opacity:1,y:0}]} easing={[.22,.72,.18,1]} className="landing-headline-words" onAnimationComplete={()=>setHeadlineDone(true)}/></h1>
        <motion.p className="hero-sub" initial={false} animate={headlineDone?{opacity:1,y:0}:{opacity:0,y:8}} transition={reduced?{duration:0}:{duration:.42,ease:[.22,.72,.18,1]}}>{tr(lang,'بلّغ. تابع. وتدارك.','Report. Follow through. Put it right.')}</motion.p>
      </div>
    </section>
    <section className="workflow-reveal wrap" id="how" ref={roadmapRef} aria-label={tr(lang,'مسار البلاغ','Report workflow')}>
      <motion.div className="workflow-heading" initial={reduced?false:{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.45}} transition={reduced?{duration:0}:{duration:.48,ease:[.22,.72,.18,1]}}>
        <span className="eyebrow">{tr(lang,'كيف يعمل','HOW IT WORKS')}</span>
        <h2 className={lang==='ar'?'display-ar':''}>{tr(lang,'من البلاغ إلى الإصلاح','From report to repair')}</h2>
      </motion.div>
      <div className={`roadmap ${roadmapProgress>=0?'has-started':''}`} data-progress={roadmapProgress}>
        <svg className="roadmap-path roadmap-path-desktop" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="roadmap-gradient" x1="0" x2="1"><stop offset="0" stopColor={dark?'#6f8ba3':'#1e3263'}/><stop offset=".52" stopColor={dark?'#75aeb4':'#4d9aa8'}/><stop offset="1" stopColor={dark?'#71d0c9':'#56c9c4'}/></linearGradient></defs>
          <motion.path className="roadmap-track" d="M55 126 C185 126 176 42 315 45 S445 178 575 132 S748 82 810 104 S870 112 905 106" pathLength="1" initial={{pathLength:reduced?1:0}} animate={{pathLength:roadmapProgress>=0?1:0}} transition={reduced?{duration:0}:{duration:4.7,ease:[.42,0,.58,1]}}/>
          <motion.path className="roadmap-glint" d="M55 126 C185 126 176 42 315 45 S445 178 575 132 S748 82 810 104 S870 112 905 106" pathLength="1" initial={{pathLength:0,opacity:0}} animate={roadmapProgress>=0&&!reduced?{pathLength:[0,.12,0],pathOffset:[0,.88,1],opacity:[0,.82,0]}:{pathLength:0,opacity:0}} transition={reduced?{duration:0}:{duration:4.7,ease:[.42,0,.58,1]}}/>
        </svg>
        <svg className="roadmap-path roadmap-path-mobile" viewBox="0 0 80 520" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="roadmap-gradient-mobile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={dark?'#6f8ba3':'#1e3263'}/><stop offset=".52" stopColor={dark?'#75aeb4':'#4d9aa8'}/><stop offset="1" stopColor={dark?'#71d0c9':'#56c9c4'}/></linearGradient></defs>
          <motion.path className="roadmap-track" d="M37 33 C37 82 13 124 37 172 S61 258 37 310 S13 376 37 449" pathLength="1" initial={{pathLength:reduced?1:0}} animate={{pathLength:roadmapProgress>=0?1:0}} transition={reduced?{duration:0}:{duration:4.7,ease:[.42,0,.58,1]}}/>
          <motion.path className="roadmap-glint" d="M37 33 C37 82 13 124 37 172 S61 258 37 310 S13 376 37 449" pathLength="1" initial={{pathLength:0,opacity:0}} animate={roadmapProgress>=0&&!reduced?{pathLength:[0,.12,0],pathOffset:[0,.88,1],opacity:[0,.82,0]}:{pathLength:0,opacity:0}} transition={reduced?{duration:0}:{duration:4.7,ease:[.42,0,.58,1]}}/>
        </svg>
        <div className="workflow-steps">{labels.map((label,index)=>{
          const StepIcon=[ClipboardList,Activity,Wrench,CheckCircle2][index];
          return <motion.div className={`workflow-step ${roadmapProgress>=index?'is-reached':''} ${roadmapProgress===index?'is-current':''}`} key={label} initial={reduced?false:{opacity:0,y:12}} animate={roadmapProgress>=0?{opacity:1,y:0}:{opacity:0,y:12}} transition={reduced?{duration:0}:{duration:.45,delay:index*.13,ease:[.22,.72,.18,1]}}>
            <span className="workflow-node"><StepIcon size={23} strokeWidth={1.7}/></span>
            <span className="workflow-index">0{index+1}</span><span className="workflow-label">{label}</span>
          </motion.div>;
        })}</div>
      </div>
    </section>
    <section className="landing-impact wrap" id="impact" aria-labelledby="impact-title">
      <div className="impact-heading">
        <motion.div initial={reduced?false:{opacity:0,y:14}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.4}} transition={reduced?{duration:0}:{duration:.5,ease:[.22,.72,.18,1]}}>
          <span className="eyebrow">{tr(lang,'نتيجة العمل المنظم','THE DIFFERENCE')}</span>
          <h2 id="impact-title" className={lang==='ar'?'display-ar':''}>{tr(lang,'أثر تدارك على منشأتك','A clearer picture of maintenance')}</h2>
        </motion.div>
        <p>{tr(lang,'سجل واحد يجمع البلاغ والمسؤولية وخطوات الإصلاح، لتبقى الصورة واضحة للجميع.','One record brings reports, ownership and repair progress together, so everyone can see what happens next.')}</p>
      </div>
      <div className="impact-grid">{impact.map(([title,copy],index)=>{
        const ImpactIcon=impactIcons[index];
        return <motion.article className={`impact-card impact-card-${index+1}`} key={title} initial={reduced?false:{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.22}} transition={reduced?{duration:0}:{duration:.46,delay:index*.09,ease:[.22,.72,.18,1]}}>
          <div className={`impact-visual impact-visual-${index+1}`} aria-hidden="true">
            {index===0&&<><i className="report-fragment fragment-a"/><i className="report-fragment fragment-b"/><i className="report-fragment fragment-c"/><span className="report-record"><i/><i/><i/></span></>}
            {index===1&&<><span className="task-owner-link"/><span className="task-chip"><i/><i/></span><span className="owner-chip"><i/></span></>}
            {index===2&&<><span className="progress-rail"><i/></span><span className="progress-steps"><i/><i/><i/><i/></span><span className="progress-caption"><i/><i/></span></>}
            {index===3&&<><span className="knowledge-sheet sheet-back"><i/><i/></span><span className="knowledge-sheet sheet-front"><i/><i/><i/></span><span className="knowledge-scan"/></>}
          </div>
          <span className="impact-icon"><ImpactIcon size={21} strokeWidth={1.7}/></span><span className="impact-index">0{index+1}</span>
          <h3>{title}</h3><p>{copy}</p>
        </motion.article>;
      })}</div>
    </section>
    <section className="landing-end wrap" id="final">
      <div><span className="eyebrow"><span className="live-dot"/>{health.isLoading?tr(lang,'جارٍ الاتصال','CONNECTING'):health.isError?tr(lang,'العرض متاح','DEMO AVAILABLE'):tr(lang,'من البلاغ إلى الإصلاح','REPORT TO REPAIR')}</span><h2 className={lang==='ar'?'display-ar':''}>{tr(lang,'جاهز تبدأ مع تدارك؟','Ready to start with Tadaruk?')}</h2><p>{tr(lang,'من أول بلاغ إلى آخر خطوة، كل شيء أوضح.','From the first report to the final step, everything is clearer.')}</p></div>
      <Button href="/demo">{tr(lang,'استكشف تدارك','Explore Tadaruk')}<ArrowLeft size={17}/></Button>
    </section>
    <footer className="landing-footer wrap">
      <div className="footer-brand"><Brand darkMode={dark}/><p>{tr(lang,'منصة عربية تجمع بلاغات الصيانة ومسؤوليتها وتقدمها في سجل واضح.','An Arabic-first platform keeping maintenance reports, ownership and progress in one clear record.')}</p></div>
      <nav className="footer-links" aria-label={tr(lang,'روابط الصفحة','Page links')}>{sectionIds.slice(1,3).map((id,index)=><button key={id} onClick={()=>goToSection(id)}>{sectionLabels[index+1]}</button>)}</nav>
      <div className="footer-meta"><button className="nav-lang" onClick={()=>setLang(lang==='ar'?'en':'ar')}><Languages size={15}/>{lang==='ar'?'English':'العربية'}</button><span>© {new Date().getFullYear()} TADARUK</span></div>
    </footer>
  </main>;
}
function DemoPage({lang,dark,setDark}:{lang:Lang;dark:boolean;setDark:(dark:boolean)=>void}) {
  const {data:users,isLoading,isError,refetch}=useListDemoUsers();
  const select=useSelectDemoAccount(); const [,go]=useLocation();
  const enter=(userId:string)=>select.mutate({data:{userId}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getGetDemoSessionQueryKey()});go('/workspace');}});
  return <main className="demo-page" dir={lang==='ar'?'rtl':'ltr'}><header className="demo-top"><Link href="/"><Brand darkMode={dark}/></Link><span>{tr(lang,'بيئة تجريبية آمنة','A guided demo environment')}</span><SunMoonThemeToggle className="demo-theme-toggle" theme={dark?'dark':'light'} onThemeChange={theme=>setDark(theme==='dark')} aria-label={dark?tr(lang,'تفعيل الوضع الفاتح','Switch to light mode'):tr(lang,'تفعيل الوضع الداكن','Switch to dark mode')} data-testid="theme-toggle-demo" size={40} duration={860}/></header><section className="demo-content fade-up"><div className="eyebrow"><span className="live-dot"/>TADARUK · {tr(lang,'تجربة','DEMO')}</div><h1 className={lang==='ar'?'display-ar':''}>{tr(lang,'اختر نقطة البداية','Choose your point of view')}</h1><p>{tr(lang,'ثلاثة أدوار، وسجل واحد يتابع البلاغ حتى إغلاقه.','Three roles, one record that follows a repair to closure.')}</p>
    {isLoading?<div className="role-grid"><div className="skeleton-card"/><div className="skeleton-card"/><div className="skeleton-card"/></div>:isError?<State title="تعذر تحميل الحسابات" detail="تحقق من اتصال الخدمة ثم حاول مجدداً" retry={()=>void refetch()}/>:<div className="role-grid">{(users||[]).map((user,index)=><SpotlightCard className="role-card-spotlight" key={user.id} theme={dark?'dark':'light'} spotlightColor="rgba(86, 244, 239, .88)" intensity={.25} borderGlow={.42} softness={.82} spotlightSize={220} proximity={64} smoothing={.34} flare={false}><button type="button" className={`role-card role-${user.role}`} onClick={()=>enter(user.id)} disabled={select.isPending} data-testid={`select-role-${user.role}`}><span className="role-card-top"><span className="role-index">0{index+1}</span><ArrowUpRight size={18}/></span><Avatar name={user.name} size="lg"/><span className="role-title">{roleText(user.role,lang)}</span><b>{user.name}</b><small>{user.branchName || tr(lang,'جميع الفروع','All branches')}{user.specialization?` · ${user.specialization}`:''}</small><span className="role-cta">{select.isPending?'جارٍ الدخول':tr(lang,'الدخول بهذا الحساب','Enter as this user')}<ArrowLeft size={15}/></span></button></SpotlightCard>)}</div>}
    {select.isError&&<p className="inline-error">لم نتمكن من فتح الحساب. حاول مرة أخرى.</p>}
    <Link href="/" className="back-link"><ArrowRight size={16}/>{tr(lang,'العودة للرئيسية','Back to home')}</Link>
  </section></main>;
}
function usePrefs() {
  const [lang,setLangState]=useState<Lang>(()=>(localStorage.getItem('tadaruk-lang') as Lang)||'ar');
  const [dark,setDark]=useState(()=>localStorage.getItem('tadaruk-theme')==='dark');
  useEffect(()=>{localStorage.setItem('tadaruk-lang',lang);document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';},[lang]);
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);localStorage.setItem('tadaruk-theme',dark?'dark':'light');},[dark]);
  return {lang,setLang:(x:Lang)=>setLangState(x),dark,setDark};
}
function WorkspaceShell({children,title,lang,setLang,dark,setDark}:{children:ReactNode;title:string;lang:Lang;setLang:(x:Lang)=>void;dark:boolean;setDark:(x:boolean)=>void}) {
  const {data:session}=useGetDemoSession();
  const user=session?.user; const [,go]=useLocation(); const [menu,setMenu]=useState(false); const [mobile,setMobile]=useState(false);
  const branchContext=useContext(ReporterBranchContext);
  const qc=useQueryClient();const logout=useClearDemoSession();
  const reduced=useReducedMotion()===true || (typeof window!=='undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  useEffect(()=>{if(session && !user && window.location.pathname.startsWith('/workspace'))go('/demo');},[session,user,go]);
  if(!user)return <div className="workspace-loading"><div className="skeleton-bar"/><div className="skeleton-card"/></div>;
  const links=user.role==='manager'?[['/workspace','نظرة عامة','Overview',LayoutDashboard],['/workspace/tickets','البلاغات','Tickets',ClipboardList],['/workspace/technicians','الفنيون','Technicians',Users],['/workspace/branches','الفروع','Branches',Building2],['/workspace/knowledge','قاعدة المعرفة','Knowledge',BookOpen]]:user.role==='technician'?[['/workspace','مهامي','My tasks',Wrench],['/workspace/tickets','كل المهام','Tasks',ClipboardList]]:[['/workspace','الرئيسية','Home',LayoutDashboard],['/workspace/tickets/new','بلاغ جديد','New report',Plus],['/workspace/tickets','بلاغاتي','My reports',ClipboardList]];
  const signOut=()=>logout.mutate(undefined,{onSuccess:()=>{qc.clear();setMenu(false);setMobile(false);go('/demo');}});
  const active=(path:string)=>window.location.pathname===path;
  const reporterBranches=branchContext?.branches||[];
  const selectedBranch=reporterBranches.find(branch=>branch.id===branchContext?.selectedBranchId)
    ||reporterBranches.find(branch=>branch.id===user.branchId)
    ||reporterBranches[0];
  const branchLabel=selectedBranch?.name
    ||(branchContext?.status==='loading'?tr(lang,'جاري تحميل الفروع','Loading branches')
      :branchContext?.status==='error'?tr(lang,'تعذر تحميل الفروع','Could not load branches')
        :branchContext?.status==='success'?tr(lang,'لا يوجد فرع مسموح به','No authorized branch')
          :user.branchName||tr(lang,'يحدد من حسابك','Set by your account'));
  return <div className={`app-shell ${user.role==='reporter'?'reporter-shell':''}`} dir={lang==='ar'?'rtl':'ltr'}>
    <aside className={`sidebar ${mobile?'sidebar-open':''}`}><div className="side-brand"><Link href="/workspace"><Brand darkMode={dark}/></Link><button className="mobile-close" onClick={()=>setMobile(false)}><X size={18}/></button></div>
      {user.role==='reporter'&&reporterBranches.length>1
        ?<label className="branch-switch branch-switch-multi" data-testid="field-sidebar-branch"><span className="branch-icon"><Building2 size={16}/></span><span className="branch-switch-copy"><small>{tr(lang,'الموقع الحالي','CURRENT LOCATION')}</small><select value={branchContext?.selectedBranchId||selectedBranch?.id||''} onChange={event=>branchContext?.selectBranch(event.currentTarget.value)} aria-label={tr(lang,'اختيار الفرع المصرح به','Choose an authorized branch')} data-testid="select-sidebar-branch">{reporterBranches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></span><ChevronDown size={15}/></label>
        :<div className="branch-switch" data-testid={user.role==='reporter'?'text-sidebar-branch':'branch-indicator'}><span className="branch-icon"><Building2 size={16}/></span><span><small>{tr(lang,'الموقع الحالي','CURRENT LOCATION')}</small><b>{user.role==='reporter'?branchLabel:user.branchName||tr(lang,'جميع الفروع','All branches')}</b></span></div>}
      <nav className="side-nav">{links.map(([path,ar,en,Icon])=><Link key={path as string} href={path as string} onClick={()=>setMobile(false)} className={`side-link ${active(path as string)?'selected':''}`}><Icon size={19}/><span>{tr(lang,ar as string,en as string)}</span>{active(path as string)&&<span className="nav-active-mark"/>}</Link>)}</nav>
      <div className="side-bottom"><div className="side-user">
        <button className="side-user-trigger" onClick={()=>setMenu(!menu)} aria-label={tr(lang,'خيارات الملف الشخصي','Profile options')} aria-expanded={menu} aria-controls="account-menu"><Avatar name={user.name}/><span><b>{user.name}</b><small>{roleText(user.role,lang)}</small></span><ChevronDown size={16}/></button>
        <AnimatePresence>{menu&&<motion.nav id="account-menu" className="account-menu" aria-label={tr(lang,'خيارات الحساب','Account options')} initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={reduced?{opacity:1}:{opacity:0,y:5}} transition={{duration:reduced?0:.16,ease:[.22,.72,.18,1]}}><div className="account-menu-head"><b>{user.name}</b><small>{roleText(user.role,lang)}</small></div><Link href="/demo" onClick={()=>{setMenu(false);setMobile(false);}}><RotateCcw size={15}/>{tr(lang,'تبديل الحساب','Switch account')}</Link>{logout.isError&&<p className="account-menu-error" role="alert">{tr(lang,'تعذر تسجيل الخروج، حاول مجدداً.','Could not sign out. Please try again.')}</p>}<button type="button" className="account-menu-signout" onClick={signOut} disabled={logout.isPending} aria-busy={logout.isPending}><LogOut size={15}/>{logout.isPending?tr(lang,'جارٍ تسجيل الخروج…','Signing out…'):tr(lang,'تسجيل الخروج','Sign out')}</button></motion.nav>}</AnimatePresence>
      </div></div>
    </aside>
    <AnimatePresence>{mobile&&<motion.button type="button" className="mobile-scrim" onClick={()=>setMobile(false)} aria-label={tr(lang,'إغلاق القائمة','Close navigation')} initial={reduced?false:{opacity:0}} animate={{opacity:1}} exit={reduced?{opacity:1}:{opacity:0}} transition={{duration:reduced?0:.16}}/>}</AnimatePresence>
    <div className="main-frame"><header className="topbar"><div className="topbar-title"><button className="mobile-menu" onClick={()=>setMobile(true)}><Menu size={20}/></button><span>{title}</span></div><div className="top-controls"><button onClick={()=>setLang(lang==='ar'?'en':'ar')} className="icon-control" aria-label={tr(lang,'تغيير اللغة','Switch language')}><Languages size={18}/><span>{lang==='ar'?'EN':'ع'}</span></button><SunMoonThemeToggle className="workspace-theme-toggle" theme={dark?'dark':'light'} onThemeChange={theme=>setDark(theme==='dark')} aria-label={dark?tr(lang,'تفعيل الوضع الفاتح','Switch to light mode'):tr(lang,'تفعيل الوضع الداكن','Switch to dark mode')} data-testid="theme-toggle-workspace" size={40} duration={860}/></div></header><main className="workspace-content">{children}</main></div>
  </div>;
}
function PageTitle({eyebrow,title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}) {
  return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div className="page-title-action">{action}</div>}</div>;
}
function OverviewPage({lang,user}:{lang:Lang;user:DemoUser}) {
  const {data:overview,isLoading,isError,refetch}=useGetOverview(); const {data:tickets}=useListTickets();
  const manager=user.role==='manager',tech=user.role==='technician';
  const title=manager?tr(lang,'نظرة عامة','Overview'):tech?tr(lang,'مهامي اليوم','My work today'):tr(lang,'مرحباً، '+user.name.split(' ')[0],'Welcome, '+user.name.split(' ')[0]);
  if(isLoading)return <State title={tr(lang,'جاري ترتيب مساحة العمل','Loading your workspace')} loading/>;
  if(isError)return <State title={tr(lang,'تعذر تحميل مساحة العمل','Could not load workspace')} detail={tr(lang,'قد تكون الخدمة غير متاحة مؤقتاً.','The service may be temporarily unavailable.')} retry={()=>void refetch()}/>;
  const own=(tickets||[]).slice(0,4);
  return <div className="page-enter"><PageTitle eyebrow={manager?tr(lang,'العمليات · ٠١','OPERATIONS / 01'):tr(lang,'مساحة العمل','YOUR WORKSPACE')} title={title} description={manager?tr(lang,'كل بلاغ واضح، وكل خطوة لها صاحب.','Every report has an owner and a clear next step.'):tech?tr(lang,'ابدأ بالأولوية، وسجّل ما أصلحته للفريق.','Start with the highest priority and record the repair.'):tr(lang,'أخبرنا بما يحتاج إلى عناية. سنبقيك على اطلاع حتى يكتمل الإصلاح.','Tell us what needs attention. We will keep you updated through resolution.')}/>
     {manager?<><div className="overview-grid"><div className="metric-lead metric-open"><div className="metric-lead-head"><span className="metric-label">{tr(lang,'البلاغات المفتوحة','Open tickets')}</span><span className="metric-lead-icon" aria-hidden="true"><Activity size={21}/></span></div><strong>{overview?.openTickets??0}</strong><span className="metric-foot"><Building2 size={16}/>{tr(lang,'عبر جميع الفروع','Across all branches')}</span></div><div className="metric-card metric-urgent"><div className="metric-card-head"><span>{tr(lang,'طارئة','Urgent')}</span><span className="metric-card-icon" aria-hidden="true"><CircleAlert size={20}/></span></div><strong>{overview?.urgentTickets??0}</strong><small>{tr(lang,'تحتاج إلى متابعة سريعة','Needs prompt follow-up')}</small></div><div className="metric-card metric-pending"><div className="metric-card-head"><span>{tr(lang,'بانتظار الإسناد','Awaiting assignment')}</span><span className="metric-card-icon" aria-hidden="true"><Users size={20}/></span></div><strong>{overview?.pendingAssignment??0}</strong><small>{tr(lang,'تحتاج إلى توجيه','Needs routing')}</small></div><div className="metric-card metric-confirm"><div className="metric-card-head"><span>{tr(lang,'بانتظار التأكيد','Awaiting confirmation')}</span><span className="metric-card-icon" aria-hidden="true"><Clock3 size={20}/></span></div><strong>{overview?.awaitingConfirmation??0}</strong><small>{tr(lang,'تنتظر المبلّغ','Waiting on reporter')}</small></div></div>
      <div className="dashboard-columns"><section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,'سجل البلاغات المباشر','LIVE REGISTER')}</span><h2>{tr(lang,'آخر البلاغات','Recent tickets')}</h2></div><Link href="/workspace/tickets" className="text-link">{tr(lang,'كل البلاغات','All tickets')} <ArrowLeft size={15}/></Link></div><TicketList tickets={overview?.recentTickets||[]} lang={lang}/></section><aside className="ops-aside"><section className="resolved-callout"><span className="callout-symbol"><Check size={19}/></span><small>{tr(lang,'هذا الشهر','This month')}</small><strong>{overview?.resolvedThisMonth??0}</strong><b>{tr(lang,'إصلاحاً مؤكداً','Confirmed repairs')}</b><p>{tr(lang,'كل حل موثق يجعل الاستجابة التالية أذكى.','A documented fix helps the team respond faster next time.')}</p></section><section className="quick-links"><span className="eyebrow">{tr(lang,'إدارة العمليات','OPERATIONS')}</span><Link href="/workspace/technicians"><Users size={17}/>{tr(lang,'الفنيون','Technicians')} <ArrowLeft size={14}/></Link><Link href="/workspace/branches"><Building2 size={17}/>{tr(lang,'الفروع','Branches')} <ArrowLeft size={14}/></Link><Link href="/workspace/knowledge"><BookOpen size={17}/>{tr(lang,'قاعدة المعرفة','Knowledge base')} <ArrowLeft size={14}/></Link></section></aside></div></>:<div className="personal-layout"><section className="personal-feature"><div className="personal-feature-copy"><span className="eyebrow">{tech?tr(lang,'قائمة المهام','TASK QUEUE'):tr(lang,'صيانة أوضح','MAINTENANCE, MADE SIMPLE')}</span><h2 className={lang==='ar'?'display-ar':''}>{tech?tr(lang,'ما الذي يحتاج إليك الآن؟','What needs your attention?'):tr(lang,'بلاغك يصل إلى الشخص المناسب.','Your report reaches the right person.')}</h2><p>{tech?tr(lang,'البلاغات المسندة إليك مرتبة لتبدأ العمل دون بحث.','Your assigned tickets are organized so you can get started.'):tr(lang,'وصف واضح كافٍ. سنرتب البلاغ ونتابعه معك.','A clear description is enough. We will route and track the report.')}</p><Button href={tech?'/workspace/tickets':'/workspace/tickets/new'} kind="outline">{tech?tr(lang,'افتح قائمة المهام','Open task list'):tr(lang,'ابدأ بلاغاً جديداً','Create a report')}<ArrowLeft size={16}/></Button></div><div className="feature-mark"><Wrench size={34}/><span/></div></section><section className="panel personal-tickets"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,tech?'مسندة إليك':'بلاغاتي',tech?'ASSIGNED TO YOU':'YOUR REPORTS')}</span><h2>{tech?tr(lang,'المهام الأخيرة','Recent tasks'):tr(lang,'بلاغاتي الأخيرة','Recent reports')}</h2></div><Link href="/workspace/tickets" className="text-link">{tr(lang,'عرض الكل','View all')} <ArrowLeft size={15}/></Link></div><TicketList tickets={own} lang={lang} empty={tech?tr(lang,'لا توجد مهام مسندة إليك','No tasks assigned to you'):tr(lang,'لم ترسل بلاغاً بعد','You have not submitted a report yet')}/></section></div>}
  </div>;
}
function TicketsPage({lang,user}:{lang:Lang;user:DemoUser}) {
  const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [branchId,setBranchId]=useState('');
  const isManager=user.role==='manager';
  const {data:branches}=useListBranches({query:{enabled:isManager,queryKey:getListBranchesQueryKey()}});
  const params=useMemo(()=>({search:search||undefined,status:status||undefined,branchId:isManager?branchId||undefined:undefined}),[search,status,branchId,isManager]);
  const {data:tickets,isLoading,isError,refetch}=useListTickets(params);
  const empty=search||status||branchId?tr(lang,'لا توجد نتائج مطابقة','No matching reports'):user.role==='reporter'?tr(lang,'لم ترسل بلاغاً بعد','You have not submitted a report yet'):tr(lang,'لا توجد بلاغات هنا بعد','No tickets here yet');
  const title=user.role==='reporter'?tr(lang,'بلاغاتي','My reports'):user.role==='technician'?tr(lang,'المهام المسندة','Assigned tasks'):tr(lang,'سجل البلاغات','Ticket register');
  const description=user.role==='reporter'?tr(lang,'تابع البلاغات التي أرسلتها وحالة كل منها.','Track the reports you submitted and their current status.'):user.role==='manager'?tr(lang,'تابع الحالة، الأولوية، والمسؤول عن كل بلاغ.','Track status, priority, and ownership for each ticket.'):tr(lang,'كل مهمة مسندة إليك في سجل واحد.','All tasks assigned to you in one register.');
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'سجل البلاغات','MAINTENANCE REGISTER')} title={title} description={description}/>
    <div className="filter-bar">
      <label className="search-field"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr(lang,'ابحث برقم البلاغ أو العنوان','Search ticket number or title')} data-testid="input-ticket-search"/></label>
      <label className="filter-select"><Filter size={16}/><select value={status} onChange={e=>setStatus(e.target.value)} aria-label={tr(lang,'تصفية حسب الحالة','Filter by status')}><option value="">{tr(lang,'كل الحالات','All statuses')}</option><option value="new">{tr(lang,'جديد','New')}</option><option value="review">{tr(lang,'قيد المراجعة','In review')}</option><option value="in_progress">{tr(lang,'جاري العمل','In progress')}</option><option value="awaiting_confirmation">{tr(lang,'بانتظار التأكيد','Awaiting confirmation')}</option><option value="closed">{tr(lang,'مغلق','Closed')}</option>{isManager&&<option value="cancelled">{tr(lang,'ملغي — سجل تاريخي','Cancelled — history')}</option>}</select></label>
      {isManager&&<label className="filter-select"><Building2 size={16}/><select value={branchId} onChange={e=>setBranchId(e.target.value)} aria-label={tr(lang,'تصفية حسب الفرع','Filter by branch')} data-testid="select-ticket-branch"><option value="">{tr(lang,'جميع الفروع','All branches')}</option>{(branches||[]).map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
    </div>
     {isLoading?<State title={tr(lang,'جاري تحميل البلاغات','Loading tickets')} loading/>:isError?<State title={tr(lang,'تعذر تحميل السجل','Could not load ticket register')} retry={()=>void refetch()}/>:<section className="panel register-panel"><div className="register-header"><span>{tr(lang,'البلاغ / الفرع','Ticket / Branch')}</span><span>{tr(lang,'الأولوية','Priority')}</span><span>{tr(lang,'الحالة','Status')}</span><span>{tr(lang,'تاريخ الإرسال','Submitted')}</span><span/></div><TicketList tickets={tickets||[]} lang={lang} empty={empty}/></section>}
  </div>;
}
function TicketDetail({lang,user}:{lang:Lang;user:DemoUser}) {
  const params=useParams<{ticketId:string}>();const id=params.ticketId||'';const {data:ticket,isLoading,isError,refetch}=useGetTicket(id,{query:{enabled:!!id,queryKey:getGetTicketQueryKey(id)}});
  const {data:technicians}=useListTechnicians({query:{enabled:user.role==='manager',queryKey:getListTechniciansQueryKey()}});
  const action=usePerformTicketAction();const query=useQueryClient();const [note,setNote]=useState('');const [cause,setCause]=useState('');const [resolution,setResolution]=useState('');const [actionFeedback,setActionFeedback]=useState('');
  const reduced=useReducedMotion()===true || (typeof window!=='undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  const [localPhoto,setLocalPhoto]=useState(()=>localStorage.getItem(`tadaruk-photo:${id}`)||'');
  useEffect(()=>{setLocalPhoto(localStorage.getItem(`tadaruk-photo:${id}`)||'');},[id]);
  const [technicianId,setTechnicianId]=useState('');
  const act=(a:'start'|'complete'|'confirm'|'reject'|'reassign',extra:Record<string,string>={})=>{setActionFeedback('');action.mutate({ticketId:id,data:{action:a,note,...extra}},{onSuccess:()=>{void query.invalidateQueries({queryKey:getGetTicketQueryKey(id)});void query.invalidateQueries({queryKey:getListTicketsQueryKey()});void query.invalidateQueries({queryKey:getGetOverviewQueryKey()});void query.invalidateQueries({queryKey:getListKnowledgeQueryKey()});setNote('');setActionFeedback(a==='start'?tr(lang,'بدأ العمل على البلاغ.','Work has started on this report.'):a==='complete'?tr(lang,'أُرسل الإصلاح للمراجعة.','The repair was sent for confirmation.'):a==='confirm'?tr(lang,'تم تأكيد الإصلاح وإغلاق البلاغ.','The repair was confirmed and the report closed.'):a==='reject'?tr(lang,'تمت إعادة البلاغ للفني.','The report was returned to the technician.'):tr(lang,'تم تحديث إسناد الفني.','The technician assignment was updated.'));}});};
  if(isLoading)return <State title={tr(lang,'جاري فتح تفاصيل البلاغ','Loading ticket details')} loading/>;if(isError||!ticket)return <State title={tr(lang,'تعذر فتح البلاغ','Could not open ticket')} detail={tr(lang,'قد لا يكون هذا البلاغ متاحاً لحسابك.','This ticket may not be available to your account.')} retry={()=>void refetch()}/>;
  const manager=user.role==='manager',technician=user.role==='technician',reporter=user.role==='reporter';
  return <div className="page-enter"><div className="detail-back"><Link href="/workspace/tickets"><ArrowRight size={16}/>{tr(lang,'العودة إلى البلاغات','Back to tickets')}</Link><span>{ticket.number}</span></div>
     <div className="detail-layout"><section className="detail-main"><div className="panel detail-hero"><div className="detail-tags"><StatusBadge status={ticket.status} lang={lang}/><PriorityBadge priority={ticket.priority} lang={lang}/><span className="ticket-number">{ticket.number}</span></div><h1>{ticket.title}</h1><p className="detail-description">{ticket.description}</p><div className="detail-properties"><span><Building2 size={16}/>{ticket.branchName}</span><span><MapPin size={16}/>{ticket.location}</span><span><Wrench size={16}/>{tr(lang,'التخصص','Specialty')}: {classificationText(ticket.specialization,lang)}</span><span><ClipboardList size={16}/>{tr(lang,'التصنيف','Classification')}: {classificationText(ticket.category,lang)}</span><span><Clock3 size={16}/>{dateText(ticket.createdAt,lang)}</span></div>
        {(ticket.imageUrl||localPhoto)&&<PhotoAttachmentCard imageUrl={ticket.imageUrl||localPhoto} lang={lang}/>}
    </div>
     <section className="panel timeline-panel"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,'سجل النشاط','ACTIVITY')}</span><h2>{tr(lang,'سجل المتابعة','Activity history')}</h2></div></div><div className="timeline">{(ticket.history||[]).map(ev=><div className="timeline-event" key={ev.id}><span className="timeline-dot"/><div><b>{ev.label}</b><small>{ev.actorName} · {dateText(ev.createdAt,lang)}</small>{ev.note&&<p>{ev.note}</p>}</div></div>)}</div></section>
      {(technician&&ticket.status==='in_progress'||technician&&ticket.status==='new')&&<section className="panel repair-panel"><span className="eyebrow">{tr(lang,'سجل الإصلاح','REPAIR RECORD')}</span><h2>{tr(lang,'وثّق ما أصلحته','Document the repair')}</h2><p>{tr(lang,'ملاحظاتك تساعد المبلّغ وتصبح معرفة للفريق عند إغلاق البلاغ.','Your notes help the reporter and become team knowledge after closure.')}</p><div className="form-two"><label className="field-label">{tr(lang,'السبب إن عُرف','Cause, if known')}<input value={cause} onChange={e=>setCause(e.target.value)} placeholder={tr(lang,'ما الذي أدى إلى المشكلة؟','What caused the issue?')}/></label><div className="field-label"><label htmlFor="repair-resolution">{tr(lang,'الحل والإجراء','Repair and action')}</label><textarea id="repair-resolution" value={resolution} onChange={e=>setResolution(e.target.value)} rows={3} placeholder={tr(lang,'ما الذي قمت به؟','What did you do?')}/><VoiceRecorder lang={lang} onTranscript={text=>setResolution(current=>current?`${current.trimEnd()} ${text}`:text)}/></div></div><label className="field-label">{tr(lang,'ملاحظة إضافية','Additional note')}<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder={tr(lang,'معلومة للفريق أو للمبلّغ','A note for the team or reporter')}/></label></section>}
    </section>
      <aside className="detail-side"><section className="panel owner-panel"><span className="eyebrow">{tr(lang,'الإسناد','ASSIGNMENT')}</span><h3>{tr(lang,'الأشخاص','People')}</h3><div className="person-line"><Avatar name={ticket.reporterName} size="sm"/><span><small>{tr(lang,'المبلّغ','Reporter')}</small><b>{ticket.reporterName}</b></span></div><div className="person-line"><Avatar name={ticket.technicianName||tr(lang,'غير مسند','Unassigned')} size="sm"/><span><small>{tr(lang,'الفني المسؤول','Assigned technician')}</small><b>{ticket.technicianName||tr(lang,'بانتظار الإسناد','Awaiting assignment')}</b></span></div>{technician&&ticket.technicianId===user.id&&(ticket.branchAddress||ticket.branchLatitude!==null&&ticket.branchLatitude!==undefined||ticket.branchLongitude!==null&&ticket.branchLongitude!==undefined)&&<a className="branch-map-link" href={branchMapUrl(ticket.branchLatitude,ticket.branchLongitude,ticket.branchAddress,ticket.branchCity)} target="_blank" rel="noreferrer" data-testid={`ticket-map-${ticket.id}`}><MapPinned size={16}/>{tr(lang,'افتح موقع الفرع في الخرائط','Open branch location in Maps')}<ArrowUpRight size={14}/></a>}</section>
       {ticket.repairNotes&&<section className="panel resolution-panel"><span className="eyebrow">{tr(lang,'ملاحظات الإصلاح','REPAIR NOTES')}</span><h3>{tr(lang,'ملاحظات الإصلاح','Repair notes')}</h3><p>{ticket.repairNotes}</p>{ticket.cause&&<><small>{tr(lang,'السبب','Cause')}</small><p>{ticket.cause}</p></>}{ticket.resolution&&<><small>{tr(lang,'الإجراء','Action taken')}</small><p>{ticket.resolution}</p></>}</section>}
        <section className="action-panel" aria-busy={action.isPending}><span className="eyebrow">{tr(lang,'الخطوة التالية','NEXT STEP')}</span>
         {ticket.status==='cancelled'&&<div className="cancelled-ticket-note" role="status"><CircleAlert size={18}/><span><b>{tr(lang,'أُلغي هذا البلاغ','This report was cancelled')}</b><small>{tr(lang,'حُفظ سجل الإلغاء للمراجعة.','The cancellation remains in the audit history.')}</small></span></div>}
         {technician&&(ticket.status==='new'||ticket.status==='review')&&<Button onClick={()=>act('start')} disabled={action.isPending}><Wrench size={17}/>{tr(lang,'بدء العمل','Start work')}</Button>}
         {technician&&ticket.status==='in_progress'&&<Button onClick={()=>act('complete',{cause,resolution:resolution||note})} disabled={action.isPending||(!resolution&&!note)}><CheckCircle2 size={17}/>{tr(lang,'إرسال الإصلاح للتأكيد','Submit repair for confirmation')}</Button>}
          {reporter&&ticket.status==='awaiting_confirmation'&&<><p>{tr(lang,'هل تم إصلاح المشكلة بنجاح؟','Was the issue fixed successfully?')}</p><Button onClick={()=>act('confirm')} disabled={action.isPending}><Check size={17}/>{tr(lang,'نعم، تم الإصلاح','Yes, it is fixed')}</Button><Button kind="outline" onClick={()=>act('reject',{note})} disabled={action.isPending}>{tr(lang,'لا، ما زالت المشكلة قائمة','No, it is still happening')}</Button><label className="field-label">{tr(lang,'ملاحظة للفني','Note for technician')}<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}/></label></>}
         {manager&&ticket.status!=='closed'&&ticket.status!=='cancelled'&&<><p>{ticket.technicianName?tr(lang,`مسند إلى ${ticket.technicianName}`,`Assigned to ${ticket.technicianName}`):tr(lang,'البلاغ بانتظار الإسناد.','This ticket is awaiting assignment.')} {tr(lang,'يمكن تغيير المسؤول عند الحاجة.','You can change the assignee if needed.')}</p><label className="field-label">{tr(lang,'إعادة الإسناد إلى','Reassign to')}<select value={technicianId} onChange={e=>setTechnicianId(e.target.value)}><option value="">{tr(lang,'اختر فنياً','Choose a technician')}</option>{(technicians||[]).filter(t=>t.active&&t.branchId===ticket.branchId).map(t=><option key={t.id} value={t.id}>{t.name} · {t.specialization}</option>)}</select></label><Button kind="outline" onClick={()=>technicianId&&act('reassign',{technicianId})} disabled={!technicianId||action.isPending}><Users size={16}/>{tr(lang,'تحديث الإسناد','Update assignment')}</Button></>}
         {reporter&&ticket.status==='new'&&<TicketCancellationAction ticketId={ticket.id} ticketNumber={ticket.number} lang={lang}/>}
         {manager&&ticket.status!=='closed'&&ticket.status!=='cancelled'&&<TicketCancellationAction ticketId={ticket.id} ticketNumber={ticket.number} lang={lang} manager/>}
          {ticket.status==='closed'&&<div className="closed-note"><CheckCircle2 size={18}/>{tr(lang,'أُغلق البلاغ بعد تأكيد الإصلاح.','The ticket was closed after repair confirmation.')}</div>}
          <AnimatePresence mode="wait">{(action.isPending||actionFeedback)&&<motion.div className="action-feedback" role="status" aria-live="polite" initial={reduced?false:{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={reduced?{opacity:1}:{opacity:0,y:-3}} transition={{duration:reduced?0:.16}}>{action.isPending?<><LoaderCircle size={15} className="feedback-loader"/>{tr(lang,'جارٍ تحديث سجل البلاغ...','Updating the report record...')}</>:<><CheckCircle2 size={15}/>{actionFeedback}</>}</motion.div>}</AnimatePresence>
         {action.isError&&<p className="inline-error">{tr(lang,'تعذر تنفيذ الخطوة، يرجى المحاولة مجدداً.','Could not complete that step. Please try again.')}</p>}
      </section>
    </aside></div>
  </div>;
}
function TechniciansPage({lang}:{lang:Lang}) {
  const {data:techs,isLoading,isError,refetch}=useListTechnicians();const {data:branches}=useListBranches();const create=useCreateTechnician();const update=useUpdateTechnician();const query=useQueryClient();const [open,setOpen]=useState(false);const [edit,setEdit]=useState<Technician|null>(null);
  const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const data={name:String(f.get('name')),branchId:String(f.get('branchId')),specialization:String(f.get('specialization')),available:f.get('available')==='on'};
    const done=()=>{setOpen(false);setEdit(null);void query.invalidateQueries({queryKey:getListTechniciansQueryKey()});void query.invalidateQueries({queryKey:getListBranchesQueryKey()});void query.invalidateQueries({queryKey:getGetOverviewQueryKey()});};
    edit?update.mutate({technicianId:edit.id,data},{onSuccess:done}):create.mutate({data},{onSuccess:done});};
  const begin=(record:Technician|null)=>{setEdit(record);create.reset();update.reset();setOpen(true);};
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'الفريق الميداني','PEOPLE / FIELD TEAM')} title={tr(lang,'الفنيون','Technicians')} description={tr(lang,'توزيع واضح للمهارات والتوفر في كل فرع.','A clear view of skills and availability by branch.')} action={<Button onClick={()=>begin(null)}><Plus size={17}/>{tr(lang,'إضافة فني','Add technician')}</Button>}/>
     {isLoading?<State title={tr(lang,'جاري تحميل الفريق','Loading team')} loading/>:isError?<State title={tr(lang,'تعذر تحميل الفنيين','Could not load technicians')} retry={()=>void refetch()}/>:!techs?.length?<div className="empty-panel" aria-live="polite"><Users size={26}/><h3>{tr(lang,'لا يوجد فنّيون مسجلون بعد','No technicians added yet')}</h3><p>{tr(lang,'أضف أعضاء فريق الصيانة لتسهيل إسناد البلاغات.','Add maintenance staff to make ticket assignment easier.')}</p><Button onClick={()=>setOpen(true)}><Plus size={17}/>{tr(lang,'إضافة أول فني','Add the first technician')}</Button></div>:<div className="people-grid">{techs.map(t=><article className="person-card" key={t.id}><div className="person-card-head"><Avatar name={t.name} size="lg"/><button className="edit-button" onClick={()=>{setEdit(t);setOpen(true)}} aria-label={`${tr(lang,'تعديل','Edit')} ${t.name}`}><Settings2 size={17}/></button></div><h3>{t.name}</h3><span className="specialization">{t.specialization}</span><div className="person-card-meta"><span><Building2 size={15}/>{t.branchName}</span><span><Activity size={15}/>{t.workload} {tr(lang,'مهام مفتوحة','open tasks')}</span></div><div className="person-card-bottom"><span className={`availability ${t.available&&t.active?'available':'unavailable'}`}><i/>{t.active?(t.available?tr(lang,'متاح','Available'):tr(lang,'غير متاح','Unavailable')):tr(lang,'غير نشط','Inactive')}</span><button onClick={()=>update.mutate({technicianId:t.id,data:{available:!t.available}},{onSuccess:()=>void query.invalidateQueries({queryKey:getListTechniciansQueryKey()})})} className="availability-toggle">{t.available?tr(lang,'تعيين غير متاح','Set unavailable'):tr(lang,'تعيين متاح','Set available')}</button></div></article>)}</div>}
      {open&&<Modal key={edit?.id||'new-technician'} title={edit?tr(lang,'تعديل بيانات الفني','Edit technician'):tr(lang,'إضافة فني','Add technician')} close={()=>{setOpen(false);create.reset();update.reset();}}><form onSubmit={save}><label className="field-label">{tr(lang,'الاسم','Name')}<input name="name" required minLength={2} defaultValue={edit?.name} data-testid="input-technician-name"/></label><label className="field-label">{tr(lang,'الفرع','Branch')}<select name="branchId" required defaultValue={edit?.branchId||''} data-testid="select-technician-branch">{(branches||[]).filter(b=>b.active||b.id===edit?.branchId).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="field-label">{tr(lang,'التخصص','Specialization')}<input name="specialization" required defaultValue={edit?.specialization} placeholder={tr(lang,'تكييف، كهرباء، سباكة','HVAC, electrical, plumbing')} data-testid="input-technician-specialization"/></label><label className="check-field"><input type="checkbox" name="available" defaultChecked={edit?.available??true}/> {tr(lang,'متاح لاستقبال المهام','Available for assignments')}</label>{(create.isError||update.isError)&&<p className="inline-error" role="alert">{tr(lang,'تعذر حفظ بيانات الفني. تحقق من المدخلات ثم حاول مجدداً.','Could not save technician details. Check the form and try again.')}</p>}<div className="form-actions"><Button type="submit" disabled={create.isPending||update.isPending} data-testid="button-save-technician">{create.isPending||update.isPending?tr(lang,'جارٍ الحفظ…','Saving…'):edit?tr(lang,'حفظ التعديلات','Save changes'):tr(lang,'إضافة الفني','Add technician')}</Button><Button kind="ghost" onClick={()=>setOpen(false)}>{tr(lang,'إلغاء','Cancel')}</Button></div></form></Modal>}
  </div>;
}
function BranchesPage({lang}:{lang:Lang}) {
  const {data:branches,isLoading,isError,refetch}=useListBranches();const {data:techs}=useListTechnicians();const create=useCreateBranch();const update=useUpdateBranch();const query=useQueryClient();
  const [modal,setModal]=useState(false);const [editing,setEditing]=useState<Branch|null>(null);const [deactivating,setDeactivating]=useState<Branch|null>(null);const [coordinateError,setCoordinateError]=useState('');
  const invalidate=()=>{void query.invalidateQueries({queryKey:getListBranchesQueryKey()});void query.invalidateQueries({queryKey:getListTechniciansQueryKey()});void query.invalidateQueries({queryKey:getListTicketsQueryKey()});void query.invalidateQueries({queryKey:getGetOverviewQueryKey()});};
  const begin=(record:Branch|null)=>{setEditing(record);setCoordinateError('');create.reset();update.reset();setModal(true);};
  const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const latitudeText=String(f.get('latitude')||'').trim();const longitudeText=String(f.get('longitude')||'').trim();if((latitudeText==='')!==(longitudeText==='')){setCoordinateError(tr(lang,'أدخل خط العرض وخط الطول معاً، أو اتركهما فارغين.','Enter both latitude and longitude, or leave both blank.'));return;}setCoordinateError('');const readCoord=(key:'latitude'|'longitude')=>{const raw=String(f.get(key)||'').trim();return raw===''?null:Number(raw);};
    const data:BranchInput={name:String(f.get('name')).trim(),city:String(f.get('city')).trim(),address:String(f.get('address')||'').trim(),latitude:readCoord('latitude'),longitude:readCoord('longitude'),active:f.get('active')==='on'};
    const done=()=>{setModal(false);setEditing(null);create.reset();update.reset();invalidate();};
    if(editing)update.mutate({branchId:editing.id,data:data as BranchUpdate},{onSuccess:done});else create.mutate({data},{onSuccess:done});};
  const toggleActive=(branch:Branch,active:boolean)=>update.mutate({branchId:branch.id,data:{active}},{onSuccess:()=>{setDeactivating(null);invalidate();}});
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'المواقع والفروع','LOCATIONS / NETWORK')} title={tr(lang,'الفروع','Branches')} description={tr(lang,'سجل الفروع وحجم الصيانة والفريق النشط في كل موقع.','Branch records, open maintenance, and active field staff at each location.')} action={<Button onClick={()=>begin(null)} data-testid="button-add-branch"><Plus size={17}/>{tr(lang,'إضافة فرع','Add branch')}</Button>}/>
     {isLoading?<State title={tr(lang,'جاري تحميل الفروع','Loading branches')} loading/>:isError?<State title={tr(lang,'تعذر تحميل الفروع','Could not load branches')} retry={()=>void refetch()}/>:!branches?.length?<div className="empty-panel" aria-live="polite"><Building2 size={25}/><h3>{tr(lang,'لا توجد فروع مسجلة بعد','No branches added yet')}</h3><p>{tr(lang,'أضف أول فرع لبدء تنظيم سجل الصيانة.','Add a branch to organize its maintenance record.')}</p><Button onClick={()=>begin(null)}><Plus size={17}/>{tr(lang,'إضافة فرع','Add branch')}</Button></div>:<div className="branches-grid">{branches.map((b,index)=>{const activeTechs=(techs||[]).filter(t=>t.branchId===b.id&&t.active).length;const mapUrl=branchMapUrl(b.latitude,b.longitude,b.address,b.city);return <article className={`branch-card ${!b.active?'branch-card-inactive':''}`} key={b.id} data-testid={`card-branch-${b.id}`}>
       <div className="branch-card-top"><span className="branch-emblem"><Building2 size={21}/></span><span className="branch-sequence">{String(index+1).padStart(2,'0')}</span><span className={`availability ${b.active?'available':'unavailable'}`}><i/>{b.active?tr(lang,'نشط','Active'):tr(lang,'غير نشط','Inactive')}</span></div>
       <h2>{b.name}</h2><div className="branch-location"><b>{b.city}</b>{b.address&&<span>{b.address}</span>}</div>
       <div className="branch-stats"><div><strong>{b.openTickets}</strong><span>{tr(lang,'بلاغات مفتوحة','Open tickets')}</span></div><div><strong>{techs?activeTechs:'—'}</strong><span>{tr(lang,'فنيون نشطون','Active technicians')}</span></div></div>
       <div className="branch-card-actions">{mapUrl?<a href={mapUrl} target="_blank" rel="noreferrer" className="branch-map-link" data-testid={`branch-map-${b.id}`}><MapPinned size={16}/>{tr(lang,'عرض الموقع','View location')}<ArrowUpRight size={14}/></a>:<span className="branch-map-link branch-map-unavailable"><MapPin size={16}/>{tr(lang,'أضف عنواناً لعرض الموقع','Add an address for map directions')}</span>}<button type="button" className="edit-button branch-edit" onClick={()=>begin(b)} data-testid={`button-edit-branch-${b.id}`}><Settings2 size={15}/>{tr(lang,'تعديل','Edit')}</button></div>
       <div className="branch-state-action">{b.active?<button type="button" className="branch-deactivate" onClick={()=>setDeactivating(b)} disabled={update.isPending} data-testid={`button-deactivate-branch-${b.id}`}>{tr(lang,'إيقاف الفرع','Deactivate branch')}</button>:<button type="button" className="branch-reactivate" onClick={()=>toggleActive(b,true)} disabled={update.isPending} data-testid={`button-reactivate-branch-${b.id}`}>{tr(lang,'إعادة تفعيل الفرع','Reactivate branch')}</button>}</div>
     </article>})}</div>}
      <ReporterAccessPanel lang={lang} branches={branches||[]}/>
      {update.isError&&!deactivating&&<p className="inline-error branch-action-error" role="alert">{tr(lang,'تعذر تحديث حالة الفرع. حاول مرة أخرى.','Could not update the branch status. Try again.')}</p>}
     {modal&&<Modal key={editing?.id||'new-branch'} title={editing?tr(lang,'تعديل الفرع','Edit branch'):tr(lang,'إضافة فرع','Add branch')} close={()=>{setModal(false);create.reset();update.reset();}} description={tr(lang,'بيانات الفرع وموقعه الجغرافي. لا يتم التحقق من العنوان.','Branch details and coordinates. The address is not verified.')}>
       <form onSubmit={save}><label className="field-label">{tr(lang,'اسم الفرع','Branch name')}<input name="name" required minLength={2} defaultValue={editing?.name||''} data-testid="input-branch-name"/></label><div className="form-two"><label className="field-label">{tr(lang,'المدينة','City')}<input name="city" required minLength={2} defaultValue={editing?.city||''} data-testid="input-branch-city"/></label><label className="field-label">{tr(lang,'العنوان المختصر','Short address')}<input name="address" defaultValue={editing?.address||''} data-testid="input-branch-address"/></label></div>
        <div className="form-two coordinate-fields"><label className="field-label">{tr(lang,'خط العرض','Latitude')}<input name="latitude" type="number" step="any" min="-90" max="90" defaultValue={editing?.latitude??''} placeholder="—" onChange={()=>setCoordinateError('')} data-testid="input-branch-latitude"/></label><label className="field-label">{tr(lang,'خط الطول','Longitude')}<input name="longitude" type="number" step="any" min="-180" max="180" defaultValue={editing?.longitude??''} placeholder="—" onChange={()=>setCoordinateError('')} data-testid="input-branch-longitude"/></label></div><p className="branch-coordinate-note">{tr(lang,'الإحداثيات اختيارية؛ أدخل الإحداثيين معاً. يُستخدم العنوان والمدينة في الخرائط عند تركهما فارغين.','Coordinates are optional; enter both together. Maps uses the address and city when both are blank.')}</p>{coordinateError&&<p className="inline-error" role="alert">{coordinateError}</p>}
       <label className="check-field"><input type="checkbox" name="active" defaultChecked={editing?.active??true} data-testid="checkbox-branch-active"/>{tr(lang,'الفرع نشط','Branch is active')}</label>
       {(create.isError||update.isError)&&<p className="inline-error" role="alert">{tr(lang,'تعذر حفظ الفرع. تحقق من البيانات وحاول مرة أخرى.','Could not save branch. Check the details and try again.')}</p>}
       <div className="form-actions"><Button type="submit" disabled={create.isPending||update.isPending} data-testid="button-save-branch">{create.isPending||update.isPending?tr(lang,'جارٍ الحفظ…','Saving…'):tr(lang,'حفظ الفرع','Save branch')}</Button><Button kind="ghost" onClick={()=>setModal(false)}>{tr(lang,'إلغاء','Cancel')}</Button></div></form></Modal>}
     <AlertDialog open={!!deactivating} onOpenChange={open=>{if(!open)setDeactivating(null);}}><AlertDialogContent className="confirm-dialog"><AlertDialogHeader><AlertDialogTitle>{tr(lang,'تأكيد إيقاف الفرع','Confirm branch deactivation')}</AlertDialogTitle><AlertDialogDescription>{tr(lang,`قد يؤثر إيقاف «${deactivating?.name||''}» في استقبال البلاغات الجديدة والإسناد التلقائي. سيبقى سجل البلاغات الحالي محفوظاً.`,`Deactivating “${deactivating?.name||''}” may affect new tickets and automatic assignment. Existing ticket history will remain.`)}</AlertDialogDescription></AlertDialogHeader>{update.isError&&<p className="inline-error" role="alert">{tr(lang,'تعذر إيقاف الفرع. حاول مرة أخرى.','Could not deactivate the branch. Try again.')}</p>}<AlertDialogFooter><AlertDialogCancel disabled={update.isPending}>{tr(lang,'إلغاء','Cancel')}</AlertDialogCancel><AlertDialogAction className="branch-confirm-action" disabled={update.isPending} onClick={event=>{event.preventDefault();if(deactivating)toggleActive(deactivating,false);}} data-testid="button-confirm-deactivate">{update.isPending?tr(lang,'جارٍ الإيقاف…','Deactivating…'):tr(lang,'تأكيد الإيقاف','Confirm deactivation')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
function KnowledgePage({lang}:{lang:Lang}) {
  const [search,setSearch]=useState('');const [category,setCategory]=useState('');const [branchId,setBranchId]=useState('');
  const {data:branches}=useListBranches();const {data:entries,isLoading,isError,refetch}=useListKnowledge({category:category||undefined,branchId:branchId||undefined});
  const filtered=(entries||[]).filter(k=>`${k.title} ${k.ticketNumber} ${k.branchName} ${k.technicianName}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'الإصلاحات المؤكدة · مرجع الفريق','CONFIRMED REPAIRS / REFERENCE')} title={tr(lang,'قاعدة المعرفة','Knowledge base')} description={tr(lang,'حلول مؤكدة من أعمال الفريق، لتكون الإصلاحات القادمة أسرع.','Confirmed team solutions to make future repairs faster.')}/>
    <div className="knowledge-intro"><span className="knowledge-symbol"><BookOpen size={23}/></span><div><b>{tr(lang,'معرفة من العمل الحقيقي','Knowledge from real work')}</b><p>{tr(lang,'تظهر هنا الإصلاحات بعد تأكيد نجاحها من المبلّغ.','Repairs appear here after the reporter confirms they worked.')}</p></div><span className="knowledge-count">{entries?.length||0}<small>{tr(lang,'حل موثق','documented fixes')}</small></span></div>
     <div className="filter-bar"><label className="search-field"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr(lang,'ابحث في الحلول أو الفروع','Search solutions or branches')}/></label><label className="filter-select"><Filter size={16}/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">{tr(lang,'كل الفئات','All categories')}</option>{Array.from(new Set((entries||[]).map(e=>e.category))).map(c=><option key={c} value={c}>{c}</option>)}</select></label><label className="filter-select"><Building2 size={16}/><select value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">{tr(lang,'كل الفروع','All branches')}</option>{(branches||[]).map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
    {isLoading?<State title={tr(lang,'جاري تحميل المعرفة','Loading knowledge base')} loading/>:isError?<State title={tr(lang,'تعذر تحميل قاعدة المعرفة','Could not load knowledge base')} retry={()=>void refetch()}/>:filtered.length?<div className="knowledge-list">{filtered.map((entry:KnowledgeEntry,i)=><article className="knowledge-entry" key={entry.id}><span className="knowledge-index">{String(i+1).padStart(2,'0')}</span><div className="knowledge-entry-content"><div className="entry-tags"><span>{entry.category}</span><span>{entry.branchName}</span></div><h3>{entry.title}</h3><div className="entry-solution">{entry.cause&&<p><b>{tr(lang,'السبب','Cause')}</b>{entry.cause}</p>}{entry.resolution&&<p><b>{tr(lang,'الإجراء','Action taken')}</b>{entry.resolution}</p>}</div><div className="entry-foot"><span><UserRound size={14}/>{entry.technicianName}</span><span>{dateText(entry.createdAt,lang)}</span><Link href={`/workspace/tickets/${entry.ticketId}`}>{tr(lang,'البلاغ','Ticket')} {entry.ticketNumber}<ArrowUpRight size={14}/></Link></div></div><CheckCircle2 className="knowledge-check" size={20}/></article>)}</div>:<div className="empty-panel" aria-live="polite"><BookOpen size={25}/><h3>{entries?.length?tr(lang,'لا توجد نتائج مطابقة','No matching results'):tr(lang,'لا توجد حلول مؤكدة بعد','No confirmed fixes yet')}</h3><p>{tr(lang,'تُضاف الحلول تلقائياً عند تأكيد إغلاق البلاغ.','Solutions are added when a reporter confirms a repair.')}</p></div>}
  </div>;
}
function Modal({title,children,close,description}:{title:string;children:ReactNode;close:()=>void;description?:string}) {
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="modal-card modal-radix"><DialogHeader className="modal-head"><DialogTitle>{title}</DialogTitle>{description&&<DialogDescription>{description}</DialogDescription>}</DialogHeader>{children}</DialogContent></Dialog>;
}
function WorkspaceRouter({lang,setLang,dark,setDark}:{lang:Lang;setLang:(x:Lang)=>void;dark:boolean;setDark:(x:boolean)=>void}) {
  const {data:session}=useGetDemoSession();const user=session?.user;
  const branchQuery=useListReporterBranches({query:{enabled:user?.role==='reporter',queryKey:getListReporterBranchesQueryKey()}});
  const reporterBranches=user?.role==='reporter'?(branchQuery.data||[]):[];
  const [selectedBranchId,setSelectedBranchId]=useState('');
  const allowedBranchKey=reporterBranches.map(branch=>branch.id).join('|');
  useEffect(()=>{
    if(!user||user.role!=='reporter'){setSelectedBranchId('');return;}
    let stored='';
    try{stored=localStorage.getItem(`tadaruk:selected-branch:${user.id}`)||'';}catch{}
    const preferred=reporterBranches.find(branch=>branch.id===stored)?.id
      ||reporterBranches.find(branch=>branch.id===user.branchId)?.id
      ||reporterBranches[0]?.id
      ||'';
    setSelectedBranchId(preferred);
  },[user?.id,user?.branchId,allowedBranchKey]);
  const selectBranch=(branchId:string)=>{
    if(!reporterBranches.some(branch=>branch.id===branchId))return;
    setSelectedBranchId(branchId);
    if(user?.role==='reporter'){try{localStorage.setItem(`tadaruk:selected-branch:${user.id}`,branchId);}catch{}}
  };
  const branchStatus=branchQuery.isError?'error':branchQuery.isSuccess?'success':'loading';
  return <ReporterBranchContext.Provider value={{branches:reporterBranches,selectedBranchId,selectBranch,status:branchStatus}}><Switch>
    <Route path="/workspace"><WorkspaceShell title={tr(lang,'نظرة عامة','Overview')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?user.role==='reporter'?<ReporterHomePage lang={lang} user={user}/>:<OverviewPage lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</WorkspaceShell></Route>
    <Route path="/workspace/tickets/new"><WorkspaceShell title={tr(lang,'بلاغ جديد','New report')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?.role==='reporter'?<ReporterNewTicketPage lang={lang} user={user} selectedBranchId={selectedBranchId}/>:user?<State title={tr(lang,'إنشاء البلاغات متاح للمبلّغ فقط','Only reporters can create tickets')}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</WorkspaceShell></Route>
    <Route path="/workspace/tickets/:ticketId"><WorkspaceShell title={tr(lang,'تفاصيل البلاغ','Ticket details')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?<TicketDetail lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</WorkspaceShell></Route>
    <Route path="/workspace/tickets"><WorkspaceShell title={tr(lang,'البلاغات','Tickets')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?user.role==='reporter'?<ReporterTicketsPage lang={lang} user={user}/>:<TicketsPage lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</WorkspaceShell></Route>
    <Route path="/workspace/technicians"><WorkspaceShell title={tr(lang,'الفنيون','Technicians')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?.role==='manager'?<TechniciansPage lang={lang}/>:<State title={tr(lang,'هذه الصفحة متاحة لمدير العمليات فقط','This page is for operations managers only')}/>}</WorkspaceShell></Route>
    <Route path="/workspace/branches"><WorkspaceShell title={tr(lang,'الفروع','Branches')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?.role==='manager'?<BranchesPage lang={lang}/>:<State title={tr(lang,'هذه الصفحة متاحة لمدير العمليات فقط','This page is for operations managers only')}/>}</WorkspaceShell></Route>
    <Route path="/workspace/knowledge"><WorkspaceShell title={tr(lang,'قاعدة المعرفة','Knowledge base')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?.role==='manager'?<KnowledgePage lang={lang}/>:<State title={tr(lang,'هذه الصفحة متاحة لمدير العمليات فقط','This page is for operations managers only')}/>}</WorkspaceShell></Route>
    <Route component={NotFound}/>
  </Switch></ReporterBranchContext.Provider>;
}
function AppRoutes() {
  const prefs=usePrefs();
  return <Switch><Route path="/"><Landing lang={prefs.lang} setLang={prefs.setLang} dark={prefs.dark} setDark={prefs.setDark}/></Route><Route path="/demo"><DemoPage lang={prefs.lang} dark={prefs.dark} setDark={prefs.setDark}/></Route><Route path="/workspace/*"><WorkspaceRouter {...prefs}/></Route><Route path="/workspace"><WorkspaceRouter {...prefs}/></Route><Route component={NotFound}/></Switch>;
}
function App() { return <QueryClientProvider client={qc}><AppRoutes/></QueryClientProvider>; }
export default App;
