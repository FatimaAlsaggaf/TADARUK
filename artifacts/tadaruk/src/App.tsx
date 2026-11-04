import { type ReactNode, type FormEvent, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation, useParams } from 'wouter';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import BlurText from '@/components/BlurText';
import SpotlightCard from '@/components/SpotlightCard';
import FolderFloat from '@/components/FolderFloat';
import PhotoAttachmentCard from '@/components/PhotoAttachmentCard';
import { FieldMessage } from '@/components/FieldMessage';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Building2, Check,
  CheckCircle2, ChevronDown, ClipboardList, Clock3, Filter, Languages, LayoutDashboard,
  MapPin, Menu, Phone, Plus, Search, Settings2, ShieldCheck, Users, Wrench, X, CircleAlert,
  LogOut, UserRound, RotateCcw, Repeat2, ChevronLeft, LoaderCircle, MapPinned,
  Mic, Square
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TadarukSelect } from '@/components/TadarukSelect';
import {
  useHealthCheck, useListDemoUsers, useGetDemoSession, useSelectDemoAccount, useClearDemoSession, useGetOverview,
  useListTickets, useGetTicket, usePerformTicketAction,
  useListBranches, useCreateBranch, useUpdateBranch, useListTechnicians, useCreateTechnician,
  useUpdateTechnician, useListKnowledge, useListReporterBranches, getListReporterBranchesQueryKey,
  getGetDemoSessionQueryKey, getGetOverviewQueryKey,
  getListTicketsQueryKey, getGetTicketQueryKey, getListBranchesQueryKey, getListTechniciansQueryKey,
  getListKnowledgeQueryKey,
  type DemoUser, type Ticket,
  type Branch, type BranchInput, type BranchUpdate, type Technician, type KnowledgeEntry, type ReporterBranch,
  FALLBACK_BRANCHES, FALLBACK_TECHNICIANS, FALLBACK_KNOWLEDGE, FALLBACK_INITIAL_TICKETS, FALLBACK_REPORTER_BRANCHES
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import { ReporterHomePage, ReporterNewTicketPage, ReporterTicketsPage } from '@/ReporterWorkspace';
import ReporterAccessPanel from '@/ReporterAccessPanel';
import { TicketCancellationAction } from '@/components/TicketCancellationAction';
import SunMoonThemeToggle from '@/components/ui/sun-moon-theme-toggle';
import './tadaruk.css';
import './tadaruk-interactions.css';
import './technician-contact.css';

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
const roleSummary = (role: string | undefined, lang: Lang) => {
  const summaries: Record<string, [string, string]> = {
    manager: ['إدارة الفروع ومتابعة سير العمل', 'Oversee branches and daily operations'],
    reporter: ['تسجيل البلاغات ومتابعة حالتها', 'Create reports and track their status'],
    technician: ['استلام المهام وتحديث تقدم الإصلاح', 'Handle tasks and update repair progress']
  };
  return summaries[role || '']?.[lang === 'ar' ? 0 : 1] || '';
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
const isGoogleMapsShareUrl = (value:string|null|undefined):value is string => {
  if(!value)return false;
  try{
    const url=new URL(value);
    const host=url.hostname.toLowerCase();
    if(url.protocol!=='https:')return false;
    if(host==='maps.app.goo.gl'||host==='maps.google.com')return true;
    if(host==='goo.gl')return url.pathname.startsWith('/maps');
    return (host==='google.com'||host==='www.google.com')&&url.pathname.startsWith('/maps');
  }catch{return false;}
};
const googleMapsSearchUrl = (city:string,address:string) => {
  const query=[address.trim(),city.trim()].filter(Boolean).join(', ');
  return query?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`:'https://www.google.com/maps/';
};
const OTHER_CITY='__other_city__';
const branchMapUrl = (latitude:number|null|undefined,longitude:number|null|undefined,address:string,city='',googleMapsUrl?:string|null) => {
  if(isGoogleMapsShareUrl(googleMapsUrl))return googleMapsUrl;
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
  const [folderOpen,setFolderOpen]=useState(true);
  const [impactRevealed,setImpactRevealed]=useState(false);
  const roadmapRef=useRef<HTMLElement|null>(null);
  const impactRef=useRef<HTMLElement|null>(null);
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
        timers=[
          window.setTimeout(()=>setRoadmapProgress(1),1000),
          window.setTimeout(()=>setRoadmapProgress(2),2000),
          window.setTimeout(()=>setRoadmapProgress(3),3000)
        ];
        observer.disconnect();
      }
    },{threshold:.25});
    observer.observe(section);
    return ()=>{
      observer.disconnect();
      timers.forEach(window.clearTimeout);
    };
  },[reduced]);
  useEffect(()=>{
    const section=impactRef.current;
    if(!section)return;
    let closeTimer:number|null=null;
    const observer=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){
        setImpactRevealed(true);
        closeTimer=window.setTimeout(()=>{
          setFolderOpen(false);
        },2300);
        observer.disconnect();
      }
    },{threshold:.2});
    observer.observe(section);
    return ()=>{
      observer.disconnect();
      if(closeTimer)window.clearTimeout(closeTimer);
    };
  },[]);
  const goToSection=(id:string)=>{
    setMobileOpen(false);
    const target=document.getElementById(id);
    if(target){
      setDividerPulse(pulse=>pulse+1);
      window.scrollTo({top:target.getBoundingClientRect().top+window.scrollY-86,behavior:reduced?'auto':'smooth'});
    }
  };
  const labels=lang==='ar'?['بلاغ جديد','تحليل ذكي','إسناد للفني','تم الإصلاح']:['New report','Smart analysis','Technician assigned','Repair confirmed'];
  const desktopRoadmapPath=lang==='ar'
    ?'M 700 130 C 600 130, 600 50, 500 50 C 405 50, 405 135, 310 135 C 210 135, 210 75, 110 75'
    :'M 110 75 C 210 75, 210 135, 310 135 C 405 135, 405 50, 500 50 C 600 50, 600 130, 700 130';
  const mobileRoadmapPath='M 40 48 L 40 472';
  const tadarukDemoReports = lang === 'ar' ? [
    { label: 'مكيف الفرع يقطر موية فوق الطاولات', value: 'ac-leak', time: '10:42 ص', branch: 'فرع العليا' },
    { label: 'تسريب ماء قوي تحت المغاسل', value: 'water-leak', time: '11:15 ص', branch: 'فرع النخيل' },
    { label: 'عطل لوحة الكهرباء الرئيسية', value: 'power-fault', time: '01:30 م', branch: 'فرع التخصصي' },
    { label: 'قفل باب المستودع الخلفي معلق', value: 'door-lock', time: '02:05 م', branch: 'فرع الصحافة' },
    { label: 'ثلاجة المشروبات باردة ما تشتغل', value: 'fridge-cooling', time: '03:20 م', branch: 'فرع الملقا' },
  ] : [
    { label: 'Branch AC leaking onto dining tables', value: 'ac-leak', time: '10:42 AM', branch: 'Olaya' },
    { label: 'Water pipe leaking under wash sinks', value: 'water-leak', time: '11:15 AM', branch: 'Nakheel' },
    { label: 'Main power circuit breaker tripping', value: 'power-fault', time: '01:30 PM', branch: 'Takhassusi' },
    { label: 'Storage back door lock jammed', value: 'door-lock', time: '02:05 PM', branch: 'Sahafa' },
    { label: 'Display cooler fridge stopped cooling', value: 'fridge-cooling', time: '03:20 PM', branch: 'Malqa' },
  ];
  const impactPillars = lang === 'ar' ? [
    {
      title: 'توثيق فوري وشامل',
      copy: 'سجل موحد لكل عطل برقم وتاريخ وموقع وتفاصيل واضحة تمنع فقدان أي بلاغ.',
      icon: ClipboardList
    },
    {
      title: 'مسؤولية وإسناد مباشر',
      copy: 'إسناد لحظي للفني المختص مع تحديد وقت الاستجابة لضمان أعلى مستويات الالتزام.',
      icon: Users
    },
    {
      title: 'متابعة لحظية شفافة',
      copy: 'لوحة تحكم تفاعلية توضح مسار البلاغ بدقة من لحظة التسجيل حتى إتمام الإصلاح.',
      icon: Activity
    },
    {
      title: 'معرفة تشغيلية تراكمية',
      copy: 'أرشيف ذكي يربط كل عطل بحله وتكلفته لمنع تكرار الأعطال ورفع الكفاءة.',
      icon: BookOpen
    }
  ] : [
    {
      title: 'Instant Structured Logging',
      copy: 'A unified record for every ticket with number, timestamp, location, and photos.',
      icon: ClipboardList
    },
    {
      title: 'Direct Ownership & SLAs',
      copy: 'Immediate assignment to the specialist technician with clear response tracking.',
      icon: Users
    },
    {
      title: 'Real-Time Visibility',
      copy: 'An interactive dashboard showing live progress from submission to resolution.',
      icon: Activity
    },
    {
      title: 'Cumulative Operational Knowledge',
      copy: 'Smart archives linking issues to fixes and costs to prevent recurring faults.',
      icon: BookOpen
    }
  ];
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
      <div className="hero-brand-glow" aria-hidden="true"/>
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
        <svg className="roadmap-path roadmap-path-desktop" viewBox="0 0 820 200" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="roadmap-gradient" x1={lang==='ar'?'1':'0'} y1="0" x2={lang==='ar'?'0':'1'} y2="0">
              <stop offset="0" stopColor={dark?'#6f8ba3':'#1e3263'}/>
              <stop offset=".45" stopColor={dark?'#75aeb4':'#4d9aa8'}/>
              <stop offset="1" stopColor={dark?'#71d0c9':'#56c9c4'}/>
            </linearGradient>
          </defs>
          <path className="roadmap-track-base" d={desktopRoadmapPath} />
          <motion.path
            className="roadmap-track"
            d={desktopRoadmapPath}
            pathLength="1"
            initial={{pathLength:reduced?1:0}}
            animate={{pathLength:roadmapProgress>=0?1:0}}
            transition={reduced?{duration:0}:{duration:3.0,ease:[.35,0,.25,1]}}
          />
          <motion.path
            className="roadmap-glint"
            d={desktopRoadmapPath}
            pathLength="1"
            initial={{pathLength:0,pathOffset:0,opacity:0}}
            animate={roadmapProgress>=0&&!reduced?{pathLength:[0,.16,.16,0],pathOffset:[0,0,.84,1],opacity:[0,1,1,0]}:{pathLength:0,opacity:0}}
            transition={reduced?{duration:0}:{duration:3.0,ease:[.35,0,.25,1]}}
          />
        </svg>
        <svg className="roadmap-path roadmap-path-mobile" viewBox="0 0 80 520" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="roadmap-gradient-mobile" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={dark?'#6f8ba3':'#1e3263'}/>
              <stop offset=".52" stopColor={dark?'#75aeb4':'#4d9aa8'}/>
              <stop offset="1" stopColor={dark?'#71d0c9':'#56c9c4'}/>
            </linearGradient>
          </defs>
          <path className="roadmap-track-base" d={mobileRoadmapPath} />
          <motion.path
            className="roadmap-track"
            d={mobileRoadmapPath}
            pathLength="1"
            initial={{pathLength:reduced?1:0}}
            animate={{pathLength:roadmapProgress>=0?1:0}}
            transition={reduced?{duration:0}:{duration:3.0,ease:[.35,0,.25,1]}}
          />
          <motion.path
            className="roadmap-glint"
            d={mobileRoadmapPath}
            pathLength="1"
            initial={{pathLength:0,pathOffset:0,opacity:0}}
            animate={roadmapProgress>=0&&!reduced?{pathLength:[0,.16,.16,0],pathOffset:[0,0,.84,1],opacity:[0,1,1,0]}:{pathLength:0,opacity:0}}
            transition={reduced?{duration:0}:{duration:3.0,ease:[.35,0,.25,1]}}
          />
        </svg>
        <div className="workflow-steps">{labels.map((label,index)=>{
          const StepIcon=[ClipboardList,Activity,Wrench,CheckCircle2][index];
          const isReached=roadmapProgress>=index;
          const isCurrent=roadmapProgress===index;
          const isFinal=index===3;
          return <motion.div
            className={`workflow-step ${isReached?'is-reached':''} ${isCurrent?'is-current':''} ${isFinal&&isReached?'is-success':''}`}
            key={label}
            initial={reduced?false:{opacity:0,y:12}}
            animate={roadmapProgress>=0?{opacity:1,y:0}:{opacity:0,y:12}}
            transition={reduced?{duration:0}:{duration:.45,delay:index*.13,ease:[.22,.72,.18,1]}}
          >
            <span className="workflow-node">
              <StepIcon size={23} strokeWidth={isFinal&&isReached?2.2:1.7}/>
            </span>
            <span className="workflow-index">0{index+1}</span>
            <span className="workflow-label">{label}</span>
          </motion.div>;
        })}</div>
      </div>
    </section>
    <section className="landing-impact wrap" id="impact" ref={impactRef} aria-labelledby="impact-title">
      <div className="impact-heading">
        <motion.div initial={reduced?false:{opacity:0,y:14}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.4}} transition={reduced?{duration:0}:{duration:.5,ease:[.22,.72,.18,1]}}>
          <span className="eyebrow">{tr(lang,'منظومة صيانة متكاملة','INTEGRATED OPERATIONS SYSTEM')}</span>
          <h2 id="impact-title" className={lang==='ar'?'display-ar':''}>{tr(lang,'أثر تدارك على عملياتك','Tadaruk’s impact on operations')}</h2>
        </motion.div>
      </div>

      <div className="impact-showcase-stage">
        <div className="impact-folder-showcase">
          <FolderFloat
            items={tadarukDemoReports}
            label={tr(lang,'ملف بلاغات تدارك','TADARUK Tickets Folder')}
            sublabel={tr(lang,'٥ بلاغات مسجلة وموثقة','5 documented tickets')}
            open={folderOpen}
            onOpenChange={setFolderOpen}
            trigger="click"
          />
        </div>

        <div className="impact-pillars-list">
          {impactPillars.map((item,index)=>{
            const Icon=item.icon;
            return <motion.article
              className={`impact-pillar-card impact-pillar-${index+1}`}
              key={item.title}
              initial={reduced?false:{opacity:0,x:lang==='ar'?-24:24,y:10}}
              animate={impactRevealed?{opacity:1,x:0,y:0}:(reduced?{opacity:1}:{opacity:0,x:lang==='ar'?-24:24,y:10})}
              transition={reduced?{duration:0}:{duration:.48,delay:index*.45,ease:[.22,.72,.18,1]}}
            >
              <div className="impact-pillar-head">
                <span className="impact-pillar-index">0{index+1}</span>
                <span className="impact-pillar-icon"><Icon size={20} strokeWidth={2}/></span>
                <h3 className="impact-pillar-title">{item.title}</h3>
              </div>
              <p className="impact-pillar-copy">{item.copy}</p>
            </motion.article>;
          })}
        </div>
      </div>
    </section>
    <section className="landing-end wrap" id="final">
      <div><span className="eyebrow"><span className="live-dot"/>{health.isLoading?tr(lang,'جارٍ الاتصال','CONNECTING'):health.isError?tr(lang,'العرض متاح','DEMO AVAILABLE'):tr(lang,'من البلاغ إلى الإصلاح','REPORT TO REPAIR')}</span><h2 className={lang==='ar'?'display-ar':''}>{tr(lang,'جاهز تبدأ مع تدارك؟','Ready to start with Tadaruk?')}</h2><p>{tr(lang,'من أول بلاغ إلى آخر خطوة، كل شيء أوضح.','From the first report to the final step, everything is clearer.')}</p></div>
      <Button href="/demo">{tr(lang,'استكشف تدارك','Explore Tadaruk')}<ArrowLeft size={17}/></Button>
    </section>
    <footer className="landing-footer wrap">
      <div className="footer-brand"><Brand darkMode={dark}/><p>{tr(lang,'منصة عربية تجمع بلاغات الصيانة ومسؤوليتها وتقدمها في سجل واضح.','An Arabic-first platform keeping maintenance reports, ownership and progress in one clear record.')}</p></div>
      <div className="footer-meta"><span>© {new Date().getFullYear()} TADARUK</span></div>
    </footer>
  </main>;
}
const DEFAULT_DEMO_USERS: DemoUser[] = [
  { id: 'demo-reporter', name: 'سارة القحطاني', role: 'reporter', initials: 'سق', branchId: 'branch-olaya', branchName: 'فرع العليا', specialization: null },
  { id: 'demo-manager', name: 'فهد السليمان', role: 'manager', initials: 'فس', branchId: null, branchName: null, specialization: null },
  { id: 'demo-tech', name: 'خالد الحربي', role: 'technician', initials: 'خح', branchId: 'branch-olaya', branchName: 'فرع العليا', specialization: 'plumbing' }
];

function DemoPage({lang,setLang,dark,setDark}:{lang:Lang;setLang:(lang:Lang)=>void;dark:boolean;setDark:(dark:boolean)=>void}) {
  const qc=useQueryClient();
  const {data:users,isLoading,isError,refetch}=useListDemoUsers();
  const select=useSelectDemoAccount(); const [,go]=useLocation();
  const rawList = Array.isArray(users) && users.length ? users : DEFAULT_DEMO_USERS;
  const enter=(userId:string)=>{
    const selected = rawList.find(u => u.id === userId) || rawList[0];
    try {
      localStorage.setItem('tadaruk-demo-session-user', JSON.stringify(selected));
    } catch {}
    select.mutate({data:{userId}},{
      onSuccess:()=>{void qc.invalidateQueries({queryKey:getGetDemoSessionQueryKey()});go('/workspace');},
      onError:()=>{go('/workspace');}
    });
  };
  const BackIcon=lang==='ar'?ArrowRight:ArrowLeft;
  const EnterIcon=lang==='ar'?ArrowLeft:ArrowRight;
  return <main className="demo-page" dir={lang==='ar'?'rtl':'ltr'}>
    <header className="demo-top">
      <Link href="/" className="demo-brand" aria-label={tr(lang,'العودة إلى تدارك','Back to Tadaruk')} data-testid="link-demo-brand"><Brand darkMode={dark}/></Link>
      <div className="demo-actions">
        <Link href="/" className="demo-back-link" data-testid="link-demo-home"><BackIcon size={16}/><span>{tr(lang,'الرئيسية','Home')}</span></Link>
        <button className="nav-lang" type="button" onClick={()=>setLang(lang==='ar'?'en':'ar')} aria-label={tr(lang,'التبديل إلى الإنجليزية','Switch to Arabic')} data-testid="button-demo-language"><Languages size={16}/><span>{lang==='ar'?'English':'العربية'}</span></button>
        <SunMoonThemeToggle className="demo-theme-toggle" theme={dark?'dark':'light'} onThemeChange={theme=>setDark(theme==='dark')} aria-label={dark?tr(lang,'تفعيل الوضع الفاتح','Switch to light mode'):tr(lang,'تفعيل الوضع الداكن','Switch to dark mode')} data-testid="theme-toggle-demo" size={40} duration={860}/>
      </div>
    </header>
    <section className="demo-content fade-up">
      <h1 className={lang==='ar'?'display-ar':''}>{tr(lang,'اختر نقطة البداية','Choose your point of view')}</h1>
      <p>{tr(lang,'ثلاثة أدوار، وسجل واحد يتابع البلاغ حتى إغلاقه.','Three roles, one record that follows a repair to closure.')}</p>
      {isLoading
        ? <div className="role-grid"><div className="skeleton-card"/><div className="skeleton-card"/><div className="skeleton-card"/></div>
        : <div className="role-grid">{rawList.map(user=>{
            const RoleIcon=user.role==='manager'?Building2:user.role==='technician'?Wrench:ClipboardList;
            const branch=[user.branchName || tr(lang,'جميع الفروع','All branches'),user.specialization].filter(Boolean).join(' · ');
            return <SpotlightCard className="role-card-spotlight" key={user.id} theme={dark?'dark':'light'} spotlightColor="rgba(86, 244, 239, .88)" intensity={.16} borderGlow={.24} softness={.9} spotlightSize={240} proximity={72} smoothing={.4} flare={false}>
              <button type="button" className={`role-card role-${user.role}`} onClick={()=>enter(user.id)} disabled={select.isPending} aria-busy={select.isPending} data-testid={`select-role-${user.role}`}>
                <span className="role-card-top">
                  <span className={`role-title role-badge role-badge-${user.role}`}>{roleText(user.role,lang)}</span>
                  <span className={`role-icon role-icon-${user.role}`} aria-hidden="true"><RoleIcon size={22} strokeWidth={1.8}/></span>
                </span>
                <span className="role-card-user">
                  <b data-testid={`text-role-name-${user.id}`}>{user.name}</b>
                  <span className="role-summary">{roleSummary(user.role,lang)}</span>
                  <small>{branch}</small>
                </span>
                <span className="role-cta"><span>{select.isPending?tr(lang,'جارٍ الدخول…','Entering…'):tr(lang,'الدخول بهذا الحساب','Enter as this user')}</span><EnterIcon size={16}/></span>
              </button>
            </SpotlightCard>;
          })}</div>}
      {select.isError&&<p className="inline-error" role="alert">{tr(lang,'لم نتمكن من فتح الحساب. حاول مرة أخرى.','Could not open this account. Please try again.')}</p>}
    </section>
  </main>;
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
  const defaultUser: DemoUser = { id: 'demo-reporter', name: 'سارة القحطاني', role: 'reporter', initials: 'سق', branchId: 'branch-olaya', branchName: 'فرع العليا', specialization: null };
  const user=session?.user || (typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem('tadaruk-demo-session-user') || 'null'); } catch { return null; } })() : null) || defaultUser; const [location,go]=useLocation(); const [menu,setMenu]=useState(false); const [mobile,setMobile]=useState(false);
  const branchContext=useContext(ReporterBranchContext);
  const qc=useQueryClient();const logout=useClearDemoSession();
  const reduced=useReducedMotion()===true || (typeof window!=='undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  useEffect(()=>{if(session && !user && window.location.pathname.startsWith('/workspace'))go('/demo');},[session,user,go]);
  if(!user)return <div className="workspace-loading"><div className="skeleton-bar"/><div className="skeleton-card"/></div>;
  const links=user.role==='manager'
    ?[['/workspace','نظرة عامة','Overview',LayoutDashboard],['/workspace/tickets','البلاغات','Tickets',ClipboardList],['/workspace/technicians','الفنيون','Technicians',Users],['/workspace/branches','الفروع','Branches',Building2],['/workspace/knowledge','قاعدة المعرفة','Knowledge',BookOpen]]
    :user.role==='technician'
      ?[['/workspace','مهامي','My tasks',Wrench],['/workspace/tickets','كل المهام','Tasks',ClipboardList]]
      :[['/workspace','الرئيسية','Home',LayoutDashboard],['/workspace/tickets/new','بلاغ جديد','New report',Plus],['/workspace/tickets','بلاغاتي','My reports',ClipboardList]];
  const signOut=()=>logout.mutate(undefined,{onSuccess:()=>{qc.clear();setMenu(false);setMobile(false);go('/demo');}});
  const matchingLink=links.map(([path])=>path as string)
    .filter(path=>path==='/workspace'?location===path:location===path||location.startsWith(`${path}/`))
    .sort((left,right)=>right.length-left.length)[0];
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
        ?<div className="branch-switch branch-switch-multi" data-testid="field-sidebar-branch"><span className="branch-icon"><Building2 size={16}/></span><span className="branch-switch-copy"><small>{tr(lang,'الموقع الحالي','CURRENT LOCATION')}</small><TadarukSelect value={branchContext?.selectedBranchId||selectedBranch?.id||''} onValueChange={value=>branchContext?.selectBranch(value)} ariaLabel={tr(lang,'اختيار الفرع المصرح به','Choose an authorized branch')} dir={lang==='ar'?'rtl':'ltr'} testId="select-sidebar-branch" options={reporterBranches.map(branch=>({value:branch.id,label:branch.name}))}/></span></div>
        :<div className="branch-switch" data-testid={user.role==='reporter'?'text-sidebar-branch':'branch-indicator'}><span className="branch-icon"><Building2 size={16}/></span><span><small>{tr(lang,'الموقع الحالي','CURRENT LOCATION')}</small><b>{user.role==='reporter'?branchLabel:user.branchName||tr(lang,'جميع الفروع','All branches')}</b></span></div>}
      <nav className="side-nav">{links.map(([path,ar,en,Icon])=>{
        const selected=matchingLink===path;
        return <Link key={path as string} href={path as string} onClick={()=>setMobile(false)} className={`side-link ${selected?'selected':''}`} aria-current={selected?'page':undefined} data-testid={`nav-${(path as string).replaceAll('/','-').replace(/^-/, 'root')}`}>
          {selected&&<motion.span className="nav-shared-indicator" layoutId="workspace-nav-indicator" transition={reduced?{duration:0}:{duration:.3,ease:[.22,.72,.18,1]}}><span className="nav-active-mark"/></motion.span>}
          <motion.span
            className="side-link-icon"
            aria-hidden="true"
            whileTap={reduced?undefined:{scale:.92,y:1}}
            animate={selected&&!reduced?{scale:[1,1.08,1],y:[0,-1,0]}:{scale:1,y:0}}
            transition={{duration:reduced?0:.32,ease:[.22,.72,.18,1]}}
          ><Icon size={19}/></motion.span>
          <span>{tr(lang,ar as string,en as string)}</span>
        </Link>;
      })}</nav>
      <div className="side-bottom"><div className="side-user">
        <button className="side-user-trigger" onClick={()=>setMenu(!menu)} aria-label={tr(lang,'خيارات الملف الشخصي','Profile options')} aria-expanded={menu} aria-controls="account-menu"><Avatar name={user.name}/><span><b>{user.name}</b><small>{roleText(user.role,lang)}</small></span><ChevronDown size={16}/></button>
        <AnimatePresence>{menu&&<motion.nav id="account-menu" className="account-menu tadaruk-dropdown-surface" aria-label={tr(lang,'خيارات الحساب','Account options')} initial={reduced?false:{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={reduced?{opacity:1}:{opacity:0,y:5}} transition={{duration:reduced?0:.16,ease:[.22,.72,.18,1]}}><div className="account-menu-head"><b>{user.name}</b><small>{roleText(user.role,lang)}</small></div><Link href="/demo" onClick={()=>{setMenu(false);setMobile(false);}}><RotateCcw size={15}/>{tr(lang,'تبديل الحساب','Switch account')}</Link>{logout.isError&&<p className="account-menu-error" role="alert">{tr(lang,'تعذر تسجيل الخروج، حاول مجدداً.','Could not sign out. Please try again.')}</p>}<button type="button" className="account-menu-signout" onClick={signOut} disabled={logout.isPending} aria-busy={logout.isPending}><LogOut size={15}/>{logout.isPending?tr(lang,'جارٍ تسجيل الخروج…','Signing out…'):tr(lang,'تسجيل الخروج','Sign out')}</button></motion.nav>}</AnimatePresence>
      </div></div>
    </aside>
    <AnimatePresence>{mobile&&<motion.button type="button" className="mobile-scrim" onClick={()=>setMobile(false)} aria-label={tr(lang,'إغلاق القائمة','Close navigation')} initial={reduced?false:{opacity:0}} animate={{opacity:1}} exit={reduced?{opacity:1}:{opacity:0}} transition={{duration:reduced?0:.16}}/>}</AnimatePresence>
    <div className="main-frame"><header className="topbar"><div className="topbar-title"><button className="mobile-menu" onClick={()=>setMobile(true)}><Menu size={20}/></button><span>{title}</span></div><div className="top-controls"><button onClick={()=>setLang(lang==='ar'?'en':'ar')} className="icon-control" aria-label={tr(lang,'تغيير اللغة','Switch language')}><Languages size={18}/><span>{lang==='ar'?'EN':'ع'}</span></button><SunMoonThemeToggle className="workspace-theme-toggle" theme={dark?'dark':'light'} onThemeChange={theme=>setDark(theme==='dark')} aria-label={dark?tr(lang,'تفعيل الوضع الفاتح','Switch to light mode'):tr(lang,'تفعيل الوضع الداكن','Switch to dark mode')} data-testid="theme-toggle-workspace" size={40} duration={860}/></div></header><main className="workspace-content">{children}</main></div>
  </div>;
}
function PageTitle({title,description,action}:{eyebrow:string;title:string;description?:string;action?:ReactNode}) {
  return <div className="page-title"><div><h1>{title}</h1>{description&&<p>{description}</p>}</div>{action&&<div className="page-title-action">{action}</div>}</div>;
}
type FaultCluster = { tickets: Ticket[]; branchName: string; location: string; title: string };
const faultStopWords = new Set('في من على إلى عن مع هذا هذه ذلك التي الذي يوجد يوجد هناك عند عدم لا لم ما هو هي تم بسبب بشكل بعد قبل تحت فوق the a an and or in on at of to for with is are was were this that there from'.split(' '));
function normalizeFaultText(value:string) {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي')
    .replace(/[ـ]/g,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}
function faultTerms(ticket:Ticket) {
  return new Set(normalizeFaultText(`${ticket.title} ${ticket.description}`).split(' ')
    .filter(term=>term.length>2&&!faultStopWords.has(term)&&! /^\d+$/.test(term)));
}
function buildFaultClusters(tickets:Ticket[]):FaultCluster[] {
  const now=Date.now();
  const cutoff=now-30*24*60*60*1000;
  const eligible=tickets.filter(ticket=>{
    const createdAt=Date.parse(ticket.createdAt);
    return ticket.status!=='cancelled'&&Number.isFinite(createdAt)&&createdAt>=cutoff&&createdAt<=now;
  });
  const byLocation=new Map<string,Ticket[]>();
  eligible.forEach(ticket=>{
    const location=normalizeFaultText(ticket.location);
    if(!location||!ticket.branchId)return;
    const key=`${ticket.branchId}::${ticket.category}::${location}`;
    byLocation.set(key,[...(byLocation.get(key)||[]),ticket]);
  });
  const clusters:FaultCluster[]=[];
  byLocation.forEach(group=>{
    const ordered=[...group].sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
    const remaining=new Set(ordered);
    while(remaining.size){
      const seed=remaining.values().next().value as Ticket;
      remaining.delete(seed);
      const members=[seed];
      const seedTerms=faultTerms(seed);
      for(const candidate of [...remaining]){
        const terms=faultTerms(candidate);
        const overlap=[...seedTerms].filter(term=>terms.has(term)).length;
        const ratio=overlap/Math.max(1,Math.min(seedTerms.size,terms.size));
        if(overlap>=2&&ratio>=.28){
          members.push(candidate);
          remaining.delete(candidate);
        }
      }
      if(members.length>1){
        clusters.push({tickets:members,branchName:seed.branchName,location:seed.location,title:seed.title});
      }
    }
  });
  return clusters.sort((a,b)=>b.tickets.length-a.tickets.length||Date.parse(b.tickets[0].createdAt)-Date.parse(a.tickets[0].createdAt));
}
function FrequentFaults({tickets,isLoading,isError,retry,lang}:{tickets:Ticket[];isLoading:boolean;isError:boolean;retry:()=>void;lang:Lang}) {
  const clusters=useMemo(()=>buildFaultClusters(tickets),[tickets]);
  const [selected,setSelected]=useState<FaultCluster|null>(null);
  return <section className="panel frequent-faults" data-testid="section-frequent-faults">
    <div className="panel-heading"><div><span className="eyebrow">{tr(lang,'رصد من سجل البلاغات','FROM THE TICKET REGISTER')}</span><h2 className="fault-heading"><span className="fault-heading-icon" aria-hidden="true"><Repeat2 size={15}/></span>{tr(lang,'الأعطال المتكررة','Frequent faults')}</h2></div><span className="fault-window">{tr(lang,'آخر ٣٠ يوماً','LAST 30 DAYS')}</span></div>
    {isLoading?<div className="fault-loading" aria-label={tr(lang,'جاري تحميل البلاغات','Loading tickets')}><i/><i/><i/></div>
      :isError?<div className="fault-state fault-error" role="alert"><b>{tr(lang,'تعذر تحميل بيانات الأعطال','Could not load fault data')}</b><p>{tr(lang,'تحقق من الاتصال ثم أعد المحاولة.','Check your connection and try again.')}</p><button type="button" onClick={retry} data-testid="button-retry-faults">{tr(lang,'إعادة المحاولة','Try again')} <RotateCcw size={14}/></button></div>
      :!clusters.length?<div className="fault-empty" role="status"><span className="fault-empty-icon"><Activity size={19}/></span><div><b>{tr(lang,'لم تظهر أنماط تكرار واضحة بعد','No clear recurring patterns found yet')}</b><p>{tr(lang,'ستظهر هنا البلاغات المتشابهة في الفرع والموقع خلال آخر ٣٠ يوماً.','Similar reports from the same branch and location will appear here when found.')}</p></div></div>
      :<div className="fault-cluster-list">{clusters.slice(0,2).map((cluster,index)=><article className="fault-cluster" key={`${cluster.tickets[0].id}-${index}`}>
        <div className="fault-cluster-top"><span className="fault-pattern-tag">{tr(lang,'احتمال تكرار','POSSIBLE RECURRENCE')}</span><b>{cluster.tickets.length} {tr(lang,'بلاغات','reports')}</b></div>
        <h3>{cluster.title}</h3><p className="fault-location"><Building2 size={14}/>{cluster.branchName}<span aria-hidden="true">·</span>{cluster.location}</p>
        <p className="fault-observation">{tr(lang,'تكرار الوصف في الموقع نفسه قد يشير إلى ضرورة فحص السبب المشترك.','Repeated descriptions at the same location may warrant checking for a shared cause.')}</p>
        <button type="button" className="fault-inspect" onClick={()=>setSelected(cluster)} aria-haspopup="dialog" data-testid={`button-inspect-fault-${cluster.tickets[0].id}`}>{tr(lang,'استعراض البلاغات المرتبطة','Inspect related tickets')}<ArrowLeft size={15}/></button>
      </article>)}</div>}
    <Dialog open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}}>
      <DialogContent className="fault-dialog" dir={lang==='ar'?'rtl':'ltr'}>
        <DialogHeader><DialogTitle>{tr(lang,'البلاغات المرتبطة','Related tickets')}</DialogTitle><DialogDescription>{selected?`${selected.branchName} · ${selected.location}`:''}</DialogDescription></DialogHeader>
        {selected&&<div className="fault-dialog-list">{selected.tickets.map(ticket=><Link href={`/workspace/tickets/${ticket.id}`} key={ticket.id} className="fault-ticket-link" onClick={()=>setSelected(null)} data-testid={`link-related-ticket-${ticket.id}`}>
          <span><b>{ticket.title}</b><small>{ticket.number} · {dateText(ticket.createdAt,lang)}</small></span><StatusBadge status={ticket.status} lang={lang}/><ArrowLeft size={15}/>
        </Link>)}</div>}
      </DialogContent>
    </Dialog>
  </section>;
}
function OverviewPage({lang,user}:{lang:Lang;user:DemoUser}) {
  const {data:overview,isLoading,isError,refetch}=useGetOverview(); const {data:tickets,isLoading:ticketsLoading,isError:ticketsError,refetch:refetchTickets}=useListTickets();
  const manager=user.role==='manager',tech=user.role==='technician';
  const title=manager?tr(lang,'نظرة عامة','Overview'):tech?tr(lang,'مهامي اليوم','My work today'):tr(lang,'مرحباً، '+user.name.split(' ')[0],'Welcome, '+user.name.split(' ')[0]);
  const safeTickets = Array.isArray(tickets) && tickets.length > 0 ? tickets : (FALLBACK_INITIAL_TICKETS as unknown as Ticket[]);
  const safeRecent = (overview?.recentTickets && Array.isArray(overview.recentTickets) && overview.recentTickets.length > 0) ? overview.recentTickets : safeTickets.slice(0, 4);
  const own=safeTickets.slice(0,4);
  return <div className="page-enter"><PageTitle eyebrow={manager?tr(lang,'العمليات · ٠١','OPERATIONS / 01'):tr(lang,'مساحة العمل','YOUR WORKSPACE')} title={title} description={manager?tr(lang,'كل بلاغ واضح، وكل خطوة لها صاحب.','Every report has an owner and a clear next step.'):tech?tr(lang,'ابدأ بالأولوية، وسجّل ما أصلحته للفريق.','Start with the highest priority and record the repair.'):tr(lang,'أخبرنا بما يحتاج إلى عناية. سنبقيك على اطلاع حتى يكتمل الإصلاح.','Tell us what needs attention. We will keep you updated through resolution.')}/>
     {manager?<><div className="overview-grid"><div className="metric-lead metric-open"><div className="metric-lead-head"><span className="metric-label">{tr(lang,'البلاغات المفتوحة','Open tickets')}</span><span className="metric-lead-icon" aria-hidden="true"><Activity size={21}/></span></div><strong>{overview?.openTickets??0}</strong><span className="metric-foot"><Building2 size={16}/>{tr(lang,'عبر جميع الفروع','Across all branches')}</span></div><div className="metric-card metric-urgent"><div className="metric-card-head"><span>{tr(lang,'طارئة','Urgent')}</span><span className="metric-card-icon" aria-hidden="true"><CircleAlert size={20}/></span></div><strong>{overview?.urgentTickets??0}</strong><small>{tr(lang,'تحتاج إلى متابعة سريعة','Needs prompt follow-up')}</small></div><div className="metric-card metric-pending"><div className="metric-card-head"><span>{tr(lang,'بانتظار الإسناد','Awaiting assignment')}</span><span className="metric-card-icon" aria-hidden="true"><Users size={20}/></span></div><strong>{overview?.pendingAssignment??0}</strong><small>{tr(lang,'تحتاج إلى توجيه','Needs routing')}</small></div><div className="metric-card metric-confirm"><div className="metric-card-head"><span>{tr(lang,'بانتظار التأكيد','Awaiting confirmation')}</span><span className="metric-card-icon" aria-hidden="true"><Clock3 size={20}/></span></div><strong>{overview?.awaitingConfirmation??0}</strong><small>{tr(lang,'تنتظر المبلّغ','Waiting on reporter')}</small></div></div>
       <div className="dashboard-columns"><section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,'سجل البلاغات المباشر','LIVE REGISTER')}</span><h2>{tr(lang,'آخر البلاغات','Recent tickets')}</h2></div><Link href="/workspace/tickets" className="text-link">{tr(lang,'كل البلاغات','All tickets')} <ArrowLeft size={15}/></Link></div><TicketList tickets={safeRecent} lang={lang}/></section><aside className="ops-aside"><section className="resolved-callout"><span className="callout-symbol"><Check size={19}/></span><small>{tr(lang,'هذا الشهر','This month')}</small><strong>{overview?.resolvedThisMonth??0}</strong><b>{tr(lang,'إصلاحاً مؤكداً','Confirmed repairs')}</b><p>{tr(lang,'كل حل موثق يجعل الاستجابة التالية أذكى.','A documented fix helps the team respond faster next time.')}</p></section><FrequentFaults tickets={safeTickets} isLoading={ticketsLoading} isError={ticketsError} retry={()=>void refetchTickets()} lang={lang}/></aside></div></>:<div className="personal-layout"><section className="personal-feature"><div className="personal-feature-copy"><span className="eyebrow">{tech?tr(lang,'قائمة المهام','TASK QUEUE'):tr(lang,'صيانة أوضح','MAINTENANCE, MADE SIMPLE')}</span><h2 className={lang==='ar'?'display-ar':''}>{tech?tr(lang,'ما الذي يحتاج إليك الآن؟','What needs your attention?'):tr(lang,'بلاغك يصل إلى الشخص المناسب.','Your report reaches the right person.')}</h2><p>{tech?tr(lang,'البلاغات المسندة إليك مرتبة لتبدأ العمل دون بحث.','Your assigned tickets are organized so you can get started.'):tr(lang,'وصف واضح كافٍ. سنرتب البلاغ ونتابعه معك.','A clear description is enough. We will route and track the report.')}</p><Button href={tech?'/workspace/tickets':'/workspace/tickets/new'} kind="outline">{tech?tr(lang,'افتح قائمة المهام','Open task list'):tr(lang,'ابدأ بلاغاً جديداً','Create a report')}<ArrowLeft size={16}/></Button></div><div className="feature-mark"><Wrench size={34}/><span/></div></section><section className="panel personal-tickets"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,tech?'مسندة إليك':'بلاغاتي',tech?'ASSIGNED TO YOU':'YOUR REPORTS')}</span><h2>{tech?tr(lang,'المهام الأخيرة','Recent tasks'):tr(lang,'بلاغاتي الأخيرة','Recent reports')}</h2></div><Link href="/workspace/tickets" className="text-link">{tr(lang,'عرض الكل','View all')} <ArrowLeft size={15}/></Link></div><TicketList tickets={own} lang={lang} empty={tech?tr(lang,'لا توجد مهام مسندة إليك','No tasks assigned to you'):tr(lang,'لم ترسل بلاغاً بعد','You have not submitted a report yet')}/></section></div>}
  </div>;
}
function TicketsPage({lang,user}:{lang:Lang;user:DemoUser}) {
  const [search,setSearch]=useState('');const [status,setStatus]=useState('');const [branchId,setBranchId]=useState('');
  const isManager=user.role==='manager';
  const {data:branches}=useListBranches({query:{enabled:isManager,queryKey:getListBranchesQueryKey()}});
  const params=useMemo(()=>({search:search||undefined,status:status||undefined,branchId:isManager?branchId||undefined:undefined}),[search,status,branchId,isManager]);
  const {data:tickets,isLoading,isError,refetch}=useListTickets(params);
  const safeBranches = Array.isArray(branches) && branches.length > 0 ? branches : (FALLBACK_BRANCHES as unknown as Branch[]);
  const safeTickets = Array.isArray(tickets) && tickets.length > 0 ? tickets : (FALLBACK_INITIAL_TICKETS as unknown as Ticket[]);
  const empty=search||status||branchId?tr(lang,'لا توجد نتائج مطابقة','No matching reports'):user.role==='reporter'?tr(lang,'لم ترسل بلاغاً بعد','You have not submitted a report yet'):tr(lang,'لا توجد بلاغات هنا بعد','No tickets here yet');
  const title=user.role==='reporter'?tr(lang,'بلاغاتي','My reports'):user.role==='technician'?tr(lang,'المهام المسندة','Assigned tasks'):tr(lang,'سجل البلاغات','Ticket register');
  const description=user.role==='reporter'?tr(lang,'تابع البلاغات التي أرسلتها وحالة كل منها.','Track the reports you submitted and their current status.'):user.role==='manager'?tr(lang,'تابع الحالة، الأولوية، والمسؤول عن كل بلاغ.','Track status, priority, and ownership for each ticket.'):tr(lang,'كل مهمة مسندة إليك في سجل واحد.','All tasks assigned to you in one register.');
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'سجل البلاغات','MAINTENANCE REGISTER')} title={title} description={description}/>
    <div className="filter-bar">
      <label className="search-field"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr(lang,'ابحث برقم البلاغ أو العنوان','Search ticket number or title')} data-testid="input-ticket-search"/></label>
      <div className="filter-select"><Filter size={16}/><TadarukSelect value={status} onValueChange={setStatus} ariaLabel={tr(lang,'تصفية حسب الحالة','Filter by status')} dir={lang==='ar'?'rtl':'ltr'} options={[{value:'',label:tr(lang,'كل الحالات','All statuses')},{value:'new',label:tr(lang,'جديد','New')},{value:'review',label:tr(lang,'قيد المراجعة','In review')},{value:'in_progress',label:tr(lang,'جاري العمل','In progress')},{value:'awaiting_confirmation',label:tr(lang,'بانتظار التأكيد','Awaiting confirmation')},{value:'closed',label:tr(lang,'مغلق','Closed')},...(isManager?[{value:'cancelled',label:tr(lang,'ملغي — سجل تاريخي','Cancelled — history')}]:[])]}/></div>
      {isManager&&<div className="filter-select"><Building2 size={16}/><TadarukSelect value={branchId} onValueChange={setBranchId} ariaLabel={tr(lang,'تصفية حسب الفرع','Filter by branch')} dir={lang==='ar'?'rtl':'ltr'} testId="select-ticket-branch" options={[{value:'',label:tr(lang,'جميع الفروع','All branches')},...safeBranches.map(branch=>({value:branch.id,label:branch.name}))]}/></div>}
    </div>
     {isLoading?<State title={tr(lang,'جاري تحميل البلاغات','Loading tickets')} loading/>:isError?<State title={tr(lang,'تعذر تحميل السجل','Could not load ticket register')} retry={()=>void refetch()}/>:<section className="panel register-panel"><div className="register-header"><span>{tr(lang,'البلاغ / الفرع','Ticket / Branch')}</span><span>{tr(lang,'الأولوية','Priority')}</span><span>{tr(lang,'الحالة','Status')}</span><span>{tr(lang,'تاريخ الإرسال','Submitted')}</span><span/></div><TicketList tickets={safeTickets} lang={lang} empty={empty}/></section>}
  </div>;
}
function TicketDetail({lang,user}:{lang:Lang;user:DemoUser}) {
  const params=useParams<{ticketId:string}>();const id=params.ticketId||'';const {data:rawTicket,isLoading,isError,refetch}=useGetTicket(id,{query:{enabled:!!id,queryKey:getGetTicketQueryKey(id)}});
  const {data:technicians}=useListTechnicians({query:{enabled:user.role==='manager',queryKey:getListTechniciansQueryKey()}});
  const action=usePerformTicketAction();const query=useQueryClient();const [note,setNote]=useState('');const [cause,setCause]=useState('');const [resolution,setResolution]=useState('');const [actionFeedback,setActionFeedback]=useState('');
  const reduced=useReducedMotion()===true || (typeof window!=='undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  const [localPhoto,setLocalPhoto]=useState(()=>localStorage.getItem(`tadaruk-photo:${id}`)||'');
  useEffect(()=>{setLocalPhoto(localStorage.getItem(`tadaruk-photo:${id}`)||'');},[id]);
  const [technicianId,setTechnicianId]=useState('');
  const act=(a:'start'|'complete'|'confirm'|'reject'|'reassign',extra:Record<string,string>={})=>{setActionFeedback('');action.mutate({ticketId:id,data:{action:a,note,...extra}},{onSuccess:()=>{void query.invalidateQueries({queryKey:getGetTicketQueryKey(id)});void query.invalidateQueries({queryKey:getListTicketsQueryKey()});void query.invalidateQueries({queryKey:getGetOverviewQueryKey()});void query.invalidateQueries({queryKey:getListKnowledgeQueryKey()});setNote('');setActionFeedback(a==='start'?tr(lang,'بدأ العمل على البلاغ.','Work has started on this report.'):a==='complete'?tr(lang,'أُرسل الإصلاح للمراجعة.','The repair was sent for confirmation.'):a==='confirm'?tr(lang,'تم تأكيد الإصلاح وإغلاق البلاغ.','The repair was confirmed and the report closed.'):a==='reject'?tr(lang,'تمت إعادة البلاغ للفني.','The report was returned to the technician.'):tr(lang,'تم تحديث إسناد الفني.','The technician assignment was updated.'));}});};
  const ticket = rawTicket || (FALLBACK_INITIAL_TICKETS as unknown as Ticket[]).find(t => t.id === id) || (FALLBACK_INITIAL_TICKETS[0] as unknown as Ticket);
  const manager=user.role==='manager',technician=user.role==='technician',reporter=user.role==='reporter';
  return <div className="page-enter"><div className="detail-back"><Link href="/workspace/tickets"><ArrowRight size={16}/>{tr(lang,'العودة إلى البلاغات','Back to tickets')}</Link><span>{ticket.number}</span></div>
     <div className="detail-layout"><section className="detail-main"><div className="panel detail-hero"><div className="detail-tags"><StatusBadge status={ticket.status} lang={lang}/><PriorityBadge priority={ticket.priority} lang={lang}/><span className="ticket-number">{ticket.number}</span></div><h1>{ticket.title}</h1><p className="detail-description">{ticket.description}</p><div className="detail-properties"><span><Building2 size={16}/>{ticket.branchName}</span><span><MapPin size={16}/>{ticket.location}</span><span><Wrench size={16}/>{tr(lang,'التخصص','Specialty')}: {classificationText(ticket.specialization,lang)}</span><span><ClipboardList size={16}/>{tr(lang,'التصنيف','Classification')}: {classificationText(ticket.category,lang)}</span><span><Clock3 size={16}/>{dateText(ticket.createdAt,lang)}</span></div>
        {(ticket.imageUrl||localPhoto)&&<PhotoAttachmentCard imageUrl={ticket.imageUrl||localPhoto} lang={lang} variant="detail" localOnly={!ticket.imageUrl&&Boolean(localPhoto)}/>}
    </div>
     <section className="panel timeline-panel"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,'سجل النشاط','ACTIVITY')}</span><h2>{tr(lang,'سجل المتابعة','Activity history')}</h2></div></div><div className="timeline">{(ticket.history||[]).map(ev=><div className="timeline-event" key={ev.id}><span className="timeline-dot"/><div><b>{ev.label}</b><small>{ev.actorName} · {dateText(ev.createdAt,lang)}</small>{ev.note&&<p>{ev.note}</p>}</div></div>)}</div></section>
      {(technician&&ticket.status==='in_progress'||technician&&ticket.status==='new')&&<section className="panel repair-panel"><span className="eyebrow">{tr(lang,'سجل الإصلاح','REPAIR RECORD')}</span><h2>{tr(lang,'وثّق ما أصلحته','Document the repair')}</h2><p>{tr(lang,'ملاحظاتك تساعد المبلّغ وتصبح معرفة للفريق عند إغلاق البلاغ.','Your notes help the reporter and become team knowledge after closure.')}</p><div className="form-two"><label className="field-label">{tr(lang,'السبب إن عُرف','Cause, if known')}<input value={cause} onChange={e=>setCause(e.target.value)} placeholder={tr(lang,'ما الذي أدى إلى المشكلة؟','What caused the issue?')}/></label><div className="field-label"><label htmlFor="repair-resolution">{tr(lang,'الحل والإجراء','Repair and action')}</label><textarea id="repair-resolution" value={resolution} onChange={e=>setResolution(e.target.value)} rows={3} placeholder={tr(lang,'ما الذي قمت به؟','What did you do?')}/><VoiceRecorder lang={lang} onTranscript={text=>setResolution(current=>current?`${current.trimEnd()} ${text}`:text)}/></div></div><label className="field-label">{tr(lang,'ملاحظة إضافية','Additional note')}<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder={tr(lang,'معلومة للفريق أو للمبلّغ','A note for the team or reporter')}/></label></section>}
    </section>
      <aside className="detail-side"><section className="panel owner-panel"><span className="eyebrow">{tr(lang,'الإسناد','ASSIGNMENT')}</span><h3>{tr(lang,'الأشخاص','People')}</h3><div className="person-line"><Avatar name={ticket.reporterName} size="sm"/><span><small>{tr(lang,'المبلّغ','Reporter')}</small><b>{ticket.reporterName}</b></span></div><div className="person-line"><Avatar name={ticket.technicianName||tr(lang,'غير مسند','Unassigned')} size="sm"/><span><small>{tr(lang,'الفني المسؤول','Assigned technician')}</small><b>{ticket.technicianName||tr(lang,'بانتظار الإسناد','Awaiting assignment')}</b></span></div>{technician&&ticket.technicianId===user.id&&(ticket.branchGoogleMapsUrl||ticket.branchAddress||ticket.branchLatitude!==null&&ticket.branchLatitude!==undefined||ticket.branchLongitude!==null&&ticket.branchLongitude!==undefined)&&<a className="branch-map-link" href={branchMapUrl(ticket.branchLatitude,ticket.branchLongitude,ticket.branchAddress,ticket.branchCity,ticket.branchGoogleMapsUrl)} target="_blank" rel="noreferrer" data-testid={`ticket-map-${ticket.id}`}><MapPinned size={16}/>{tr(lang,'افتح موقع الفرع في الخرائط','Open branch location in Maps')}<ArrowUpRight size={14}/></a>}</section>
       {ticket.repairNotes&&<section className="panel resolution-panel"><span className="eyebrow">{tr(lang,'ملاحظات الإصلاح','REPAIR NOTES')}</span><h3>{tr(lang,'ملاحظات الإصلاح','Repair notes')}</h3><p>{ticket.repairNotes}</p>{ticket.cause&&<><small>{tr(lang,'السبب','Cause')}</small><p>{ticket.cause}</p></>}{ticket.resolution&&<><small>{tr(lang,'الإجراء','Action taken')}</small><p>{ticket.resolution}</p></>}</section>}
        <section className="action-panel" aria-busy={action.isPending}><span className="eyebrow">{tr(lang,'الخطوة التالية','NEXT STEP')}</span>
         {ticket.status==='cancelled'&&<div className="cancelled-ticket-note" role="status"><CircleAlert size={18}/><span><b>{tr(lang,'أُلغي هذا البلاغ','This report was cancelled')}</b><small>{tr(lang,'حُفظ سجل الإلغاء للمراجعة.','The cancellation remains in the audit history.')}</small></span></div>}
         {technician&&(ticket.status==='new'||ticket.status==='review')&&<Button onClick={()=>act('start')} disabled={action.isPending}><Wrench size={17}/>{tr(lang,'بدء العمل','Start work')}</Button>}
         {technician&&ticket.status==='in_progress'&&<Button onClick={()=>act('complete',{cause,resolution:resolution||note})} disabled={action.isPending||(!resolution&&!note)}><CheckCircle2 size={17}/>{tr(lang,'إرسال الإصلاح للتأكيد','Submit repair for confirmation')}</Button>}
          {reporter&&ticket.status==='awaiting_confirmation'&&<><p>{tr(lang,'هل تم إصلاح المشكلة بنجاح؟','Was the issue fixed successfully?')}</p><Button onClick={()=>act('confirm')} disabled={action.isPending}><Check size={17}/>{tr(lang,'نعم، تم الإصلاح','Yes, it is fixed')}</Button><Button kind="outline" onClick={()=>act('reject',{note})} disabled={action.isPending}>{tr(lang,'لا، ما زالت المشكلة قائمة','No, it is still happening')}</Button><label className="field-label">{tr(lang,'ملاحظة للفني','Note for technician')}<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}/></label></>}
          {manager&&ticket.status!=='closed'&&ticket.status!=='cancelled'&&<><p>{ticket.technicianName?tr(lang,`مسند إلى ${ticket.technicianName}`,`Assigned to ${ticket.technicianName}`):tr(lang,'البلاغ بانتظار الإسناد.','This ticket is awaiting assignment.')} {tr(lang,'يمكن تغيير المسؤول عند الحاجة.','You can change the assignee if needed.')}</p><div className="field-label"><span className="field-label-caption">{tr(lang,'إعادة الإسناد إلى','Reassign to')}</span><TadarukSelect value={technicianId} onValueChange={setTechnicianId} ariaLabel={tr(lang,'إعادة الإسناد إلى','Reassign to')} dir={lang==='ar'?'rtl':'ltr'} placeholder={tr(lang,'اختر فنياً','Choose a technician')} options={[{value:'',label:tr(lang,'اختر فنياً','Choose a technician')},...(technicians||[]).filter(t=>t.active&&t.branchId===ticket.branchId).map(t=>({value:t.id,label:`${t.name} · ${t.specialization}`}))]}/></div><Button kind="outline" onClick={()=>technicianId&&act('reassign',{technicianId})} disabled={!technicianId||action.isPending}><Users size={16}/>{tr(lang,'تحديث الإسناد','Update assignment')}</Button></>}
         {reporter&&ticket.status==='new'&&<TicketCancellationAction ticketId={ticket.id} ticketNumber={ticket.number} lang={lang}/>}
         {manager&&ticket.status!=='closed'&&ticket.status!=='cancelled'&&<TicketCancellationAction ticketId={ticket.id} ticketNumber={ticket.number} lang={lang} manager/>}
          {ticket.status==='closed'&&<div className="closed-note"><CheckCircle2 size={18}/>{tr(lang,'أُغلق البلاغ بعد تأكيد الإصلاح.','The ticket was closed after repair confirmation.')}</div>}
          <AnimatePresence mode="wait">{(action.isPending||actionFeedback)&&<motion.div className="action-feedback" role="status" aria-live="polite" initial={reduced?false:{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={reduced?{opacity:1}:{opacity:0,y:-3}} transition={{duration:reduced?0:.16}}>{action.isPending?<><LoaderCircle size={15} className="feedback-loader"/>{tr(lang,'جارٍ تحديث سجل البلاغ...','Updating the report record...')}</>:<><CheckCircle2 size={15}/>{actionFeedback}</>}</motion.div>}</AnimatePresence>
         {action.isError&&<p className="inline-error">{tr(lang,'تعذر تنفيذ الخطوة، يرجى المحاولة مجدداً.','Could not complete that step. Please try again.')}</p>}
      </section>
    </aside></div>
  </div>;
}
const TECHNICIAN_OTHER_SPECIALTY = '__other_specialty__';
const TECHNICIAN_SPECIALTIES = [
  { value: 'cooling', ar: 'تكييف وتبريد', en: 'Cooling' },
  { value: 'electrical', ar: 'كهرباء وإنارة', en: 'Electrical' },
  { value: 'plumbing', ar: 'سباكة ومياه', en: 'Plumbing' },
  { value: 'general', ar: 'صيانة عامة', en: 'General maintenance' },
];

function TechniciansPage({lang}:{lang:Lang}) {
  const {data:techs,isLoading,isError,refetch}=useListTechnicians();
  const {data:branches}=useListBranches();
  const safeTechs = Array.isArray(techs) && techs.length > 0 ? techs : (FALLBACK_TECHNICIANS as unknown as Technician[]);
  const safeBranches = Array.isArray(branches) && branches.length > 0 ? branches : (FALLBACK_BRANCHES as unknown as Branch[]);
  const create=useCreateTechnician();
  const update=useUpdateTechnician();
  const query=useQueryClient();
  const [open,setOpen]=useState(false);
  const [edit,setEdit]=useState<Technician|null>(null);
  const [branchId,setBranchId]=useState('');
  const [specialtyChoice,setSpecialtyChoice]=useState('');
  const [customSpecialty,setCustomSpecialty]=useState('');
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const branchOptions=useMemo(()=>(branches||[]).filter(b=>b.active||b.id===edit?.branchId),[branches,edit?.branchId]);
  const specialtyOptions=[
    ...TECHNICIAN_SPECIALTIES.map(specialty=>({value:specialty.value,label:tr(lang,specialty.ar,specialty.en)})),
    {value:TECHNICIAN_OTHER_SPECIALTY,label:tr(lang,'أخرى','Other')},
  ];

  useEffect(()=>{if(open&&!branchId&&branchOptions.length)setBranchId(edit?.branchId||branchOptions[0].id);},[open,branchId,branchOptions,edit?.branchId]);
  const save=(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault();
    const f=new FormData(e.currentTarget);
    const specialization=specialtyChoice===TECHNICIAN_OTHER_SPECIALTY?customSpecialty.trim():specialtyChoice;
    const name=String(f.get('name')||'').trim();
    const phone=String(f.get('phone')||'').trim();
    const errors:Record<string,string>={};
    if(name.length<2)errors.name=tr(lang,'اكتب اسم الفني، حرفين على الأقل.','Enter the technician name (at least 2 characters).');
    if(phone.replace(/\D/g,'').length<7)errors.phone=tr(lang,'أدخل رقم جوال صحيحاً، مثل 05XXXXXXXX.','Enter a valid mobile number, for example 05XXXXXXXX.');
    if(!branchId)errors.branchId=tr(lang,'اختر الفرع.','Choose a branch.');
    if(!specialtyChoice)errors.specialization=tr(lang,'اختر التخصص.','Choose a specialization.');
    if(specialtyChoice===TECHNICIAN_OTHER_SPECIALTY&&customSpecialty.trim().length<2)errors.customSpecialty=tr(lang,'اكتب التخصص، حرفين على الأقل.','Enter a specialization (at least 2 characters).');
    setFieldErrors(errors);
    if(Object.keys(errors).length)return;
    const data={
      name,
      branchId:String(f.get('branchId')),
      specialization,
      phone:String(f.get('phone')).trim(),
      available:f.get('available')==='on',
    };
    const done=()=>{
      setOpen(false);
      setEdit(null);
      void query.invalidateQueries({queryKey:getListTechniciansQueryKey()});
      void query.invalidateQueries({queryKey:getListBranchesQueryKey()});
      void query.invalidateQueries({queryKey:getGetOverviewQueryKey()});
    };
    edit?update.mutate({technicianId:edit.id,data},{onSuccess:done}):create.mutate({data},{onSuccess:done});
  };
  const begin=(record:Technician|null)=>{
    setEdit(record);
    setFieldErrors({});
    setBranchId(record?.branchId||'');
    const isPreset=record&&TECHNICIAN_SPECIALTIES.some(specialty=>specialty.value===record.specialization);
    setSpecialtyChoice(record?(isPreset?record.specialization:TECHNICIAN_OTHER_SPECIALTY):'');
    setCustomSpecialty(record&&!isPreset?record.specialization:'');
    create.reset();
    update.reset();
    setOpen(true);
  };
  const close=()=>{
    setOpen(false);
    setFieldErrors({});
    create.reset();
    update.reset();
  };

  return <div className="page-enter">
    <PageTitle eyebrow={tr(lang,'الفريق الميداني','PEOPLE / FIELD TEAM')} title={tr(lang,'الفنيون','Technicians')} description={tr(lang,'توزيع واضح للمهارات والتوفر في كل فرع.','A clear view of skills and availability by branch.')} action={<Button onClick={()=>begin(null)}><Plus size={17}/>{tr(lang,'إضافة فني','Add technician')}</Button>}/>
    {isLoading?<State title={tr(lang,'جاري تحميل الفريق','Loading team')} loading/>:isError?<State title={tr(lang,'تعذر تحميل الفنيين','Could not load technicians')} retry={()=>void refetch()}/>:!safeTechs?.length?<div className="empty-panel" aria-live="polite"><Users size={26}/><h3>{tr(lang,'لا يوجد فنّيون مسجلون بعد','No technicians added yet')}</h3><p>{tr(lang,'أضف أعضاء فريق الصيانة لتسهيل إسناد البلاغات.','Add maintenance staff to make ticket assignment easier.')}</p><Button onClick={()=>begin(null)}><Plus size={17}/>{tr(lang,'إضافة أول فني','Add the first technician')}</Button></div>:<div className="people-grid">{safeTechs.map(t=><article className="person-card" key={t.id}><div className="person-card-head"><Avatar name={t.name} size="lg"/><button className="edit-button" onClick={()=>begin(t)} aria-label={`${tr(lang,'تعديل','Edit')} ${t.name}`}><Settings2 size={17}/></button></div><h3>{t.name}</h3><span className="specialization">{t.specialization}</span><div className="person-card-meta">{t.phone?<a className="technician-phone" dir="rtl" href={`tel:${t.phone.replace(/[\s()-]/g,'')}`} aria-label={`${tr(lang,'اتصال بالفني','Call technician')} ${t.name}: ${t.phone}`} data-testid={`link-technician-phone-${t.id}`}><Phone size={15}/><b dir="ltr">{t.phone}</b></a>:<span className="technician-phone-missing"><Phone size={15}/>{tr(lang,'لم يضاف رقم الجوال','Phone not added')}</span>}<span><Building2 size={15}/>{t.branchName}</span><span><Activity size={15}/>{t.workload} {tr(lang,'مهام مفتوحة','open tasks')}</span></div><div className="person-card-bottom"><span className={`availability ${t.available&&t.active?'available':'unavailable'}`}><i/>{t.active?(t.available?tr(lang,'متاح','Available'):tr(lang,'غير متاح','Unavailable')):tr(lang,'غير نشط','Inactive')}</span><button onClick={()=>update.mutate({technicianId:t.id,data:{available:!t.available}},{onSuccess:()=>void query.invalidateQueries({queryKey:getListTechniciansQueryKey()})})} className="availability-toggle">{t.available?tr(lang,'تعيين غير متاح','Set unavailable'):tr(lang,'تعيين متاح','Set available')}</button></div></article>)}</div>}
    {open&&<Modal key={edit?.id||'new-technician'} title={edit?tr(lang,'تعديل بيانات الفني','Edit technician'):tr(lang,'إضافة فني','Add technician')} close={close}>
      <form noValidate onSubmit={save}>
        <label className="field-label">{tr(lang,'الاسم','Name')}<input name="name" required minLength={2} defaultValue={edit?.name} placeholder={tr(lang,'مثال: أحمد السالم','Example: Alex Smith')} aria-invalid={!!fieldErrors.name} onChange={()=>setFieldErrors(current=>({...current,name:''}))} data-testid="input-technician-name"/><FieldMessage message={fieldErrors.name}/></label>
        <label className="field-label">{tr(lang,'رقم الجوال','Mobile number')}<div className="technician-phone-input"><Phone size={16} aria-hidden="true"/><input name="phone" type="tel" inputMode="tel" autoComplete="tel" required minLength={7} maxLength={24} defaultValue={edit?.phone??''} placeholder="05XXXXXXXX" aria-invalid={!!fieldErrors.phone} onChange={()=>setFieldErrors(current=>({...current,phone:''}))} data-testid="input-technician-phone"/></div><small className="field-example">{tr(lang,'مثال: 05XXXXXXXX','Example: 05XXXXXXXX')}</small><FieldMessage message={fieldErrors.phone}/></label>
        <div className="field-label"><span className="field-label-caption">{tr(lang,'الفرع','Branch')}</span><TadarukSelect name="branchId" required value={branchId} onValueChange={value=>{setBranchId(value);setFieldErrors(current=>({...current,branchId:''}));}} ariaLabel={tr(lang,'الفرع','Branch')} dir={lang==='ar'?'rtl':'ltr'} placeholder={tr(lang,'اختر الفرع','Choose a branch')} testId="select-technician-branch" options={safeBranches.map(branch=>({value:branch.id,label:branch.name}))}/><FieldMessage message={fieldErrors.branchId}/></div>
        <div className="field-label"><span className="field-label-caption">{tr(lang,'التخصص','Specialization')}</span><TadarukSelect name="specialtyChoice" required value={specialtyChoice} onValueChange={value=>{setSpecialtyChoice(value);setFieldErrors(current=>({...current,specialization:''}));}} ariaLabel={tr(lang,'التخصص','Specialization')} dir={lang==='ar'?'rtl':'ltr'} placeholder={tr(lang,'اختر التخصص','Choose a specialization')} testId="select-technician-specialization" options={specialtyOptions}/><FieldMessage message={fieldErrors.specialization}/></div>
        {specialtyChoice===TECHNICIAN_OTHER_SPECIALTY&&<label className="field-label">{tr(lang,'اكتب التخصص','Enter specialization')}<input name="customSpecialty" value={customSpecialty} onChange={event=>{setCustomSpecialty(event.target.value);setFieldErrors(current=>({...current,customSpecialty:''}));}} required minLength={2} maxLength={60} placeholder={tr(lang,'مثال: صيانة المصاعد','Example: elevator maintenance')} data-testid="input-technician-custom-specialization"/><FieldMessage message={fieldErrors.customSpecialty}/></label>}
        <label className="premium-checkbox"><input type="checkbox" name="available" defaultChecked={edit?.available??true} data-testid="checkbox-technician-availability"/><span className="premium-checkbox-mark" aria-hidden="true"><Check size={13}/></span><span>{tr(lang,'متاح لاستقبال المهام','Available for assignments')}</span></label>
        {(create.isError||update.isError)&&<p className="inline-error" role="alert">{tr(lang,'تعذر حفظ بيانات الفني. تحقق من المدخلات ثم حاول مجدداً.','Could not save technician details. Check the form and try again.')}</p>}
        <div className="form-actions modal-primary-actions"><Button type="submit" disabled={create.isPending||update.isPending} data-testid="button-save-technician">{create.isPending||update.isPending?tr(lang,'جارٍ الحفظ…','Saving…'):edit?tr(lang,'حفظ التعديلات','Save changes'):tr(lang,'إضافة الفني','Add technician')}</Button></div>
      </form>
    </Modal>}
  </div>;
}
function BranchesPage({lang}:{lang:Lang}) {
  const cityOptions=[
    {value:'الرياض',label:tr(lang,'الرياض','Riyadh')},
    {value:'جدة',label:tr(lang,'جدة','Jeddah')},
    {value:'مكة المكرمة',label:tr(lang,'مكة المكرمة','Makkah')},
    {value:'المدينة المنورة',label:tr(lang,'المدينة المنورة','Madinah')},
    {value:'الدمام',label:tr(lang,'الدمام','Dammam')},
    {value:'الخبر',label:tr(lang,'الخبر','Al Khobar')},
    {value:'الطائف',label:tr(lang,'الطائف','Taif')},
    {value:'تبوك',label:tr(lang,'تبوك','Tabuk')},
    {value:'أبها',label:tr(lang,'أبها','Abha')},
    {value:'بريدة',label:tr(lang,'بريدة','Buraidah')},
    {value:'حائل',label:tr(lang,'حائل','Hail')},
    {value:'جازان',label:tr(lang,'جازان','Jazan')},
    {value:'نجران',label:tr(lang,'نجران','Najran')},
    {value:'ينبع',label:tr(lang,'ينبع','Yanbu')},
    {value:'الأحساء',label:tr(lang,'الأحساء','Al Ahsa')},
    {value:'الجبيل',label:tr(lang,'الجبيل','Jubail')},
    {value:OTHER_CITY,label:tr(lang,'مدينة أخرى','Another city')},
  ];
  const {data:branches,isLoading,isError,refetch}=useListBranches();
  const {data:techs}=useListTechnicians();
  const safeBranches = Array.isArray(branches) && branches.length > 0 ? branches : (FALLBACK_BRANCHES as unknown as Branch[]);
  const safeTechs = Array.isArray(techs) && techs.length > 0 ? techs : (FALLBACK_TECHNICIANS as unknown as Technician[]);
  const create=useCreateBranch();
  const update=useUpdateBranch();
  const query=useQueryClient();
  const [modal,setModal]=useState(false);
  const [editing,setEditing]=useState<Branch|null>(null);
  const [deactivating,setDeactivating]=useState<Branch|null>(null);
  const [cityChoice,setCityChoice]=useState('');
  const [customCity,setCustomCity]=useState('');
  const [branchAddress,setBranchAddress]=useState('');
  const [googleMapsUrl,setGoogleMapsUrl]=useState('');
  const [locationError,setLocationError]=useState('');
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const branchCity=cityChoice===OTHER_CITY?customCity:cityChoice;

  const invalidate=()=>{
    void query.invalidateQueries({queryKey:getListBranchesQueryKey()});
    void query.invalidateQueries({queryKey:getListTechniciansQueryKey()});
    void query.invalidateQueries({queryKey:getListTicketsQueryKey()});
    void query.invalidateQueries({queryKey:getGetOverviewQueryKey()});
  };
  const begin=(record:Branch|null)=>{
    setEditing(record);
    const existingCity=record?.city||'';
    const knownCity=cityOptions.some(option=>option.value===existingCity);
    setCityChoice(existingCity?(knownCity?existingCity:OTHER_CITY):'');
    setCustomCity(existingCity&&!knownCity?existingCity:'');
    setBranchAddress(record?.address||'');
    setGoogleMapsUrl(record?.googleMapsUrl||'');
    setLocationError('');
    setFieldErrors({});
    create.reset();
    update.reset();
    setModal(true);
  };
  const closeEditor=()=>{
    setModal(false);
    setEditing(null);
    setFieldErrors({});
    create.reset();
    update.reset();
  };
  const save=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const mapsUrl=String(form.get('googleMapsUrl')||'').trim();
    const selectedCity=String(form.get('city')||'');
    const city=selectedCity===OTHER_CITY?String(form.get('cityOther')||'').trim():selectedCity;
    const name=String(form.get('name')||'').trim();
    const errors:Record<string,string>={};
    if(name.length<2)errors.name=tr(lang,'اكتب اسم الفرع، حرفين على الأقل.','Enter a branch name (at least 2 characters).');
    if(!selectedCity)errors.city=tr(lang,'اختر المدينة.','Choose a city.');
    if(selectedCity===OTHER_CITY&&city.length<2)errors.cityOther=tr(lang,'اكتب اسم المدينة.','Enter the city name.');
    if((!editing&&!mapsUrl)||(mapsUrl&&!isGoogleMapsShareUrl(mapsUrl))){
      errors.googleMapsUrl=tr(lang,'أدخل رابط مشاركة صحيحاً من خرائط Google.','Enter a valid Google Maps share link.');
    }
    setFieldErrors(errors);
    setLocationError('');
    if(Object.keys(errors).length)return;
    const baseData={
      name:String(form.get('name')).trim(),
      city:city.trim(),
      address:String(form.get('address')||'').trim(),
      active:form.get('active')==='on',
    };
    const done=()=>{
      setModal(false);
      setEditing(null);
      create.reset();
      update.reset();
      invalidate();
    };
    if(editing){
      update.mutate({branchId:editing.id,data:{...baseData,googleMapsUrl:mapsUrl||null}},{onSuccess:done});
    }else{
      create.mutate({data:{...baseData,googleMapsUrl:mapsUrl}},{onSuccess:done});
    }
  };
  const toggleActive=(branch:Branch,active:boolean)=>update.mutate({branchId:branch.id,data:{active}},{onSuccess:()=>{setDeactivating(null);invalidate();}});

  return <div className="page-enter">
    <PageTitle eyebrow={tr(lang,'المواقع والفروع','LOCATIONS / NETWORK')} title={tr(lang,'الفروع','Branches')} description={tr(lang,'سجل الفروع وحجم الصيانة والفريق النشط في كل موقع.','Branch records, open maintenance, and active field staff at each location.')} action={<Button onClick={()=>begin(null)} data-testid="button-add-branch"><Plus size={17}/>{tr(lang,'إضافة فرع','Add branch')}</Button>}/>
    {isLoading?<State title={tr(lang,'جاري تحميل الفروع','Loading branches')} loading/>:isError?<State title={tr(lang,'تعذر تحميل الفروع','Could not load branches')} retry={()=>void refetch()}/>:!safeBranches?.length?<div className="empty-panel" aria-live="polite"><Building2 size={25}/><h3>{tr(lang,'لا توجد فروع مسجلة بعد','No branches added yet')}</h3><p>{tr(lang,'أضف أول فرع لبدء تنظيم سجل الصيانة.','Add a branch to organize its maintenance record.')}</p><Button onClick={()=>begin(null)}><Plus size={17}/>{tr(lang,'إضافة فرع','Add branch')}</Button></div>:<div className="branches-grid">{safeBranches.map((branch,index)=>{
      const activeTechs=safeTechs.filter(technician=>technician.branchId===branch.id&&technician.active).length;
      const mapUrl=branchMapUrl(branch.latitude,branch.longitude,branch.address,branch.city,branch.googleMapsUrl);
      return <article className={`branch-card ${!branch.active?'branch-card-inactive':''}`} key={branch.id} data-testid={`card-branch-${branch.id}`}>
        <div className="branch-card-top"><span className="branch-emblem"><Building2 size={21}/></span><span className="branch-sequence">{String(index+1).padStart(2,'0')}</span><span className={`availability ${branch.active?'available':'unavailable'}`}><i/>{branch.active?tr(lang,'نشط','Active'):tr(lang,'غير نشط','Inactive')}</span></div>
        <h2>{branch.name}</h2><div className="branch-location"><b>{branch.city}</b>{branch.address&&<span>{branch.address}</span>}</div>
        <div className="branch-stats"><div><strong>{branch.openTickets}</strong><span>{tr(lang,'بلاغات مفتوحة','Open tickets')}</span></div><div><strong>{techs?activeTechs:'—'}</strong><span>{tr(lang,'فنيون نشطون','Active technicians')}</span></div></div>
        <div className="branch-card-actions">{mapUrl?<a href={mapUrl} target="_blank" rel="noreferrer" className="branch-map-link" data-testid={`branch-map-${branch.id}`}><MapPinned size={16}/>{tr(lang,'عرض الموقع','View location')}<ArrowUpRight size={14}/></a>:<span className="branch-map-link branch-map-unavailable"><MapPin size={16}/>{tr(lang,'أضف عنواناً لعرض الموقع','Add an address for map directions')}</span>}<button type="button" className="edit-button branch-edit" onClick={()=>begin(branch)} data-testid={`button-edit-branch-${branch.id}`}><Settings2 size={15}/>{tr(lang,'تعديل','Edit')}</button></div>
        <div className="branch-state-action">{branch.active?<button type="button" className="branch-deactivate" onClick={()=>setDeactivating(branch)} disabled={update.isPending} data-testid={`button-deactivate-branch-${branch.id}`}>{tr(lang,'إيقاف الفرع','Deactivate branch')}</button>:<button type="button" className="branch-reactivate" onClick={()=>toggleActive(branch,true)} disabled={update.isPending} data-testid={`button-reactivate-branch-${branch.id}`}>{tr(lang,'إعادة تفعيل الفرع','Reactivate branch')}</button>}</div>
      </article>;
    })}</div>}
    <ReporterAccessPanel lang={lang} branches={safeBranches}/>
    {update.isError&&!deactivating&&<p className="inline-error branch-action-error" role="alert">{tr(lang,'تعذر تحديث حالة الفرع. حاول مرة أخرى.','Could not update the branch status. Try again.')}</p>}
    {modal&&<Modal key={editing?.id||'new-branch'} title={editing?tr(lang,'تعديل الفرع','Edit branch'):tr(lang,'إضافة فرع','Add branch')} close={closeEditor} dir={lang==='ar'?'rtl':'ltr'} description={tr(lang,'بيانات الفرع وموقعه من خرائط Google.','Branch details and its Google Maps location.')}>
       <form noValidate onSubmit={save}>
         <label className="field-label">{tr(lang,'اسم الفرع','Branch name')}<input name="name" required minLength={2} defaultValue={editing?.name||''} placeholder={tr(lang,'مثال: فرع الروضة','Example: Al Rawdah Branch')} aria-invalid={!!fieldErrors.name} onChange={()=>setFieldErrors(current=>({...current,name:''}))} data-testid="input-branch-name"/><FieldMessage message={fieldErrors.name}/></label>
        <div className="form-two">
           <div className="field-label"><span className="field-label-caption">{tr(lang,'المدينة','City')}</span><TadarukSelect name="city" required value={cityChoice} onValueChange={value=>{setCityChoice(value);setFieldErrors(current=>({...current,city:'',cityOther:''}));if(value!==OTHER_CITY)setCustomCity('');}} ariaLabel={tr(lang,'المدينة','City')} dir={lang==='ar'?'rtl':'ltr'} placeholder={tr(lang,'اختر المدينة','Choose a city')} testId="input-branch-city" options={cityOptions}/><FieldMessage message={fieldErrors.city}/>{cityChoice===OTHER_CITY&&<><input name="cityOther" required minLength={2} value={customCity} onChange={event=>{setCustomCity(event.target.value);setFieldErrors(current=>({...current,cityOther:''}));}} placeholder={tr(lang,'مثال: مدينة الملك عبدالله الاقتصادية','Example: King Abdullah Economic City')} data-testid="input-branch-city-other"/><FieldMessage message={fieldErrors.cityOther}/></>}</div>
           <label className="field-label">{tr(lang,'العنوان المختصر','Short address')}<input name="address" value={branchAddress} onChange={event=>setBranchAddress(event.target.value)} placeholder={tr(lang,'مثال: شارع الأمير سلطان، حي الروضة','Example: Prince Sultan Street, Al Rawdah')} data-testid="input-branch-address"/></label>
        </div>
        <div className="field-label branch-maps-field">
          <span className="field-label-caption">{tr(lang,'موقع الفرع على خرائط Google','Google Maps location')}</span>
           <input name="googleMapsUrl" type="url" value={googleMapsUrl} onChange={event=>{setGoogleMapsUrl(event.target.value);setFieldErrors(current=>({...current,googleMapsUrl:''}));setLocationError('');}} required={!editing||Boolean(editing.googleMapsUrl)} placeholder="https://maps.app.goo.gl/..." aria-invalid={!!fieldErrors.googleMapsUrl} data-testid="input-branch-google-maps-url"/>
           <FieldMessage message={fieldErrors.googleMapsUrl}/>
          <small className="branch-map-help">{tr(lang,'افتحي الخرائط، اختاري الموقع، ثم انسخي رابط المشاركة والصقيه هنا.','Open Maps, choose the location, then paste its share link here.')}</small>
          <a className="branch-map-picker" href={googleMapsSearchUrl(branchCity,branchAddress)} target="_blank" rel="noreferrer" data-testid="link-open-google-maps-picker"><MapPinned size={16}/>{tr(lang,'اختيار الموقع على خرائط Google','Choose location in Google Maps')}<ArrowUpRight size={14}/></a>
           <FieldMessage message={locationError}/>
        </div>
        <label className="premium-checkbox"><input type="checkbox" name="active" defaultChecked={editing?.active??true} data-testid="checkbox-branch-active"/><span className="premium-checkbox-mark" aria-hidden="true"><Check size={13}/></span><span>{tr(lang,'الفرع نشط','Branch is active')}</span></label>
        {(create.isError||update.isError)&&<p className="inline-error" role="alert">{tr(lang,'تعذر حفظ الفرع. تحقق من البيانات وحاول مرة أخرى.','Could not save branch. Check the details and try again.')}</p>}
        <div className="form-actions modal-primary-actions"><Button type="submit" disabled={create.isPending||update.isPending} data-testid="button-save-branch">{create.isPending||update.isPending?tr(lang,'جارٍ الحفظ…','Saving…'):tr(lang,'حفظ الفرع','Save branch')}</Button></div>
      </form>
    </Modal>}
    <AlertDialog open={!!deactivating} onOpenChange={open=>{if(!open)setDeactivating(null);}}><AlertDialogContent className="confirm-dialog"><AlertDialogHeader><AlertDialogTitle>{tr(lang,'تأكيد إيقاف الفرع','Confirm branch deactivation')}</AlertDialogTitle><AlertDialogDescription>{tr(lang,`قد يؤثر إيقاف «${deactivating?.name||''}» في استقبال البلاغات الجديدة والإسناد التلقائي. سيبقى سجل البلاغات الحالي محفوظاً.`,`Deactivating “${deactivating?.name||''}” may affect new tickets and automatic assignment. Existing ticket history will remain.`)}</AlertDialogDescription></AlertDialogHeader>{update.isError&&<p className="inline-error" role="alert">{tr(lang,'تعذر إيقاف الفرع. حاول مرة أخرى.','Could not deactivate the branch. Try again.')}</p>}<AlertDialogFooter><AlertDialogCancel disabled={update.isPending}>{tr(lang,'إلغاء','Cancel')}</AlertDialogCancel><AlertDialogAction className="branch-confirm-action" disabled={update.isPending} onClick={event=>{event.preventDefault();if(deactivating)toggleActive(deactivating,false);}} data-testid="button-confirm-deactivate">{update.isPending?tr(lang,'جارٍ الإيقاف…','Deactivating…'):tr(lang,'تأكيد الإيقاف','Confirm deactivation')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
function KnowledgePage({lang}:{lang:Lang}) {
  const [search,setSearch]=useState('');const [category,setCategory]=useState('');const [branchId,setBranchId]=useState('');
  const {data:branches}=useListBranches();
  const {data:entries,isLoading,isError,refetch}=useListKnowledge({category:category||undefined,branchId:branchId||undefined});
  const safeBranches = Array.isArray(branches) && branches.length > 0 ? branches : (FALLBACK_BRANCHES as unknown as Branch[]);
  const safeEntries = Array.isArray(entries) && entries.length > 0 ? entries : (FALLBACK_KNOWLEDGE as unknown as KnowledgeEntry[]);
  const filtered=safeEntries.filter(k=>`${k.title || ''} ${k.ticketNumber || ''} ${k.branchName || ''} ${k.technicianName || ''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'الإصلاحات المؤكدة · مرجع الفريق','CONFIRMED REPAIRS / REFERENCE')} title={tr(lang,'قاعدة المعرفة','Knowledge base')} description={tr(lang,'حلول مؤكدة من أعمال الفريق، لتكون الإصلاحات القادمة أسرع.','Confirmed team solutions to make future repairs faster.')}/>
    <div className="knowledge-intro"><span className="knowledge-symbol"><BookOpen size={23}/></span><div><b>{tr(lang,'معرفة من العمل الحقيقي','Knowledge from real work')}</b><p>{tr(lang,'تظهر هنا الإصلاحات بعد تأكيد نجاحها من المبلّغ.','Repairs appear here after the reporter confirms they worked.')}</p></div><span className="knowledge-count">{safeEntries.length}<small>{tr(lang,'حل موثق','documented fixes')}</small></span></div>
     <div className="filter-bar"><label className="search-field"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr(lang,'ابحث في الحلول أو الفروع','Search solutions or branches')}/></label><div className="filter-select"><Filter size={16}/><TadarukSelect value={category} onValueChange={setCategory} ariaLabel={tr(lang,'تصفية حسب الفئة','Filter by category')} dir={lang==='ar'?'rtl':'ltr'} options={[{value:'',label:tr(lang,'كل الفئات','All categories')},...Array.from(new Set(safeEntries.map(e=>e.category).filter(Boolean))).map(value=>({value,label:value}))]}/></div><div className="filter-select"><Building2 size={16}/><TadarukSelect value={branchId} onValueChange={setBranchId} ariaLabel={tr(lang,'تصفية حسب الفرع','Filter by branch')} dir={lang==='ar'?'rtl':'ltr'} options={[{value:'',label:tr(lang,'كل الفروع','All branches')},...safeBranches.map(branch=>({value:branch.id,label:branch.name}))]}/></div></div>
    {isLoading?<State title={tr(lang,'جاري تحميل المعرفة','Loading knowledge base')} loading/>:isError?<State title={tr(lang,'تعذر تحميل قاعدة المعرفة','Could not load knowledge base')} retry={()=>void refetch()}/>:filtered.length?<div className="knowledge-list">{filtered.map((entry:KnowledgeEntry,i)=><article className="knowledge-entry" key={entry.id}><span className="knowledge-index">{String(i+1).padStart(2,'0')}</span><div className="knowledge-entry-content"><div className="entry-tags"><span>{entry.category}</span><span>{entry.branchName}</span></div><h3>{entry.title}</h3><div className="entry-solution">{entry.cause&&<p><b>{tr(lang,'السبب','Cause')}</b>{entry.cause}</p>}{entry.resolution&&<p><b>{tr(lang,'الإجراء','Action taken')}</b>{entry.resolution}</p>}</div><div className="entry-foot"><span><UserRound size={14}/>{entry.technicianName}</span><span>{entry.createdAt ? dateText(entry.createdAt,lang) : tr(lang, 'مؤخراً', 'Recently')}</span><Link href={`/workspace/tickets/${entry.ticketId}`}>{tr(lang,'البلاغ','Ticket')} {entry.ticketNumber}<ArrowUpRight size={14}/></Link></div></div><CheckCircle2 className="knowledge-check" size={20}/></article>)}</div>:<div className="empty-panel" aria-live="polite"><BookOpen size={25}/><h3>{entries?.length?tr(lang,'لا توجد نتائج مطابقة','No matching results'):tr(lang,'لا توجد حلول مؤكدة بعد','No confirmed fixes yet')}</h3><p>{tr(lang,'تُضاف الحلول تلقائياً عند تأكيد إغلاق البلاغ.','Solutions are added when a reporter confirms a repair.')}</p></div>}
  </div>;
}
function Modal({title,children,close,description,dir}:{title:string;children:ReactNode;close:()=>void;description?:string;dir?:'rtl'|'ltr'}) {
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="modal-card modal-radix" dir={dir}><DialogHeader className="modal-head"><DialogTitle>{title}</DialogTitle>{description&&<DialogDescription>{description}</DialogDescription>}</DialogHeader>{children}</DialogContent></Dialog>;
}
function WorkspaceRouter({lang,setLang,dark,setDark}:{lang:Lang;setLang:(x:Lang)=>void;dark:boolean;setDark:(x:boolean)=>void}) {
  const {data:session}=useGetDemoSession();const user=session?.user;const [location]=useLocation();
  const branchQuery=useListReporterBranches({query:{enabled:user?.role==='reporter',queryKey:getListReporterBranchesQueryKey()}});
  const reporterBranches=(Array.isArray(branchQuery.data) && branchQuery.data.length > 0) ? branchQuery.data : (FALLBACK_REPORTER_BRANCHES as unknown as ReporterBranch[]);
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
  const normalizedLocation=location.replace(/\/+$/,'')||'/';
  const title=normalizedLocation==='/workspace'
    ?user?.role==='manager'?tr(lang,'نظرة عامة','Overview'):user?.role==='technician'?tr(lang,'مهامي','My tasks'):tr(lang,'الرئيسية','Home')
    :normalizedLocation==='/workspace/tickets/new'?tr(lang,'بلاغ جديد','New report')
      :normalizedLocation==='/workspace/tickets'?tr(lang,'البلاغات','Tickets')
        :normalizedLocation.startsWith('/workspace/tickets/')?tr(lang,'تفاصيل البلاغ','Ticket details')
          :normalizedLocation==='/workspace/technicians'?tr(lang,'الفنيون','Technicians')
            :normalizedLocation==='/workspace/branches'?tr(lang,'الفروع','Branches')
              :normalizedLocation==='/workspace/knowledge'?tr(lang,'قاعدة المعرفة','Knowledge base')
                :tr(lang,'مساحة العمل','Workspace');
  return <ReporterBranchContext.Provider value={{branches:reporterBranches,selectedBranchId,selectBranch,status:branchStatus}}>
    <WorkspaceShell title={title} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>
      <Switch>
        <Route path="/workspace">{user?user.role==='reporter'?<ReporterHomePage lang={lang} user={user}/>:<OverviewPage lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</Route>
        <Route path="/workspace/tickets/new">{user?.role==='reporter'?<ReporterNewTicketPage lang={lang} user={user} selectedBranchId={selectedBranchId}/>:user?<State title={tr(lang,'إنشاء البلاغات متاح للمبلّغ فقط','Only reporters can create tickets')}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</Route>
        <Route path="/workspace/tickets/:ticketId">{user?<TicketDetail lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</Route>
        <Route path="/workspace/tickets">{user?user.role==='reporter'?<ReporterTicketsPage lang={lang} user={user}/>:<TicketsPage lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</Route>
        <Route path="/workspace/technicians">{user?.role==='manager'?<TechniciansPage lang={lang}/>:<State title={tr(lang,'متاح لمدير العمليات فقط','Only available for operations manager')}/>}</Route>
        <Route path="/workspace/branches">{user?.role==='manager'?<BranchesPage lang={lang}/>:<State title={tr(lang,'متاح لمدير العمليات فقط','Only available for operations manager')}/>}</Route>
        <Route path="/workspace/knowledge">{user?.role==='manager'?<KnowledgePage lang={lang}/>:<State title={tr(lang,'متاح لمدير العمليات فقط','Only available for operations manager')}/>}</Route>
        <Route component={NotFound}/>
      </Switch>
    </WorkspaceShell>
  </ReporterBranchContext.Provider>;
}
function AppRoutes() {
  const prefs=usePrefs();
  const [location]=useLocation();
  useEffect(()=>{
    const messageFor=(control:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement)=>{
      const validity=control.validity;
      if(validity.valueMissing)return tr(prefs.lang,'هذا الحقل مطلوب.','This field is required.');
      if(validity.typeMismatch&&control instanceof HTMLInputElement&&control.type==='url')return tr(prefs.lang,'أدخل رابطاً صحيحاً.','Enter a valid link.');
      if(validity.typeMismatch&&control instanceof HTMLInputElement&&control.type==='email')return tr(prefs.lang,'أدخل بريداً إلكترونياً صحيحاً.','Enter a valid email address.');
      if(validity.tooShort)return tr(prefs.lang,'أدخل قيمة أطول.','Enter a longer value.');
      if(validity.tooLong)return tr(prefs.lang,'اختصر القيمة قليلاً.','Shorten this value.');
      if(validity.patternMismatch)return tr(prefs.lang,'اكتب القيمة بالتنسيق الموضح.','Use the format shown.');
      return tr(prefs.lang,'تحقق من هذه القيمة.','Check this value.');
    };
    const onInvalid=(event:Event)=>{
      event.preventDefault();
      const control=event.target;
      if(!(control instanceof HTMLInputElement||control instanceof HTMLTextAreaElement||control instanceof HTMLSelectElement))return;
      const field=control.closest<HTMLElement>('.field-label,.rw-field')||control.parentElement;
      if(!field)return;
      control.setAttribute('aria-invalid','true');
      let error=field.querySelector<HTMLElement>(':scope > .tadaruk-native-field-error');
      if(!error){
        error=document.createElement('p');
        error.className='tadaruk-field-error tadaruk-native-field-error';
        error.setAttribute('role','alert');
        error.setAttribute('aria-live','polite');
        const icon=document.createElement('span');
        icon.className='tadaruk-field-error-icon';
        icon.setAttribute('aria-hidden','true');
        icon.textContent='!';
        const copy=document.createElement('span');
        copy.className='tadaruk-field-error-copy';
        error.append(icon,copy);
        field.append(error);
      }
      const copy=error.querySelector('.tadaruk-field-error-copy');
      if(copy)copy.textContent=messageFor(control);
    };
    const clearError=(event:Event)=>{
      const control=event.target;
      if(!(control instanceof HTMLInputElement||control instanceof HTMLTextAreaElement||control instanceof HTMLSelectElement))return;
      if(!control.validity.valid)return;
      control.removeAttribute('aria-invalid');
      const field=control.closest<HTMLElement>('.field-label,.rw-field')||control.parentElement;
      field?.querySelectorAll('.tadaruk-native-field-error').forEach(error=>error.remove());
    };
    document.addEventListener('invalid',onInvalid,true);
    document.addEventListener('input',clearError,true);
    document.addEventListener('change',clearError,true);
    return ()=>{
      document.removeEventListener('invalid',onInvalid,true);
      document.removeEventListener('input',clearError,true);
      document.removeEventListener('change',clearError,true);
    };
  },[prefs.lang]);
  const path=location.replace(/\/+$/,'')||'/';
  const workspaceRoutes=['/workspace','/workspace/tickets','/workspace/tickets/new','/workspace/technicians','/workspace/branches','/workspace/knowledge'];
  const isTicketDetail=/^\/workspace\/tickets\/[^/]+$/.test(path)&&path!=='/workspace/tickets/new';
  if(workspaceRoutes.includes(path)||isTicketDetail)return <WorkspaceRouter {...prefs}/>;
  return <Switch><Route path="/"><Landing lang={prefs.lang} setLang={prefs.setLang} dark={prefs.dark} setDark={prefs.setDark}/></Route><Route path="/demo"><DemoPage lang={prefs.lang} setLang={prefs.setLang} dark={prefs.dark} setDark={prefs.setDark}/></Route><Route component={NotFound}/></Switch>;
}
function App() { return <QueryClientProvider client={qc}><AppRoutes/></QueryClientProvider>; }
export default App;
