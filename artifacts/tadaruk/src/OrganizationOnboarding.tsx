import {useState,type FormEvent} from 'react';
import InvitationQRCode from './components/InvitationQRCode';
import {createInvitationLink} from './invitation-link';
import {Link,useLocation} from 'wouter';
import {ArrowLeft,ArrowRight,Building2,Check,CheckCircle2,ChevronLeft,ChevronDown,ClipboardList,Copy,Eye,EyeOff,Mail,MapPin,Plus,ShieldCheck,UserRound,Users,Wrench,X,MessageCircle,Send,Smartphone,LogIn} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import './organization-onboarding.css';

type Lang='ar'|'en';
type Role='technician'|'reporter';
type Site={id:number;city:string;name:string};
const tr=(lang:Lang,ar:string,en:string)=>lang==='ar'?ar:en;
const branches=(lang:Lang)=>[tr(lang,'المنشأة','Organization'),tr(lang,'المدير','Manager'),tr(lang,'الفروع','Branches'),tr(lang,'الدعوات','Invitations')];
export default function OrganizationOnboarding({lang,mode,embedded=false,onExit}:{lang:Lang;mode:'signup'|'login';embedded?:boolean;onExit?:()=>void}){
 const [,go]=useLocation();
 const [step,setStep]=useState(0);
 const [done,setDone]=useState(false);
 const [showPassword,setShowPassword]=useState(false);
 const [error,setError]=useState('');
 const [copied,setCopied]=useState(false);
 const [data,setData]=useState({organization:'',sector:'',city:'',owner:'',email:'',phone:'',password:'',branch:'',branchCity:'',departments:''});
 const [sites,setSites]=useState<Site[]>([]);
 const [newCity,setNewCity]=useState('');
 const [otherSector,setOtherSector]=useState('');
 const [otherCity,setOtherCity]=useState('');
 const [newBranch,setNewBranch]=useState('');
 const [switching,setSwitching]=useState(false);
 const [loginEmail,setLoginEmail]=useState('');
 const [loginPassword,setLoginPassword]=useState('');
 const set=(key:keyof typeof data,value:string)=>{setData(old=>({...old,[key]:value}));setError('')};
 const switchPage=(path:'/login'|'/signup')=>{setSwitching(true);window.setTimeout(()=>go(path),570)};
 const addSite=()=>{
   const city=newCity==='other'?otherCity.trim():newCity;
   if(!city||!newBranch.trim()){setError(tr(lang,'اختر المدينة واكتب اسم الفرع.','Select a city and enter a branch name.'));return;}
   if(sites.some(x=>x.city===city&&x.name===newBranch.trim())){setError(tr(lang,'هذا الفرع مضاف بالفعل.','This branch already exists.'));return;}
   setSites(old=>[...old,{id:Date.now()+old.length,city,name:newBranch.trim()}]);setNewBranch('');setError('');
 };
 const branchLabel=(s:Site)=>`${s.name} · ${s.city}`;
 const inviteUrl=(role:Role)=>createInvitationLink(role,data.organization.trim());
 const inviteMessage=(role:Role)=>tr(lang,
   'دعوة للانضمام إلى '+(data.organization||'المنشأة')+' على تدارك. أكمل بياناتك: '+inviteUrl(role),
   'Join '+(data.organization||'the organization')+' on Tadaruk. Complete your details: '+inviteUrl(role));
 const shareWhatsapp=(role:Role)=>window.open('https://wa.me/?text='+encodeURIComponent(inviteMessage(role)),'_blank','noopener,noreferrer');
 const shareEmail=(role:Role)=>{window.location.href='mailto:?subject='+encodeURIComponent(tr(lang,'دعوة تدارك','Tadaruk invitation'))+'&body='+encodeURIComponent(inviteMessage(role))};
 const copyInvite=(role:Role)=>void navigator.clipboard?.writeText(inviteUrl(role))
  .then(()=>{setCopied(true);setError('')}).catch(()=>setError(tr(lang,'تعذّر نسخ الرابط.','Unable to copy link.')));
 const next=(event:FormEvent<HTMLFormElement>)=>{
   event.preventDefault();setError('');
   if(step===0&&!data.sector){setError(tr(lang,'اختر نوع المنشأة.','Choose the organization type.'));return;}
   if(step===0&&data.sector==='other'&&!otherSector.trim()){setError(tr(lang,'اكتب نوع المنشأة.','Enter the organization type.'));return;}
   if(step===1&&data.password.length<8){setError(tr(lang,'كلمة المرور لا تقل عن 8 أحرف.','Use at least 8 characters.'));return;}
   if(step===2&&sites.length===0){setError(tr(lang,'أضف فرعًا واحدًا على الأقل للمتابعة.','Add at least one branch to continue.'));return;}
   if(step===3){
     const snapshot={organization:data.organization,sector:data.sector==='other'?otherSector:data.sector,city:data.city,owner:data.owner,email:data.email,
       branch:data.branch,branchCity:data.branchCity,departments:data.departments,
       sites,reportersByInvite:true};
     try{
       localStorage.setItem('tadaruk-organization-preview',JSON.stringify(snapshot));
       localStorage.setItem('tadaruk-needs-technician-setup','1');
     }catch{}
     setDone(true);
   }else setStep(s=>s+1);
 };
 const field=(key:keyof typeof data,ar:string,en:string,placeholder:string,type='text',required=true)=><label className="org-field">
   <span>{tr(lang,ar,en)}</span>
   <input value={data[key]} type={type==='password'?(showPassword?'text':'password'):type} placeholder={placeholder}
    required={required} minLength={type==='password'?8:undefined} onChange={e=>set(key,e.target.value)}/>
 </label>;
 const Back=ArrowLeft;
 const goBack=()=>{
   if(done){if(onExit)onExit();else go('/login');return;}
   if(step>0){setError('');setStep(current=>Math.max(0,current-1));return;}
   if(onExit)onExit();
   else go('/login');
 };
 const title=mode==='login'?tr(lang,'أهلًا بعودتك','Welcome back'):tr(lang,'إعداد المنشأة','Organization setup');
 return <div className={embedded?'org-embedded':'org-screen'} dir={lang==='ar'?'rtl':'ltr'}>
  {embedded&&mode==='signup'&&<button type="button" className="org-wizard-back-circle" onClick={goBack}
    title={step>0&&!done?tr(lang,'الخطوة السابقة','Previous step'):tr(lang,'العودة لتسجيل الدخول','Back to sign in')}
    aria-label={step>0&&!done?tr(lang,'العودة للخطوة السابقة','Back to previous step'):tr(lang,'العودة لتسجيل الدخول','Back to sign in')}>
    {lang==='ar'?<ArrowRight size={22} strokeWidth={2.3} aria-hidden="true"/>:<ArrowLeft size={22} strokeWidth={2.3} aria-hidden="true"/>}
  </button>}
  {!embedded&&<header className="org-top">
    <Link href="/" className="org-brand">تدارك <small>TADARUK</small></Link>
    <Link href="/" className="org-home"><Back size={16}/>{tr(lang,'رجوع','Back')}</Link>
  </header>}
  <div className={embedded?'org-embedded-layout':`org-layout org-layout--${mode} ${switching?'org-switching':''}`}>
    {!embedded&&<aside className="org-aside">
      <div className="org-aside-visual" aria-hidden="true"><span className="org-visual-orbit"/><span className="org-visual-card"><Building2 size={37}/><i/><i/></span><span className="org-visual-spark"><Check size={17}/></span></div>
      <span className="org-pill"><ShieldCheck size={15}/>{tr(lang,'تدارك · إدارة الصيانة','TADARUK · Maintenance management')}</span>
      <h1>{title}</h1>
      <p>{mode==='login'?tr(lang,'بلاغات منشأتك وفريقك، في مساحة واحدة.','Your team and maintenance tickets in one connected workspace.'):tr(lang,'أنشئي منشأتك، نظّمي فروعها، وادعي فريقك في خطوات بسيطة.','Set up branches and invite your team with a smooth guided experience.')}</p>
      <div className="org-aside-role-preview">
        <span className="org-role-label">{tr(lang,'جرّبي تدارك مباشرة','EXPLORE TADARUK')}</span>
        <div className="org-demo-bubbles">
          {[['manager',tr(lang,'المدير','Manager'),Building2],['technician',tr(lang,'الفني','Technician'),Wrench],['reporter',tr(lang,'المبلّغ','Reporter'),ClipboardList]].map(([role,label,Icon])=><button key={role as string} type="button" className="org-demo-bubble" onClick={()=>go('/login')}><span><Icon size={22}/></span><small>{label as string}</small></button>)}
        </div>
      </div>
      <div className="org-aside-switch">
        <span>{mode==='login'?tr(lang,'جديدة على تدارك؟','New to Tadaruk?'):tr(lang,'لديك حساب؟','Already have an account?')}</span>
        <button type="button" onClick={()=>switchPage(mode==='login'?'/signup':'/login')}>{mode==='login'?tr(lang,'إنشاء حساب منشأة','Create an account'):tr(lang,'تسجيل الدخول','Sign in')} <ArrowLeft size={16}/></button>
      </div>
    </aside>}
    <section className={embedded?'org-embedded-panel':'org-panel'}>

      {mode==='login'?<form className="org-form org-login-form" onSubmit={e=>{e.preventDefault();go('/login')}}>
        <span className="org-eyebrow">{tr(lang,'مرحبًا مجددًا','WELCOME BACK')}</span>
        <h2>{tr(lang,'تسجيل الدخول','Sign in')}</h2>
        <p className="org-muted">{tr(lang,'أدخلي بريدك الإلكتروني وكلمة المرور للمتابعة.','Enter your email and password to continue.')}</p>
        <label className="org-field"><span>{tr(lang,'البريد الإلكتروني','Email')}</span><div className="org-input-icon"><Mail size={17}/><input required type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="name@company.com"/></div></label>
        <label className="org-field"><span>{tr(lang,'كلمة المرور','Password')}</span><div className="org-input-icon"><ShieldCheck size={17}/><input required minLength={4} type={showPassword?'text':'password'} value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="••••••••"/><button type="button" className="org-eye" onClick={()=>setShowPassword(s=>!s)} aria-label={tr(lang,'إظهار كلمة المرور','Show password')}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>
        <button type="submit" className="org-next org-next--full">{tr(lang,'تسجيل الدخول','Sign in')}<ChevronLeft size={18}/></button>
        <p className="org-auth-helper">{tr(lang,'للتجربة السريعة، اختاري أحد الحسابات الموجودة في البطاقة المجاورة.','For a quick walkthrough, choose a demo role on the side.')}</p>
        <p className="org-small">{tr(lang,'ليس لديك حساب؟','New to Tadaruk?')} <button type="button" className="org-inline-switch" onClick={()=>switchPage('/signup')}>{tr(lang,'إنشاء حساب منشأة','Create an account')}</button></p>
      </form>:done?<div className="org-success">
        <span className="org-success-mark"><CheckCircle2 size={36}/></span>
        <h2>{tr(lang,'اكتمل إعداد المنشأة','Organization setup complete')}</h2>
        <p>{tr(lang,'اكتمل نموذج إعداد المنشأة. أرسل الدعوات، ثم أضف الفنيين من لوحة المدير. التفعيل الفعلي يتطلب ربط الحسابات بالخادم.','Organization setup preview complete. Send invitations and add technicians later from the manager dashboard. Live activation requires backend accounts.')}</p>

      </div>:<form className="org-form" onSubmit={next}>
        <span className="org-eyebrow">{tr(lang,`الخطوة ${step+1} من 4`,`Step ${step+1} of 4`)}</span>
        <h2>{[
          tr(lang,'بيانات المنشأة','Organization details'),
          tr(lang,'حساب مدير المنشأة','Organization manager account'),
          tr(lang,'الفروع والمدن','Branches and cities'),
          tr(lang,'دعوة الفريق','Invite the team')
        ][step]}</h2>
        <div className="org-steps" aria-label={tr(lang,'خطوات إعداد المنشأة','Organization setup progress')}>
         {branches(lang).map((name,i)=><div key={name} className={i<step?'done':i===step?'current':''}><span>{i<step?<Check size={14}/>:i+1}</span><small>{name}</small></div>)}
        </div>
        {step===0&&<div className="org-step-content">
          <p className="org-step-hint">{tr(lang,'ابدأ بإضافة بيانات المنشأة الأساسية، ثم أضف الفروع في الخطوة التالية.','Start with your organization details. Branches come later.')}</p>
          <div className="org-fields">
            {field('organization','اسم المنشأة','Organization name',tr(lang,'مثال: مجموعة الأفق','Example: Horizon Group'))}
            <label className="org-field"><span>{tr(lang,'نوع المنشأة','Organization type')}</span><Select value={data.sector} onValueChange={value=>set('sector',value)}><SelectTrigger className="org-select-trigger"><SelectValue placeholder={tr(lang,'اختر نوع المنشأة','Choose organization type')}/></SelectTrigger><SelectContent className="org-select-content" dir={lang==='ar'?'rtl':'ltr'}>{[['restaurant','مطاعم ومقاهي','Restaurants'],['health','منشأة صحية','Healthcare'],['education','تعليمية','Education'],['retail','تجزئة ومتاجر','Retail'],['office','مكاتب ومنشآت','Offices'],['other','أخرى','Other']].map(([v,ar,en])=><SelectItem key={v} value={v}>{tr(lang,ar,en)}</SelectItem>)}</SelectContent></Select></label>
            {data.sector==='other'&&<label className="org-field org-field-wide"><span>{tr(lang,'حدد نوع المنشأة','Specify organization type')}</span><input value={otherSector} required onChange={e=>{setOtherSector(e.target.value);setError('')}} placeholder={tr(lang,'اكتب نوع المنشأة','Enter organization type')}/></label>}
          </div>
        </div>}
        {step===1&&<div className="org-fields">
          {field('owner','اسم مسؤول الحساب','Account owner name',tr(lang,'الاسم الكامل','Full name'))}
          {field('email','البريد الإلكتروني','Email address','name@company.com','email')}
          {field('phone','رقم الجوال','Mobile number','05XXXXXXXX','tel')}
          <div className="org-password-wrap">
            {field('password','كلمة المرور','Password',tr(lang,'8 أحرف على الأقل','At least 8 characters'),'password')}
            <button type="button" className="org-password-toggle" aria-label={tr(lang,'إظهار كلمة المرور','Show password')} onClick={()=>setShowPassword(s=>!s)}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button>
          </div>
        </div>}
        {step===2&&<div className="org-site-step">
          <p className="org-muted">{tr(lang,'يمكن إضافة عدة مدن وفروع. تظهر الفروع المحددة للمبلّغ في حسابه.','Add multiple cities and branches. Reporters can select the available branches from their workspace.')}</p>
          <div className="org-fields">
            <label className="org-field"><span>{tr(lang,'المدينة','City')}</span><Select value={newCity} onValueChange={v=>{setNewCity(v);setError('')}}><SelectTrigger className="org-select-trigger"><SelectValue placeholder={'اختر المدينة'}/></SelectTrigger><SelectContent className="org-select-content org-city-select" dir="rtl">{['الرياض','جدة','مكة','المدينة المنورة','الدمام','الخبر','جازان','أبو عريش','أبها','تبوك','حائل','بريدة','الطائف','نجران','ينبع','الأحساء','other'].map(value=><SelectItem key={value} value={value}>{value==='other'?'أخرى':value}</SelectItem>)}</SelectContent></Select></label>
            <label className="org-field"><span>{tr(lang,'اسم الفرع','Branch name')}</span><input value={newBranch} onChange={e=>setNewBranch(e.target.value)} placeholder={tr(lang,'مثال: فرع العليا','Example: Olaya branch')}/></label>
          </div>
          {newCity==='other'&&<label className="org-field"><span>{tr(lang,'اسم المدينة','City name')}</span><input value={otherCity} onChange={e=>setOtherCity(e.target.value)} placeholder={tr(lang,'اكتب اسم المدينة','Enter city name')}/></label>}
          <button type="button" className="org-add org-add-branch" onClick={addSite}><Plus size={17}/>{tr(lang,'إضافة الفرع','Add branch')}</button>
          {sites.length>0&&<div className="org-site-groups">{Array.from(new Set(sites.map(s=>s.city))).map(city=><div className="org-city-group" key={city}><div className="org-city-heading"><MapPin size={15}/><b>{city}</b><small>{sites.filter(s=>s.city===city).length} {tr(lang,'فروع','branches')}</small></div><div className="org-site-chips">{sites.filter(s=>s.city===city).map(s=><span key={s.id}>{s.name}<button type="button" aria-label={tr(lang,'حذف الفرع','Remove branch')} onClick={()=>setSites(old=>old.filter(x=>x.id!==s.id))}><X size={13}/></button></span>)}</div></div>)}</div>}
          <div className="org-info-inline org-branch-info"><MapPin size={17} aria-hidden="true"/><span>{tr(lang,'يختار المبلّغ الفرع المناسب عند تقديم بلاغ.','Reporters select the relevant branch when submitting a ticket.')}</span></div>
        </div>}
        {step===3&&<div className="org-final-review org-invitation-step org-simple-invitations">
          <div className="org-final-organization"><Building2 size={21}/><span><b>{data.organization}</b><small>{tr(lang,'المدير: ','Manager: ')}{data.owner} · {sites.length} {tr(lang,'فروع','branches')}</small></span></div>
          <div className="org-invite-section">
            <div className="org-invite-section-head"><span className="org-invite-section-icon"><ClipboardList size={19}/></span><div><h3>{tr(lang,'دعوة المبلّغين','Invite reporters')}</h3><p>{tr(lang,'شارك رابطًا أو رمز QR مع الموظفين ليُدخل كل شخص بياناته بنفسه.','Share a link or QR code so each person enters their own details.')}</p></div></div>
            <div className="org-invite-share-layout">
              <div className="org-share-actions org-reporter-share">
                <button type="button" className="org-share-wa" onClick={()=>shareWhatsapp('reporter')}><MessageCircle size={17}/>{tr(lang,'واتساب','WhatsApp')}</button>
                <button type="button" onClick={()=>shareEmail('reporter')}><Mail size={17}/>{tr(lang,'البريد','Email')}</button>
                <button type="button" onClick={()=>copyInvite('reporter')}><Copy size={17}/>{copied?tr(lang,'تم النسخ','Copied'):tr(lang,'نسخ الرابط','Copy link')}</button>
              </div>
              <InvitationQRCode url={inviteUrl('reporter')} label={tr(lang,'رمز QR لدعوة المبلّغين','Reporter invitation QR code')}/>
            </div>
          </div>
          <div className="org-info-inline org-later-technicians"><Wrench size={17}/><span>{tr(lang,'تضيف الفنيين وترسل دعواتهم لاحقًا من صفحة «الفنيون» في حساب المدير.','Add and invite technicians later from the manager’s Technicians page.')}</span></div>
          <p className="org-final-disclosure">{tr(lang,'هذه دعوات تجريبية لتوضيح المسار. إنشاء الحسابات والتحقق من الدعوات يتطلبان ربطًا بالخادم.','These invitations preview the flow. Verified invites and real accounts require backend integration.')}</p>
        </div>}
        {error&&<p className="org-error" role="alert">{error}</p>}
        <div className="org-bottom org-wizard-continue">
          <button type="submit" className="org-next">{step===3?tr(lang,'إنهاء الإعداد','Complete setup'):tr(lang,'التالي','Continue')}<ChevronLeft size={18}/></button>
        </div>
        <p className="org-small">{tr(lang,'لديك حساب بالفعل؟','Already have an account?')} <button type="button" className="org-inline-switch" onClick={()=>switchPage('/login')}>{tr(lang,'تسجيل الدخول','Sign in')}</button></p>
      </form>}
    </section>
  </div>
 </div>;
}
