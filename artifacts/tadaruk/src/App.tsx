import { type ReactNode, type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Route, Switch, Link, useLocation, useParams } from 'wouter';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Activity, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Building2, Check,
  CheckCircle2, ChevronDown, ClipboardList, Clock3, Filter, Languages, LayoutDashboard,
  MapPin, Menu, Moon, Plus, Search, Settings2, ShieldCheck, Sun, Users, Wrench, X, CircleAlert,
  Sparkles, LogOut, Camera, Send, UserRound, RotateCcw, ChevronLeft, LoaderCircle,
  Mic, Square
} from 'lucide-react';
import {
  useHealthCheck, useListDemoUsers, useGetDemoSession, useSelectDemoAccount, useGetOverview,
  useAnalyzeTicket, useListTickets, useCreateTicket, useGetTicket, usePerformTicketAction,
  useListBranches, useCreateBranch, useUpdateBranch, useListTechnicians, useCreateTechnician,
  useUpdateTechnician, useListKnowledge, getGetDemoSessionQueryKey, getGetOverviewQueryKey,
  getListTicketsQueryKey, getGetTicketQueryKey, getListBranchesQueryKey, getListTechniciansQueryKey,
  getListKnowledgeQueryKey,
  type DemoUser, type Ticket, type TicketAnalysis, type TicketPriority,
  type Branch, type Technician, type KnowledgeEntry
} from '@workspace/api-client-react';
import NotFound from '@/pages/not-found';
import './tadaruk.css';
import './tadaruk-interactions.css';

const qc = new QueryClient();
type Lang = 'ar' | 'en';
const tr = (lang: Lang, ar: string, en: string) => lang === 'ar' ? ar : en;
const roleText = (role?: string, lang: Lang = 'ar') => {
  const roles: Record<string, [string,string]> = { manager:['مدير العمليات','Operations manager'], reporter:['المبلّغ','Reporter'], technician:['الفني','Technician'] };
  return roles[role || '']?.[lang === 'ar' ? 0 : 1] || '';
};
const statusText = (status: string, lang: Lang) => {
  const m: Record<string,[string,string]> = {new:['جديد','New'],review:['قيد المراجعة','In review'],in_progress:['جاري العمل','In progress'],awaiting_confirmation:['بانتظار التأكيد','Awaiting confirmation'],closed:['مغلق','Closed']};
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
  const [active,setActive]=useState(false);const [seconds,setSeconds]=useState(0);const [error,setError]=useState('');
  const [bars,setBars]=useState<number[]>(()=>Array.from({length:18},()=>4));
  const recognition=useRef<SpeechRecognitionLike|null>(null);const stream=useRef<MediaStream|null>(null);
  const audioContext=useRef<AudioContext|null>(null);const frame=useRef<number|undefined>(undefined);
  const timer=useRef<number|undefined>(undefined);const releaseTimer=useRef<number|undefined>(undefined);const finalSegments=useRef<Set<string>>(new Set());
  const release=()=>{
    if(frame.current!==undefined)cancelAnimationFrame(frame.current);
    if(timer.current!==undefined)window.clearInterval(timer.current);
    if(releaseTimer.current!==undefined)window.clearTimeout(releaseTimer.current);
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
    if(audioContext.current){void audioContext.current.close();audioContext.current=null;}
    recognition.current=null;setActive(false);setBars(Array.from({length:18},()=>4));
  };
  useEffect(()=>()=>release(),[]);
  const stop=(cancel=false)=>{
    const current=recognition.current;
    try{
      if(cancel){current?.abort();release();}
      else if(current){current.stop();releaseTimer.current=window.setTimeout(release,1200);}
      else release();
    }catch{release();}
  };
  const start=async()=>{
    setError('');
    const speechWindow=window as Window&{SpeechRecognition?:SpeechRecognitionConstructor;webkitSpeechRecognition?:SpeechRecognitionConstructor;webkitAudioContext?:typeof AudioContext};
    const Speech=speechWindow.SpeechRecognition||speechWindow.webkitSpeechRecognition;
    if(!navigator.mediaDevices?.getUserMedia){setError(tr(lang,'المتصفح لا يدعم الوصول إلى الميكروفون.','This browser cannot access the microphone.'));return;}
    if(!Speech){setError(tr(lang,'التعرّف الصوتي غير متاح في هذا المتصفح. يمكنك الكتابة بدلاً منه.','Speech recognition is unavailable in this browser. You can type instead.'));return;}
    try{
      const liveStream=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=liveStream;
      const AudioContextCtor=window.AudioContext||speechWindow.webkitAudioContext;
      if(AudioContextCtor){
        const context=new AudioContextCtor();audioContext.current=context;
        const analyser=context.createAnalyser();analyser.fftSize=128;
        context.createMediaStreamSource(liveStream).connect(analyser);
        const samples=new Uint8Array(analyser.frequencyBinCount);
        const draw=()=>{analyser.getByteFrequencyData(samples);setBars(Array.from({length:18},(_,i)=>Math.max(4,Math.min(30,(samples[Math.floor(i*samples.length/18)]||0)/7))));frame.current=requestAnimationFrame(draw);};
        draw();
      }
      const recognizer=new Speech();recognition.current=recognizer;finalSegments.current.clear();
      recognizer.lang=lang==='ar'?'ar-SA':'en-US';recognizer.continuous=true;recognizer.interimResults=true;
      recognizer.onresult=(event)=>{
        const added:string[]=[];
        for(let i=event.resultIndex;i<event.results.length;i++){
          const result=event.results[i];const text=result[0]?.transcript?.trim();
          if(result.isFinal&&text){const key=`${i}:${text}`;if(!finalSegments.current.has(key)){finalSegments.current.add(key);added.push(text);}}
        }
        if(added.length)onTranscript(added.join(' '));
      };
      recognizer.onerror=(event)=>{setError(event.error==='not-allowed'?tr(lang,'يرجى السماح باستخدام الميكروفون.','Allow microphone access to record.'):tr(lang,'توقف التعرّف الصوتي. حاول مرة أخرى.','Speech recognition stopped. Try again.'));release();};
      recognizer.onend=()=>release();
      setSeconds(0);setActive(true);timer.current=window.setInterval(()=>setSeconds(value=>value+1),1000);recognizer.start();
    }catch{
      release();setError(tr(lang,'تعذر بدء التسجيل. تحقق من إذن الميكروفون.','Could not start recording. Check microphone permission.'));
    }
  };
  const clock=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  return <div className="voice-capture">
    <div className="voice-controls"><button type="button" className={`voice-button ${active?'voice-active':''}`} onClick={()=>active?stop():void start()} aria-pressed={active}>{active?<Square size={15}/>:<Mic size={16}/>}<span>{active?tr(lang,'إيقاف التسجيل','Stop recording'):tr(lang,'تسجيل وصف صوتي','Record a voice note')}</span></button>{active&&<><span className="voice-timer" aria-live="polite">{clock}</span><button type="button" className="voice-cancel" onClick={()=>stop(true)}>{tr(lang,'إلغاء','Cancel')}</button></>}</div>
    {active&&<div className="voice-wave" role="img" aria-label={tr(lang,'موجة صوتية مباشرة','Live audio waveform')}>{bars.map((height,index)=><i key={index} style={{height:`${height}px`}}/>)}</div>}
    {error&&<small className="voice-error" role="alert">{error}</small>}
    {active&&<small className="voice-hint">{tr(lang,'ستظهر الكلمات المكتملة في النص ويمكنك تعديلها.','Final words are added to the text, where you can edit them.')}</small>}
  </div>;
}
async function makePhotoPreview(file:File,lang:Lang):Promise<string> {
  if(!file.type.startsWith('image/'))throw new Error(tr(lang,'الصيغة غير مدعومة. اختر صورة.','Unsupported format. Choose an image.'));
  if(file.size>12*1024*1024)throw new Error(tr(lang,'حجم الصورة أكبر من 12 ميجابايت.','Image is larger than 12 MB.'));
  const bitmap=await createImageBitmap(file);const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
  const context=canvas.getContext('2d');if(!context){bitmap.close();throw new Error(tr(lang,'تعذر تجهيز الصورة.','Could not prepare the image.'));}
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return canvas.toDataURL('image/jpeg',.72);
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
  if (!tickets.length) return <div className="empty-inline"><ClipboardList size={23}/><b>{empty}</b><span>ستظهر البلاغات الجديدة هنا</span></div>;
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
function Landing({lang,setLang}:{lang:Lang;setLang:(x:Lang)=>void}) {
  const health=useHealthCheck();
  const reduced=useReducedMotion()===true || (typeof window!=='undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true);
  const copyTransition=(delay:number)=>reduced?{duration:0}:{duration:.58,delay,ease:[.22,.72,.18,1] as const};
  const labels=lang==='ar'?['بلاغ جديد','تحليل ذكي','إسناد للفني','تم الإصلاح']:['New report','Smart analysis','Technician assigned','Repair confirmed'];
  const benefits=lang==='ar'?['بلاغ أسرع','فرز ذكي','إسناد تلقائي','متابعة واضحة']:['Faster reports','Smart triage','Automatic assignment','Clear follow-up'];
  return <main className="landing" dir={lang==='ar'?'rtl':'ltr'}>
    <header className="landing-nav wrap"><div className="nav-actions"><button className="nav-lang" onClick={()=>setLang(lang==='ar'?'en':'ar')}><Languages size={16}/>{lang==='ar'?'English':'العربية'}</button><Button href="/demo" kind="outline">{tr(lang,'دخول التجربة','Open the demo')}<ArrowUpRight size={17}/></Button></div></header>
    <section className="hero wrap" aria-labelledby="landing-title">
      <div className="hero-mark-stage"><div className="mark-halo" aria-hidden="true"/><TadarukMark reduced={reduced}/></div>
      <div className="hero-copy">
        <motion.h1 id="landing-title" className={lang==='ar'?'display-ar':''} initial={reduced?false:{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={copyTransition(1.85)}>{tr(lang,'كل بلاغ يستحق أن يُتدارك','Every issue deserves a clear next step')}</motion.h1>
        <motion.p className="hero-sub" initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={copyTransition(2.08)}>{tr(lang,'بلّغ. تابع. وتدارك.','Report it. Follow through. Put it right.')}</motion.p>
      </div>
    </section>
    <section className="workflow-reveal wrap" id="how" aria-label={tr(lang,'مسار البلاغ','Report workflow')}>
      <motion.div className="workflow-heading" initial={reduced?false:{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.45}} transition={reduced?{duration:0}:{duration:.48,ease:[.22,.72,.18,1]}}>
        <span className="eyebrow">{tr(lang,'كيف يعمل','HOW IT WORKS')}</span>
        <h2 className={lang==='ar'?'display-ar':''}>{tr(lang,'من البلاغ إلى الإصلاح','From report to repair')}</h2>
      </motion.div>
      <motion.div className="workflow-rule" initial={reduced?false:{scaleX:0}} whileInView={{scaleX:1}} viewport={{once:true,amount:.55}} transition={reduced?{duration:0}:{duration:.8,ease:[.22,.72,.18,1]}}/>
      <div className="workflow-steps">{labels.map((label,index)=><motion.div className="workflow-step" key={label} initial={reduced?false:{opacity:0,y:13}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.55}} transition={reduced?{duration:0}:{duration:.48,delay:index*.11,ease:[.22,.72,.18,1]}}><span className="workflow-index">0{index+1}</span><span className="workflow-label">{label}</span></motion.div>)}</div>
    </section>
    <section className="landing-explain wrap" aria-labelledby="explain-title">
      <motion.div className="product-preview" initial={reduced?false:{opacity:0,y:18}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.3}} transition={reduced?{duration:0}:{duration:.55,ease:[.22,.72,.18,1]}} aria-label={tr(lang,'معاينة بلاغ صيانة','Maintenance report preview')}>
        <div className="preview-top"><span className="preview-overline">{tr(lang,'بلاغ صيانة','MAINTENANCE REPORT')}</span><span className="preview-state"><i/>{tr(lang,'قيد المتابعة','In progress')}</span></div>
        <div className="preview-ticket-title"><span className="preview-icon"><Wrench size={19}/></span><div><b>{tr(lang,'ضعف تبريد المكيف','Air conditioning issue')}</b><small>{tr(lang,'فرع النخيل · منطقة التحضير','Al Nakheel branch · Prep area')}</small></div></div>
        <div className="preview-progress"><span className="preview-progress-line"/><span className="preview-progress-step complete"><Check size={13}/></span><span className="preview-progress-step current"><i/></span><span className="preview-progress-step"/></div>
        <div className="preview-footer"><span className="preview-assignee"><span className="preview-avatar">س</span><span><b>{tr(lang,'سالم العتيبي','Salem Alotaibi')}</b><small>{tr(lang,'فني تكييف','Cooling technician')}</small></span></span><span className="preview-check"><CheckCircle2 size={18}/></span></div>
      </motion.div>
      <div className="explain-copy">
        <motion.div initial={reduced?false:{opacity:0,y:14}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.3}} transition={reduced?{duration:0}:{duration:.48,ease:[.22,.72,.18,1]}}>
          <span className="eyebrow">{tr(lang,'لماذا تدارك','WHY TADARUK')}</span>
          <h2 id="explain-title" className={lang==='ar'?'display-ar':''}>{tr(lang,'كل خطوة واضحة.','Every step, clear.')}</h2>
        </motion.div>
        <ul className="benefit-list">{benefits.map((item,index)=><motion.li key={item} initial={reduced?false:{opacity:0,x:lang==='ar'?10:-10}} whileInView={{opacity:1,x:0}} viewport={{once:true,amount:.3}} transition={reduced?{duration:0}:{duration:.4,delay:index*.07,ease:[.22,.72,.18,1]}}><span className="benefit-index">0{index+1}</span><span>{item}</span><ArrowLeft size={15}/></motion.li>)}</ul>
      </div>
    </section>
    <section className="landing-end wrap"><div><span className="eyebrow"><span className="live-dot"/>{health.isLoading?'جاري الاتصال':health.isError?'وضع العرض متاح':tr(lang,'جاهز للتجربة','READY TO EXPLORE')}</span><h2 className={lang==='ar'?'display-ar':''}>{tr(lang,'ابدأ من البلاغ القادم.','Start with the next report.')}</h2></div><Button href="/demo">{tr(lang,'استكشف تدارك','Explore Tadaruk')}<ArrowLeft size={17}/></Button></section>
    <footer className="landing-footer wrap"><Brand/><span>{tr(lang,'سجل واضح لصيانة أفضل.','A clearer record for better maintenance.')}</span><Link href="/demo">{tr(lang,'الدخول إلى العرض','Enter demo')}</Link></footer>
  </main>;
}
function DemoPage({lang}:{lang:Lang}) {
  const {data:users,isLoading,isError,refetch}=useListDemoUsers();
  const select=useSelectDemoAccount(); const [,go]=useLocation();
  const enter=(userId:string)=>select.mutate({data:{userId}},{onSuccess:()=>{void qc.invalidateQueries({queryKey:getGetDemoSessionQueryKey()});go('/workspace');}});
  return <main className="demo-page" dir={lang==='ar'?'rtl':'ltr'}><header className="demo-top"><Link href="/"><Brand/></Link><span>{tr(lang,'بيئة تجريبية آمنة','A guided demo environment')}</span></header><section className="demo-content fade-up"><div className="eyebrow"><span className="live-dot"/>TADARUK · {tr(lang,'تجربة','DEMO')}</div><h1 className={lang==='ar'?'display-ar':''}>{tr(lang,'اختر نقطة البداية','Choose your point of view')}</h1><p>{tr(lang,'ثلاثة أدوار، وسجل واحد يتابع البلاغ حتى إغلاقه.','Three roles, one record that follows a repair to closure.')}</p>
    {isLoading?<div className="role-grid"><div className="skeleton-card"/><div className="skeleton-card"/><div className="skeleton-card"/></div>:isError?<State title="تعذر تحميل الحسابات" detail="تحقق من اتصال الخدمة ثم حاول مجدداً" retry={()=>void refetch()}/>:<div className="role-grid">{(users||[]).map((user,index)=><button className={`role-card role-${user.role}`} key={user.id} onClick={()=>enter(user.id)} disabled={select.isPending} data-testid={`select-role-${user.role}`}><span className="role-card-top"><span className="role-index">0{index+1}</span><ArrowUpRight size={18}/></span><Avatar name={user.name} size="lg"/><span className="role-title">{roleText(user.role,lang)}</span><b>{user.name}</b><small>{user.branchName || tr(lang,'جميع الفروع','All branches')}{user.specialization?` · ${user.specialization}`:''}</small><span className="role-cta">{select.isPending?'جارٍ الدخول':tr(lang,'الدخول بهذا الحساب','Enter as this user')}<ArrowLeft size={15}/></span></button>)}</div>}
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
  useEffect(()=>{if(session && !user && window.location.pathname.startsWith('/workspace'))go('/demo');},[session,user,go]);
  if(!user)return <div className="workspace-loading"><div className="skeleton-bar"/><div className="skeleton-card"/></div>;
  const links=user.role==='manager'?[['/workspace','نظرة عامة','Overview',LayoutDashboard],['/workspace/tickets','البلاغات','Tickets',ClipboardList],['/workspace/technicians','الفنيون','Technicians',Users],['/workspace/branches','الفروع','Branches',Building2],['/workspace/knowledge','قاعدة المعرفة','Knowledge',BookOpen]]:user.role==='technician'?[['/workspace','مهامي','My tasks',Wrench],['/workspace/tickets','كل المهام','Tasks',ClipboardList]]:[['/workspace','الرئيسية','Home',LayoutDashboard],['/workspace/tickets/new','بلاغ جديد','New report',Plus],['/workspace/tickets','بلاغاتي','My reports',ClipboardList]];
  const active=(path:string)=>window.location.pathname===path;
  return <div className={`app-shell ${user.role==='reporter'?'reporter-shell':''}`} dir={lang==='ar'?'rtl':'ltr'}>
    <aside className={`sidebar ${mobile?'sidebar-open':''}`}><div className="side-brand"><Link href="/workspace"><Brand darkMode={dark}/></Link><button className="mobile-close" onClick={()=>setMobile(false)}><X size={18}/></button></div>
      <div className="branch-switch"><span className="branch-icon"><Building2 size={16}/></span><span><small>{tr(lang,'الموقع الحالي','CURRENT LOCATION')}</small><b>{user.branchName||tr(lang,'جميع الفروع','All branches')}</b></span><ChevronDown size={15}/></div>
      <nav className="side-nav">{links.map(([path,ar,en,Icon])=><Link key={path as string} href={path as string} onClick={()=>setMobile(false)} className={`side-link ${active(path as string)?'selected':''}`}><Icon size={19}/><span>{tr(lang,ar as string,en as string)}</span>{active(path as string)&&<span className="nav-active-mark"/>}</Link>)}</nav>
      <div className="side-bottom"><div className="side-help"><span><ShieldCheck size={17}/></span><b>{tr(lang,'كل شيء في مكانه','Everything in its place')}</b><small>{tr(lang,'سجل صيانة مشترك وواضح.','One clear, shared maintenance record.')}</small></div><div className="side-user"><Avatar name={user.name}/><span><b>{user.name}</b><small>{roleText(user.role,lang)}</small></span><button onClick={()=>setMenu(!menu)} aria-label={tr(lang,'قائمة الحساب','Account menu')}><ChevronDown size={16}/></button></div></div>
    </aside>
    {mobile&&<button className="mobile-scrim" onClick={()=>setMobile(false)} aria-label="close navigation"/>}
    <div className="main-frame"><header className="topbar"><div className="topbar-title"><button className="mobile-menu" onClick={()=>setMobile(true)}><Menu size={20}/></button><span>{title}</span></div><div className="top-controls"><button onClick={()=>setLang(lang==='ar'?'en':'ar')} className="icon-control" aria-label={tr(lang,'تغيير اللغة','Switch language')}><Languages size={18}/><span>{lang==='ar'?'EN':'ع'}</span></button><button onClick={()=>setDark(!dark)} className="icon-control" aria-label={tr(lang,'تغيير المظهر','Switch theme')}>{dark?<Sun size={18}/>:<Moon size={18}/>}</button><button className="top-avatar" onClick={()=>setMenu(!menu)} aria-label={tr(lang,'قائمة الحساب','Account menu')}><Avatar name={user.name} size="sm"/></button>
      {menu&&<div className="account-menu"><div className="account-menu-head"><b>{user.name}</b><small>{roleText(user.role,lang)}</small></div><Link href="/demo" onClick={()=>setMenu(false)}><RotateCcw size={15}/>{tr(lang,'تبديل الحساب التجريبي','Switch demo account')}</Link><Link href="/" onClick={()=>setMenu(false)}><LogOut size={15}/>{tr(lang,'العودة للرئيسية','Back to landing')}</Link></div>}
    </div></header><main className="workspace-content">{children}</main><footer className="workspace-footer">
      <Brand darkMode={dark}/>
      <span className="workspace-footer-divider" aria-hidden="true"/>
      <span className="workspace-footer-signature"><b>{tr(lang,'منصة تدارك للصيانة','TADARUK MAINTENANCE')}</b><small>{tr(lang,'بلاغ واضح. متابعة موثّقة.','Clear reports. Confirmed follow-through.')}</small></span>
      <span className="workspace-footer-meta">{tr(lang,'سجل الصيانة التشغيلي','MAINTENANCE OPERATIONS')}</span>
    </footer></div>
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
    {manager?<><div className="overview-grid"><div className="metric-lead"><span className="metric-label">{tr(lang,'البلاغات المفتوحة','Open tickets')}</span><strong>{overview?.openTickets??0}</strong><span className="metric-foot"><Activity size={15}/>{tr(lang,'حالة الفروع الآن','Current branch status')}</span><div className="metric-decoration"><span/><span/><span/><span/><span/></div></div><div className="metric-card"><span>{tr(lang,'طارئة','Urgent')}</span><strong>{overview?.urgentTickets??0}</strong><small>{tr(lang,'تحتاج إلى متابعة سريعة','Needs prompt follow-up')}</small></div><div className="metric-card"><span>{tr(lang,'بانتظار الإسناد','Awaiting assignment')}</span><strong>{overview?.pendingAssignment??0}</strong><small>{tr(lang,'لا يوجد فني متاح حالياً','No technician is available')}</small></div><div className="metric-card"><span>{tr(lang,'بانتظار التأكيد','Awaiting confirmation')}</span><strong>{overview?.awaitingConfirmation??0}</strong><small>{tr(lang,'تنتظر المبلّغ','Waiting on reporter')}</small></div></div>
      <div className="dashboard-columns"><section className="panel activity-panel"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,'سجل البلاغات المباشر','LIVE REGISTER')}</span><h2>{tr(lang,'آخر البلاغات','Recent tickets')}</h2></div><Link href="/workspace/tickets" className="text-link">{tr(lang,'كل البلاغات','All tickets')} <ArrowLeft size={15}/></Link></div><TicketList tickets={overview?.recentTickets||[]} lang={lang}/></section><aside className="ops-aside"><section className="resolved-callout"><span className="callout-symbol"><Check size={19}/></span><small>{tr(lang,'هذا الشهر','This month')}</small><strong>{overview?.resolvedThisMonth??0}</strong><b>{tr(lang,'إصلاحاً مؤكداً','Confirmed repairs')}</b><p>{tr(lang,'كل حل موثق يجعل الاستجابة التالية أذكى.','A documented fix helps the team respond faster next time.')}</p></section><section className="quick-links"><span className="eyebrow">{tr(lang,'إدارة العمليات','OPERATIONS')}</span><Link href="/workspace/technicians"><Users size={17}/>{tr(lang,'الفنيون','Technicians')} <ArrowLeft size={14}/></Link><Link href="/workspace/branches"><Building2 size={17}/>{tr(lang,'الفروع','Branches')} <ArrowLeft size={14}/></Link><Link href="/workspace/knowledge"><BookOpen size={17}/>{tr(lang,'قاعدة المعرفة','Knowledge base')} <ArrowLeft size={14}/></Link></section></aside></div></>:<div className="personal-layout"><section className="personal-feature"><div className="personal-feature-copy"><span className="eyebrow">{tech?tr(lang,'قائمة المهام','TASK QUEUE'):tr(lang,'صيانة أوضح','MAINTENANCE, MADE SIMPLE')}</span><h2 className={lang==='ar'?'display-ar':''}>{tech?tr(lang,'ما الذي يحتاج إليك الآن؟','What needs your attention?'):tr(lang,'بلاغك يصل إلى الشخص المناسب.','Your report reaches the right person.')}</h2><p>{tech?tr(lang,'البلاغات المسندة إليك مرتبة لتبدأ العمل دون بحث.','Your assigned tickets are organized so you can get started.'):tr(lang,'وصف واضح كافٍ. سنرتب البلاغ ونتابعه معك.','A clear description is enough. We will route and track the report.')}</p><Button href={tech?'/workspace/tickets':'/workspace/tickets/new'} kind="outline">{tech?tr(lang,'افتح قائمة المهام','Open task list'):tr(lang,'ابدأ بلاغاً جديداً','Create a report')}<ArrowLeft size={16}/></Button></div><div className="feature-mark"><Wrench size={34}/><span/></div></section><section className="panel personal-tickets"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,tech?'مسندة إليك':'بلاغاتي',tech?'ASSIGNED TO YOU':'YOUR REPORTS')}</span><h2>{tech?tr(lang,'المهام الأخيرة','Recent tasks'):tr(lang,'بلاغاتي الأخيرة','Recent reports')}</h2></div><Link href="/workspace/tickets" className="text-link">{tr(lang,'عرض الكل','View all')} <ArrowLeft size={15}/></Link></div><TicketList tickets={own} lang={lang} empty={tech?tr(lang,'لا توجد مهام مسندة إليك','No tasks assigned to you'):tr(lang,'لم ترسل بلاغاً بعد','You have not submitted a report yet')}/></section></div>}
  </div>;
}
function TicketsPage({lang,user}:{lang:Lang;user:DemoUser}) {
  const [search,setSearch]=useState('');const [status,setStatus]=useState('');const params=useMemo(()=>({search:search||undefined,status:status||undefined}),[search,status]);
  const {data:tickets,isLoading,isError,refetch}=useListTickets(params);
  const empty=search||status?tr(lang,'لا توجد نتائج مطابقة','No matching reports'):user.role==='reporter'?tr(lang,'لم ترسل بلاغاً بعد','You have not submitted a report yet'):tr(lang,'لا توجد بلاغات هنا بعد','No tickets here yet');
  const title=user.role==='reporter'?tr(lang,'بلاغاتي','My reports'):user.role==='technician'?tr(lang,'المهام المسندة','Assigned tasks'):tr(lang,'سجل البلاغات','Ticket register');
  const description=user.role==='reporter'?tr(lang,'تابع البلاغات التي أرسلتها وحالة كل منها.','Track the reports you submitted and their current status.'):user.role==='manager'?tr(lang,'تابع الحالة، الأولوية، والمسؤول عن كل بلاغ.','Track status, priority, and ownership for each ticket.'):tr(lang,'كل مهمة مسندة إليك في سجل واحد.','All tasks assigned to you in one register.');
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'سجل البلاغات','MAINTENANCE REGISTER')} title={title} description={description}/>
    <div className="filter-bar"><label className="search-field"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr(lang,'ابحث برقم البلاغ أو العنوان','Search ticket number or title')} data-testid="input-ticket-search"/></label><label className="filter-select"><Filter size={16}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">{tr(lang,'كل الحالات','All statuses')}</option><option value="new">{tr(lang,'جديد','New')}</option><option value="review">{tr(lang,'قيد المراجعة','In review')}</option><option value="in_progress">{tr(lang,'جاري العمل','In progress')}</option><option value="awaiting_confirmation">{tr(lang,'بانتظار التأكيد','Awaiting confirmation')}</option><option value="closed">{tr(lang,'مغلق','Closed')}</option></select></label></div>
     {isLoading?<State title={tr(lang,'جاري تحميل البلاغات','Loading tickets')} loading/>:isError?<State title={tr(lang,'تعذر تحميل السجل','Could not load ticket register')} retry={()=>void refetch()}/>:<section className="panel register-panel"><div className="register-header"><span>{tr(lang,'البلاغ / الفرع','Ticket / Branch')}</span><span>{tr(lang,'الأولوية','Priority')}</span><span>{tr(lang,'الحالة','Status')}</span><span>{tr(lang,'تاريخ الإرسال','Submitted')}</span><span/></div><TicketList tickets={tickets||[]} lang={lang} empty={empty}/></section>}
  </div>;
}
function NewTicketPage({lang,user}:{lang:Lang;user:DemoUser}) {
  const [description,setDescription]=useState('');const [location,setLocation]=useState('');const [imageUrl,setImageUrl]=useState('');const [analysis,setAnalysis]=useState<TicketAnalysis|null>(null);
  const [photoError,setPhotoError]=useState('');
  const analyze=useAnalyzeTicket();const create=useCreateTicket();const [,go]=useLocation();const query=useQueryClient();
  const handleAnalyze=(e:FormEvent)=>{e.preventDefault();analyze.mutate({data:{description,location}},{onSuccess:setAnalysis});};
  const readPhoto=async(file?:File)=>{if(!file)return;setPhotoError('');try{setImageUrl(await makePhotoPreview(file,lang));}catch(error){setPhotoError(error instanceof Error?error.message:tr(lang,'تعذر تجهيز الصورة.','Could not prepare the image.'));}};
  const appendTranscript=(text:string)=>setDescription(current=>current?`${current.trimEnd()} ${text}`:text);
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const fd=new FormData(e.currentTarget);create.mutate({data:{title:String(fd.get('title')),description:String(fd.get('description')),category:String(fd.get('category')),priority:String(fd.get('priority')) as TicketPriority,specialization:String(fd.get('specialization')),location:String(fd.get('location')),imageUrl:null}},{onSuccess:t=>{if(imageUrl){try{localStorage.setItem(`tadaruk-photo:${t.id}`,imageUrl);}catch{setPhotoError(tr(lang,'حُفظ البلاغ، لكن تعذر حفظ الصورة في هذا المتصفح.','The ticket was saved, but this browser could not keep the photo.'));}}void query.invalidateQueries({queryKey:getListTicketsQueryKey()});void query.invalidateQueries({queryKey:getGetOverviewQueryKey()});go(`/workspace/tickets/${t.id}`);}});};
  return <div className="page-enter"><PageTitle eyebrow="NEW MAINTENANCE REPORT" title={tr(lang,'بلاغ جديد','New report')} description={`${tr(lang,'الفرع','Branch')}: ${user.branchName||tr(lang,'يحدد من حسابك','Set by your account')}`} action={<span className="step-counter">{tr(lang,'الخطوة','Step')} {analysis?'2':'1'} {tr(lang,'من ٢','of 2')}</span>}/>
    {!analysis?<form className="report-form panel" onSubmit={handleAnalyze}><div className="form-intro"><span className="form-icon"><ClipboardList size={21}/></span><div><h2>{tr(lang,'ما المشكلة التي لاحظتها؟','What issue did you notice?')}</h2><p>{tr(lang,'صف ما يحدث كما تراه. لا حاجة لتحديد الفني أو الأولوية.','Describe what you see. You do not need to choose a technician or priority.')}</p></div></div>
      <label className="field-label">{tr(lang,'وصف المشكلة','Describe the problem')} <span>{tr(lang,'مطلوب','Required')}</span><textarea required minLength={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder={tr(lang,'مثال: المكيف في منطقة التحضير يعمل لكن الهواء غير بارد...','Example: The prep-area AC runs, but the air is not cold...')} rows={5} data-testid="input-report-description"/></label>
      <VoiceRecorder lang={lang} onTranscript={appendTranscript}/>
      <div className="form-two"><label className="field-label">{tr(lang,'الموقع داخل الفرع','Location in branch')}<input required value={location} onChange={e=>setLocation(e.target.value)} placeholder={tr(lang,'مثال: منطقة التحضير، بجوار المخزن','Example: prep area, beside the stockroom')} data-testid="input-report-location"/></label>
        <div className="field-label">{tr(lang,'صورة للمشكلة','Issue photo')} <span>{tr(lang,'اختياري','Optional')}</span><label className="upload-field"><Camera size={19}/><span>{imageUrl?tr(lang,'تمت إضافة الصورة','Photo added'):tr(lang,'ارفع صورة من جهازك','Upload a photo')}</span><input type="file" accept="image/*" onChange={e=>{const selected=e.currentTarget.files?.[0];e.currentTarget.value='';void readPhoto(selected);}} aria-label={tr(lang,'رفع صورة للمشكلة','Upload an issue photo')}/></label>{imageUrl&&<div className="photo-preview"><img src={imageUrl} alt={tr(lang,'معاينة صورة البلاغ','Report photo preview')}/><button type="button" onClick={()=>{setImageUrl('');setPhotoError('');}} aria-label={tr(lang,'إزالة الصورة','Remove photo')}><X size={15}/></button></div>}<small className="field-note">{tr(lang,'صورة التجربة تحفظ في هذا المتصفح فقط.','Demo photos are kept in this browser only.')}</small></div></div>
      {photoError&&<p className="inline-error" role="alert">{photoError}</p>}
      <div className="demo-disclaimer"><Sparkles size={16}/><span><b>{tr(lang,'تحليل تجريبي','Demo analysis')}</b> — {tr(lang,'تنظيم توضيحي للبلاغ، وليس ذكاءً اصطناعياً فعلياً.','Ticket organization only; this is not real AI.')}</span></div>
      {analyze.isError&&<p className="inline-error">{tr(lang,'تعذر إعداد التحليل. راجع الوصف وحاول مجدداً.','Could not prepare the suggestions. Check the description and retry.')}</p>}
      <div className="form-actions"><Button type="submit" disabled={description.trim().length<4||analyze.isPending}>{analyze.isPending?tr(lang,'جارٍ إعداد البلاغ...','Preparing report...'):tr(lang,'تنظيم البلاغ','Organize report')}<ArrowLeft size={17}/></Button><small>{tr(lang,'يمكنك مراجعة كل التفاصيل قبل الإرسال','Review all details before submitting')}</small></div>
    </form>:<form className="report-form panel review-form" onSubmit={submit}><div className="form-intro"><span className="form-icon"><CheckCircle2 size={22}/></span><div><h2>{tr(lang,'راجع تفاصيل البلاغ','Review report details')}</h2><p>{tr(lang,'يمكنك تعديل المقترحات قبل تأكيد البلاغ.','You can edit these suggestions before submitting.')}</p></div></div><div className="demo-disclaimer"><Sparkles size={16}/><span>{tr(lang,'اقتراحات تجريبية للتوضيح فقط — تحقق من التفاصيل.','Demo suggestions only — please verify the details.')}</span></div>
      <label className="field-label">{tr(lang,'عنوان البلاغ','Ticket title')}<input name="title" required defaultValue={analysis.title}/></label>
      <label className="field-label">{tr(lang,'الوصف','Description')}<textarea name="description" required defaultValue={analysis.description} rows={4}/></label>
      <div className="form-three"><label className="field-label">{tr(lang,'الفئة','Category')}<input name="category" required defaultValue={analysis.category}/></label><label className="field-label">{tr(lang,'الأولوية','Priority')}<select name="priority" defaultValue={analysis.priority}><option value="urgent">{tr(lang,'طارئ','Urgent')}</option><option value="high">{tr(lang,'عالٍ','High')}</option><option value="medium">{tr(lang,'متوسط','Medium')}</option><option value="low">{tr(lang,'منخفض','Low')}</option></select></label><label className="field-label">{tr(lang,'التخصص','Specialization')}<input name="specialization" required defaultValue={analysis.specialization}/></label></div>
      <label className="field-label">{tr(lang,'الموقع','Location')}<input name="location" required defaultValue={analysis.location||location}/></label>
      {create.isError&&<p className="inline-error">{tr(lang,'لم يتم إرسال البلاغ. حاول مرة أخرى.','Ticket was not submitted. Please try again.')}</p>}
       <div className="form-actions"><Button type="submit" disabled={create.isPending}>{create.isPending?tr(lang,'جارٍ الإرسال...','Submitting...'):tr(lang,'تأكيد وإرسال البلاغ','Confirm and submit')}<Send size={16}/></Button><Button kind="ghost" onClick={()=>setAnalysis(null)}>{tr(lang,'العودة للتعديل','Back to editing')}</Button></div>
    </form>}
  </div>;
}
function TicketDetail({lang,user}:{lang:Lang;user:DemoUser}) {
  const params=useParams<{ticketId:string}>();const id=params.ticketId||'';const {data:ticket,isLoading,isError,refetch}=useGetTicket(id,{query:{enabled:!!id,queryKey:getGetTicketQueryKey(id)}});
  const {data:technicians}=useListTechnicians({query:{enabled:user.role==='manager',queryKey:getListTechniciansQueryKey()}});
  const action=usePerformTicketAction();const query=useQueryClient();const [note,setNote]=useState('');const [cause,setCause]=useState('');const [resolution,setResolution]=useState('');
  const [localPhoto,setLocalPhoto]=useState(()=>localStorage.getItem(`tadaruk-photo:${id}`)||'');
  useEffect(()=>{setLocalPhoto(localStorage.getItem(`tadaruk-photo:${id}`)||'');},[id]);
  const [technicianId,setTechnicianId]=useState('');
  const act=(a:'start'|'complete'|'confirm'|'reject'|'reassign',extra:Record<string,string>={})=>action.mutate({ticketId:id,data:{action:a,note,...extra}},{onSuccess:()=>{void query.invalidateQueries({queryKey:getGetTicketQueryKey(id)});void query.invalidateQueries({queryKey:getListTicketsQueryKey()});void query.invalidateQueries({queryKey:getGetOverviewQueryKey()});void query.invalidateQueries({queryKey:getListKnowledgeQueryKey()});setNote('');}});
  if(isLoading)return <State title={tr(lang,'جاري فتح تفاصيل البلاغ','Loading ticket details')} loading/>;if(isError||!ticket)return <State title={tr(lang,'تعذر فتح البلاغ','Could not open ticket')} detail={tr(lang,'قد لا يكون هذا البلاغ متاحاً لحسابك.','This ticket may not be available to your account.')} retry={()=>void refetch()}/>;
  const manager=user.role==='manager',technician=user.role==='technician',reporter=user.role==='reporter';
  return <div className="page-enter"><div className="detail-back"><Link href="/workspace/tickets"><ArrowRight size={16}/>{tr(lang,'العودة إلى البلاغات','Back to tickets')}</Link><span>{ticket.number}</span></div>
     <div className="detail-layout"><section className="detail-main"><div className="panel detail-hero"><div className="detail-tags"><StatusBadge status={ticket.status} lang={lang}/><PriorityBadge priority={ticket.priority} lang={lang}/><span className="ticket-number">{ticket.number}</span></div><h1>{ticket.title}</h1><p className="detail-description">{ticket.description}</p><div className="detail-properties"><span><Building2 size={16}/>{ticket.branchName}</span><span><MapPin size={16}/>{ticket.location}</span><span><Wrench size={16}/>{tr(lang,'التخصص','Specialty')}: {classificationText(ticket.specialization,lang)}</span><span><ClipboardList size={16}/>{tr(lang,'التصنيف','Classification')}: {classificationText(ticket.category,lang)}</span><span><Clock3 size={16}/>{dateText(ticket.createdAt,lang)}</span></div>
       {(ticket.imageUrl||localPhoto)&&<img src={ticket.imageUrl||localPhoto} alt="صورة البلاغ" className="ticket-image"/>}
    </div>
     <section className="panel timeline-panel"><div className="panel-heading"><div><span className="eyebrow">{tr(lang,'سجل النشاط','ACTIVITY')}</span><h2>{tr(lang,'سجل المتابعة','Activity history')}</h2></div></div><div className="timeline">{(ticket.history||[]).map(ev=><div className="timeline-event" key={ev.id}><span className="timeline-dot"/><div><b>{ev.label}</b><small>{ev.actorName} · {dateText(ev.createdAt,lang)}</small>{ev.note&&<p>{ev.note}</p>}</div></div>)}</div></section>
      {(technician&&ticket.status==='in_progress'||technician&&ticket.status==='new')&&<section className="panel repair-panel"><span className="eyebrow">{tr(lang,'سجل الإصلاح','REPAIR RECORD')}</span><h2>{tr(lang,'وثّق ما أصلحته','Document the repair')}</h2><p>{tr(lang,'ملاحظاتك تساعد المبلّغ وتصبح معرفة للفريق عند إغلاق البلاغ.','Your notes help the reporter and become team knowledge after closure.')}</p><div className="form-two"><label className="field-label">{tr(lang,'السبب إن عُرف','Cause, if known')}<input value={cause} onChange={e=>setCause(e.target.value)} placeholder={tr(lang,'ما الذي أدى إلى المشكلة؟','What caused the issue?')}/></label><div className="field-label"><label htmlFor="repair-resolution">{tr(lang,'الحل والإجراء','Repair and action')}</label><textarea id="repair-resolution" value={resolution} onChange={e=>setResolution(e.target.value)} rows={3} placeholder={tr(lang,'ما الذي قمت به؟','What did you do?')}/><VoiceRecorder lang={lang} onTranscript={text=>setResolution(current=>current?`${current.trimEnd()} ${text}`:text)}/></div></div><label className="field-label">{tr(lang,'ملاحظة إضافية','Additional note')}<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2} placeholder={tr(lang,'معلومة للفريق أو للمبلّغ','A note for the team or reporter')}/></label></section>}
    </section>
     <aside className="detail-side"><section className="panel owner-panel"><span className="eyebrow">{tr(lang,'الإسناد','ASSIGNMENT')}</span><h3>{tr(lang,'الأشخاص','People')}</h3><div className="person-line"><Avatar name={ticket.reporterName} size="sm"/><span><small>{tr(lang,'المبلّغ','Reporter')}</small><b>{ticket.reporterName}</b></span></div><div className="person-line"><Avatar name={ticket.technicianName||tr(lang,'غير مسند','Unassigned')} size="sm"/><span><small>{tr(lang,'الفني المسؤول','Assigned technician')}</small><b>{ticket.technicianName||tr(lang,'بانتظار الإسناد','Awaiting assignment')}</b></span></div></section>
       {ticket.repairNotes&&<section className="panel resolution-panel"><span className="eyebrow">{tr(lang,'ملاحظات الإصلاح','REPAIR NOTES')}</span><h3>{tr(lang,'ملاحظات الإصلاح','Repair notes')}</h3><p>{ticket.repairNotes}</p>{ticket.cause&&<><small>{tr(lang,'السبب','Cause')}</small><p>{ticket.cause}</p></>}{ticket.resolution&&<><small>{tr(lang,'الإجراء','Action taken')}</small><p>{ticket.resolution}</p></>}</section>}
       <section className="action-panel"><span className="eyebrow">{tr(lang,'الخطوة التالية','NEXT STEP')}</span>
         {technician&&(ticket.status==='new'||ticket.status==='review')&&<Button onClick={()=>act('start')} disabled={action.isPending}><Wrench size={17}/>{tr(lang,'بدء العمل','Start work')}</Button>}
         {technician&&ticket.status==='in_progress'&&<Button onClick={()=>act('complete',{cause,resolution:resolution||note})} disabled={action.isPending||(!resolution&&!note)}><CheckCircle2 size={17}/>{tr(lang,'إرسال الإصلاح للتأكيد','Submit repair for confirmation')}</Button>}
          {reporter&&ticket.status==='awaiting_confirmation'&&<><p>{tr(lang,'هل تم إصلاح المشكلة بنجاح؟','Was the issue fixed successfully?')}</p><Button onClick={()=>act('confirm')} disabled={action.isPending}><Check size={17}/>{tr(lang,'نعم، تم الإصلاح','Yes, it is fixed')}</Button><Button kind="outline" onClick={()=>act('reject',{note})} disabled={action.isPending}>{tr(lang,'لا، ما زالت المشكلة قائمة','No, it is still happening')}</Button><label className="field-label">{tr(lang,'ملاحظة للفني','Note for technician')}<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}/></label></>}
         {manager&&<><p>{ticket.technicianName?tr(lang,`مسند إلى ${ticket.technicianName}`,`Assigned to ${ticket.technicianName}`):tr(lang,'البلاغ بانتظار الإسناد.','This ticket is awaiting assignment.')} {tr(lang,'يمكن تغيير المسؤول عند الحاجة.','You can change the assignee if needed.')}</p><label className="field-label">{tr(lang,'إعادة الإسناد إلى','Reassign to')}<select value={technicianId} onChange={e=>setTechnicianId(e.target.value)}><option value="">{tr(lang,'اختر فنياً','Choose a technician')}</option>{(technicians||[]).filter(t=>t.active&&t.branchId===ticket.branchId).map(t=><option key={t.id} value={t.id}>{t.name} · {t.specialization}</option>)}</select></label><Button kind="outline" onClick={()=>technicianId&&act('reassign',{technicianId})} disabled={!technicianId||action.isPending}><Users size={16}/>{tr(lang,'تحديث الإسناد','Update assignment')}</Button></>}
         {ticket.status==='closed'&&<div className="closed-note"><CheckCircle2 size={18}/>{tr(lang,'أُغلق البلاغ بعد تأكيد الإصلاح.','The ticket was closed after repair confirmation.')}</div>}
         {action.isError&&<p className="inline-error">{tr(lang,'تعذر تنفيذ الخطوة، يرجى المحاولة مجدداً.','Could not complete that step. Please try again.')}</p>}
      </section>
    </aside></div>
  </div>;
}
function TechniciansPage({lang}:{lang:Lang}) {
  const {data:techs,isLoading,isError,refetch}=useListTechnicians();const {data:branches}=useListBranches();const create=useCreateTechnician();const update=useUpdateTechnician();const query=useQueryClient();const [open,setOpen]=useState(false);const [edit,setEdit]=useState<Technician|null>(null);
  const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const data={name:String(f.get('name')),branchId:String(f.get('branchId')),specialization:String(f.get('specialization')),available:f.get('available')==='on'};
    const done=()=>{setOpen(false);setEdit(null);void query.invalidateQueries({queryKey:getListTechniciansQueryKey()});};
    edit?update.mutate({technicianId:edit.id,data},{onSuccess:done}):create.mutate({data},{onSuccess:done});};
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'الفريق الميداني','PEOPLE / FIELD TEAM')} title={tr(lang,'الفنيون','Technicians')} description={tr(lang,'توزيع واضح للمهارات والتوفر في كل فرع.','A clear view of skills and availability by branch.')} action={<Button onClick={()=>{setEdit(null);setOpen(true)}}><Plus size={17}/>{tr(lang,'إضافة فني','Add technician')}</Button>}/>
    {isLoading?<State title={tr(lang,'جاري تحميل الفريق','Loading team')} loading/>:isError?<State title={tr(lang,'تعذر تحميل الفنيين','Could not load technicians')} retry={()=>void refetch()}/>:!techs?.length?<div className="empty-panel"><Users size={26}/><h3>{tr(lang,'لا يوجد فنّيون مسجلون بعد','No technicians added yet')}</h3><p>{tr(lang,'أضف أعضاء فريق الصيانة لتسهيل إسناد البلاغات.','Add maintenance staff to make ticket assignment easier.')}</p><Button onClick={()=>setOpen(true)}><Plus size={17}/>{tr(lang,'إضافة أول فني','Add the first technician')}</Button></div>:<div className="people-grid">{techs.map(t=><article className="person-card" key={t.id}><div className="person-card-head"><Avatar name={t.name} size="lg"/><button className="edit-button" onClick={()=>{setEdit(t);setOpen(true)}} aria-label={`${tr(lang,'تعديل','Edit')} ${t.name}`}><Settings2 size={17}/></button></div><h3>{t.name}</h3><span className="specialization">{t.specialization}</span><div className="person-card-meta"><span><Building2 size={15}/>{t.branchName}</span><span><Activity size={15}/>{t.workload} {tr(lang,'مهام مفتوحة','open tasks')}</span></div><div className="person-card-bottom"><span className={`availability ${t.available&&t.active?'available':'unavailable'}`}><i/>{t.active?(t.available?tr(lang,'متاح','Available'):tr(lang,'غير متاح','Unavailable')):tr(lang,'غير نشط','Inactive')}</span><button onClick={()=>update.mutate({technicianId:t.id,data:{available:!t.available}},{onSuccess:()=>void query.invalidateQueries({queryKey:getListTechniciansQueryKey()})})} className="availability-toggle">{t.available?tr(lang,'تعيين غير متاح','Set unavailable'):tr(lang,'تعيين متاح','Set available')}</button></div></article>)}</div>}
    {open&&<Modal title={edit?tr(lang,'تعديل بيانات الفني','Edit technician'):tr(lang,'إضافة فني','Add technician')} close={()=>setOpen(false)}><form onSubmit={save}><label className="field-label">{tr(lang,'الاسم','Name')}<input name="name" required minLength={2} defaultValue={edit?.name}/></label><label className="field-label">{tr(lang,'الفرع','Branch')}<select name="branchId" required defaultValue={edit?.branchId||''}>{(branches||[]).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><label className="field-label">{tr(lang,'التخصص','Specialization')}<input name="specialization" required defaultValue={edit?.specialization} placeholder={tr(lang,'تكييف، كهرباء، سباكة','HVAC, electrical, plumbing')}/></label><label className="check-field"><input type="checkbox" name="available" defaultChecked={edit?.available??true}/> {tr(lang,'متاح لاستقبال المهام','Available for assignments')}</label><div className="form-actions"><Button type="submit" disabled={create.isPending||update.isPending}>{edit?tr(lang,'حفظ التعديلات','Save changes'):tr(lang,'إضافة الفني','Add technician')}</Button><Button kind="ghost" onClick={()=>setOpen(false)}>{tr(lang,'إلغاء','Cancel')}</Button></div></form></Modal>}
  </div>;
}
function BranchesPage({lang}:{lang:Lang}) {
  const {data:branches,isLoading,isError,refetch}=useListBranches();const create=useCreateBranch();const update=useUpdateBranch();const query=useQueryClient();const [modal,setModal]=useState(false);const [editing,setEditing]=useState<Branch|null>(null);
  const save=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const f=new FormData(e.currentTarget);const data={name:String(f.get('name')),city:String(f.get('city')),address:String(f.get('address')||'')};const done=()=>{setModal(false);setEditing(null);void query.invalidateQueries({queryKey:getListBranchesQueryKey()});};
    editing?update.mutate({branchId:editing.id,data},{onSuccess:done}):create.mutate({data},{onSuccess:done});};
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'المواقع والفروع','LOCATIONS / NETWORK')} title={tr(lang,'الفروع','Branches')} description={tr(lang,'مواقع العمل وحجم الصيانة المفتوح في كل فرع.','Locations and open maintenance volume by branch.')} action={<Button onClick={()=>{setEditing(null);setModal(true)}}><Plus size={17}/>{tr(lang,'إضافة فرع','Add branch')}</Button>}/>
    {isLoading?<State title={tr(lang,'جاري تحميل الفروع','Loading branches')} loading/>:isError?<State title={tr(lang,'تعذر تحميل الفروع','Could not load branches')} retry={()=>void refetch()}/>:<div className="branches-list">{(branches||[]).map((b,index)=><article className="branch-row" key={b.id}><span className="branch-sequence">0{index+1}</span><span className="branch-emblem"><Building2 size={21}/></span><span className="branch-name"><b>{b.name}</b><small>{b.city}{b.address?` · ${b.address}`:''}</small></span><span className="branch-open"><b>{b.openTickets}</b><small>{tr(lang,'بلاغات مفتوحة','open tickets')}</small></span><span className={`availability ${b.active?'available':'unavailable'}`}><i/>{b.active?tr(lang,'نشط','Active'):tr(lang,'غير نشط','Inactive')}</span><button className="edit-button" onClick={()=>{setEditing(b);setModal(true)}}>{tr(lang,'تعديل','Edit')}</button><button className="availability-toggle" onClick={()=>update.mutate({branchId:b.id,data:{active:!b.active}},{onSuccess:()=>void query.invalidateQueries({queryKey:getListBranchesQueryKey()})})}>{b.active?tr(lang,'إيقاف','Deactivate'):tr(lang,'تفعيل','Activate')}</button></article>)}{!branches?.length&&<div className="empty-panel">{tr(lang,'لا توجد فروع مسجلة بعد','No branches added yet')}</div>}</div>}
    {modal&&<Modal title={editing?tr(lang,'تعديل الفرع','Edit branch'):tr(lang,'إضافة فرع','Add branch')} close={()=>setModal(false)}><form onSubmit={save}><label className="field-label">{tr(lang,'اسم الفرع','Branch name')}<input name="name" required minLength={2} defaultValue={editing?.name}/></label><label className="field-label">{tr(lang,'المدينة','City')}<input name="city" required minLength={2} defaultValue={editing?.city}/></label><label className="field-label">{tr(lang,'العنوان','Address')}<input name="address" defaultValue={editing?.address}/></label><div className="form-actions"><Button type="submit" disabled={create.isPending||update.isPending}>{tr(lang,'حفظ الفرع','Save branch')}</Button><Button kind="ghost" onClick={()=>setModal(false)}>{tr(lang,'إلغاء','Cancel')}</Button></div></form></Modal>}
  </div>;
}
function KnowledgePage({lang}:{lang:Lang}) {
  const [search,setSearch]=useState('');const [category,setCategory]=useState('');const [branchId,setBranchId]=useState('');
  const {data:branches}=useListBranches();const {data:entries,isLoading,isError,refetch}=useListKnowledge({category:category||undefined,branchId:branchId||undefined});
  const filtered=(entries||[]).filter(k=>`${k.title} ${k.ticketNumber} ${k.branchName} ${k.technicianName}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="page-enter"><PageTitle eyebrow={tr(lang,'الإصلاحات المؤكدة · مرجع الفريق','CONFIRMED REPAIRS / REFERENCE')} title={tr(lang,'قاعدة المعرفة','Knowledge base')} description={tr(lang,'حلول مؤكدة من أعمال الفريق، لتكون الإصلاحات القادمة أسرع.','Confirmed team solutions to make future repairs faster.')}/>
    <div className="knowledge-intro"><span className="knowledge-symbol"><BookOpen size={23}/></span><div><b>{tr(lang,'معرفة من العمل الحقيقي','Knowledge from real work')}</b><p>{tr(lang,'تظهر هنا الإصلاحات بعد تأكيد نجاحها من المبلّغ.','Repairs appear here after the reporter confirms they worked.')}</p></div><span className="knowledge-count">{entries?.length||0}<small>{tr(lang,'حل موثق','documented fixes')}</small></span></div>
     <div className="filter-bar"><label className="search-field"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr(lang,'ابحث في الحلول أو الفروع','Search solutions or branches')}/></label><label className="filter-select"><Filter size={16}/><select value={category} onChange={e=>setCategory(e.target.value)}><option value="">{tr(lang,'كل الفئات','All categories')}</option>{Array.from(new Set((entries||[]).map(e=>e.category))).map(c=><option key={c} value={c}>{c}</option>)}</select></label><label className="filter-select"><Building2 size={16}/><select value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">{tr(lang,'كل الفروع','All branches')}</option>{(branches||[]).map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label></div>
    {isLoading?<State title={tr(lang,'جاري تحميل المعرفة','Loading knowledge base')} loading/>:isError?<State title={tr(lang,'تعذر تحميل قاعدة المعرفة','Could not load knowledge base')} retry={()=>void refetch()}/>:filtered.length?<div className="knowledge-list">{filtered.map((entry:KnowledgeEntry,i)=><article className="knowledge-entry" key={entry.id}><span className="knowledge-index">{String(i+1).padStart(2,'0')}</span><div className="knowledge-entry-content"><div className="entry-tags"><span>{entry.category}</span><span>{entry.branchName}</span></div><h3>{entry.title}</h3><div className="entry-solution">{entry.cause&&<p><b>{tr(lang,'السبب','Cause')}</b>{entry.cause}</p>}{entry.resolution&&<p><b>{tr(lang,'الإجراء','Action taken')}</b>{entry.resolution}</p>}</div><div className="entry-foot"><span><UserRound size={14}/>{entry.technicianName}</span><span>{dateText(entry.createdAt,lang)}</span><Link href={`/workspace/tickets/${entry.ticketId}`}>{tr(lang,'البلاغ','Ticket')} {entry.ticketNumber}<ArrowUpRight size={14}/></Link></div></div><CheckCircle2 className="knowledge-check" size={20}/></article>)}</div>:<div className="empty-panel"><BookOpen size={25}/><h3>{entries?.length?tr(lang,'لا توجد نتائج مطابقة','No matching results'):tr(lang,'لا توجد حلول مؤكدة بعد','No confirmed fixes yet')}</h3><p>{tr(lang,'تُضاف الحلول تلقائياً عند تأكيد إغلاق البلاغ.','Solutions are added when a reporter confirms a repair.')}</p></div>}
  </div>;
}
function Modal({title,children,close}:{title:string;children:ReactNode;close:()=>void}) { return <div className="modal-scrim" onClick={close}><section className="modal-card" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>{title}</h2><button onClick={close} aria-label="إغلاق"><X size={18}/></button></div>{children}</section></div>; }
function WorkspaceRouter({lang,setLang,dark,setDark}:{lang:Lang;setLang:(x:Lang)=>void;dark:boolean;setDark:(x:boolean)=>void}) {
  const {data:session}=useGetDemoSession();const user=session?.user;
  return <Switch>
    <Route path="/workspace"><WorkspaceShell title={tr(lang,'نظرة عامة','Overview')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?<OverviewPage lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</WorkspaceShell></Route>
    <Route path="/workspace/tickets/new"><WorkspaceShell title={tr(lang,'بلاغ جديد','New report')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?.role==='reporter'?<NewTicketPage lang={lang} user={user}/>:user?<State title={tr(lang,'إنشاء البلاغات متاح للمبلّغ فقط','Only reporters can create tickets')}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</WorkspaceShell></Route>
    <Route path="/workspace/tickets/:ticketId"><WorkspaceShell title={tr(lang,'تفاصيل البلاغ','Ticket details')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?<TicketDetail lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</WorkspaceShell></Route>
    <Route path="/workspace/tickets"><WorkspaceShell title={tr(lang,'البلاغات','Tickets')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?<TicketsPage lang={lang} user={user}/>:<State title={tr(lang,'جاري استعادة الحساب','Restoring account')} loading/>}</WorkspaceShell></Route>
    <Route path="/workspace/technicians"><WorkspaceShell title={tr(lang,'الفنيون','Technicians')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?.role==='manager'?<TechniciansPage lang={lang}/>:<State title={tr(lang,'هذه الصفحة متاحة لمدير العمليات فقط','This page is for operations managers only')}/>}</WorkspaceShell></Route>
    <Route path="/workspace/branches"><WorkspaceShell title={tr(lang,'الفروع','Branches')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?.role==='manager'?<BranchesPage lang={lang}/>:<State title={tr(lang,'هذه الصفحة متاحة لمدير العمليات فقط','This page is for operations managers only')}/>}</WorkspaceShell></Route>
    <Route path="/workspace/knowledge"><WorkspaceShell title={tr(lang,'قاعدة المعرفة','Knowledge base')} lang={lang} setLang={setLang} dark={dark} setDark={setDark}>{user?.role==='manager'?<KnowledgePage lang={lang}/>:<State title={tr(lang,'هذه الصفحة متاحة لمدير العمليات فقط','This page is for operations managers only')}/>}</WorkspaceShell></Route>
    <Route component={NotFound}/>
  </Switch>;
}
function AppRoutes() {
  const prefs=usePrefs();
  return <Switch><Route path="/"><Landing lang={prefs.lang} setLang={prefs.setLang}/></Route><Route path="/demo"><DemoPage lang={prefs.lang}/></Route><Route path="/workspace/*"><WorkspaceRouter {...prefs}/></Route><Route path="/workspace"><WorkspaceRouter {...prefs}/></Route><Route component={NotFound}/></Switch>;
}
function App() { return <QueryClientProvider client={qc}><AppRoutes/></QueryClientProvider>; }
export default App;
