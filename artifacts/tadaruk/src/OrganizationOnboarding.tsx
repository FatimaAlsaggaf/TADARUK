import {useState,type FormEvent} from 'react';
import {Link,useLocation} from 'wouter';
import {ArrowLeft,ArrowRight,Building2,Check,CheckCircle2,ChevronLeft,ChevronDown,ClipboardList,Copy,Eye,EyeOff,Mail,MapPin,Plus,ShieldCheck,UserRound,Users,Wrench,X,MessageCircle,Send,Smartphone,LogIn} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import './organization-onboarding.css';

type Lang='ar'|'en';
type Role='manager'|'technician'|'reporter';
type Member={id:number;name:string;email:string;phone:string;role:Role;specialty:string;branch:string;status:'pending'};
type Site={id:number;city:string;name:string};
const tr=(lang:Lang,ar:string,en:string)=>lang==='ar'?ar:en;
const specialties=[['plumbing','سباكة ومياه','Plumbing'],['electrical','كهرباء وإنارة','Electrical'],['cooling','تكييف وتبريد','Cooling'],['general','صيانة عامة','General maintenance'],['civil','أعمال مدنية','Civil']];
const branches=(lang:Lang)=>[tr(lang,'المنشأة','Organization'),tr(lang,'المدير','Manager'),tr(lang,'الفروع','Branches'),tr(lang,'الفنيون','Technicians'),tr(lang,'الدعوات','Invitations')];
export default function OrganizationOnboarding({lang,mode,embedded=false}:{lang:Lang;mode:'signup'|'login';embedded?:boolean}){
 const [,go]=useLocation();
 const [step,setStep]=useState(0);
 const [done,setDone]=useState(false);
 const [showPassword,setShowPassword]=useState(false);
 const [error,setError]=useState('');
 const [copied,setCopied]=useState(false);
 const [data,setData]=useState({organization:'',sector:'',city:'',owner:'',email:'',phone:'',password:'',branch:'',branchCity:'',departments:''});
 const [members,setMembers]=useState<Member[]>([]);
 const [member,setMember]=useState({name:'',email:'',phone:'',role:'technician' as Role,specialty:'plumbing',branch:''});
 const [sites,setSites]=useState<Site[]>([]);
 const [newCity,setNewCity]=useState('');
 const [otherSector,setOtherSector]=useState('');
 const [otherCity,setOtherCity]=useState('');
 const [otherSpecialty,setOtherSpecialty]=useState('');
 const [newBranch,setNewBranch]=useState('');
 const [switching,setSwitching]=useState(false);
 const [reportersByInvite,setReportersByInvite]=useState(true);
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
 const specialtyLabel=(value:string)=>specialties.find(([id])=>id===value)?.[lang==='ar'?1:2]||value;
 const branchLabel=(s:Site)=>`${s.name} · ${s.city}`;
 const normalizedPhone=(phone:string)=>phone.replace(/[^\d]/g,'').replace(/^0(?=5\d{8}$)/,'966');
 const inviteUrl=(role:Role,record?:Member)=>{
   const params=new URLSearchParams({role,organization:data.organization,branch:record?.branch||'',name:record?.name||'',specialty:record?.specialty||''});
   return (typeof window==='undefined'?'':window.location.origin)+'/join?'+params.toString();
 };
 const inviteMessage=(role:Role,record?:Member)=>tr(lang,
   `أهلًا ${record?.name||''}، هذه دعوة للانضمام إلى ${data.organization} على منصة تدارك بصلاحية ${role==='technician'?'فني':role==='manager'?'مدير':'مبلّغ'}. لتفعيل حسابك: ${inviteUrl(role,record)}`,
   `You're invited to ${data.organization} on Tadaruk as a ${role}. Activate here: ${inviteUrl(role,record)}`);
 const shareWhatsapp=(role:Role,record?:Member)=>{const number=record?.phone?normalizedPhone(record.phone):'';window.open('https://wa.me/'+number+'?text='+encodeURIComponent(inviteMessage(role,record)),'_blank','noopener,noreferrer')};
 const shareEmail=(role:Role,record?:Member)=>{window.location.href='mailto:'+(record?.email||'')+'?subject='+encodeURIComponent(tr(lang,'دعوة للانضمام إلى تدارك','Tadaruk invitation'))+'&body='+encodeURIComponent(inviteMessage(role,record))};
 const copyInvite=(role:Role,record?:Member)=>{void navigator.clipboard?.writeText(inviteMessage(role,record)).then(()=>setCopied(true)).catch(()=>setError(tr(lang,'تعذّر نسخ الدعوة.','Unable to copy invitation.')))};
 const entryUrl=typeof window==='undefined'?'':window.location.origin+'/login';
 const inviteText=tr(lang,`انضم إلى فريق ${data.organization||'المنشأة'} على تدارك. الفرع: ${data.branch||'الفرع'}. افتح رابط تسجيل الدخول: ${entryUrl} (رابط تعريفي - دعوات الحسابات غير مفعلة بعد).`,`Join ${data.organization||'our organization'} on Tadaruk. Branch: ${data.branch||'branch'}. Sign in: ${entryUrl} (Invitation activation is not yet connected).`);
 const copy=()=>{if(navigator.clipboard){void navigator.clipboard.writeText(inviteText).then(()=>setCopied(true)).catch(()=>setCopied(false))}};
 const addMember=()=>{
   const fullName=member.name.trim();
   const phone=member.phone.trim();
   const specialty=member.specialty==='other'?otherSpecialty.trim():member.specialty;
   const branch=member.branch|| (sites[0]?branchLabel(sites[0]):'');
   if(!fullName||!phone||!specialty||!branch){setError(tr(lang,'أدخل اسم الفني ورقم جواله وتخصصه وفرعه.','Enter technician name, phone, specialty and branch.'));return;}
   if(!/^[+\\d()\\s-]{8,20}$/.test(phone)){setError(tr(lang,'تحقق من رقم الجوال.','Check the phone number.'));return;}
   if(members.some(x=>x.phone.replace(/\\D/g,'')===phone.replace(/\\D/g,''))){setError(tr(lang,'رقم الجوال مضاف لفني آخر.','A technician with this phone number already exists.'));return;}
   setMembers(old=>[...old,{id:Date.now()+old.length,name:fullName,email:'',phone,role:'technician',specialty,branch,status:'pending'}]);
   setMember({name:'',email:'',phone:'',role:'technician',specialty:'plumbing',branch:''});
   setOtherSpecialty('');setError('');
 };
 const next=(event:FormEvent<HTMLFormElement>)=>{
   event.preventDefault();setError('');
   if(step===0&&!data.sector){setError(tr(lang,'اختر نوع المنشأة.','Choose the organization type.'));return;}
   if(step===0&&data.sector==='other'&&!otherSector.trim()){setError(tr(lang,'اكتب نوع المنشأة.','Enter the organization type.'));return;}
   if(step===1&&data.password.length<8){setError(tr(lang,'كلمة المرور لا تقل عن 8 أحرف.','Use at least 8 characters.'));return;}
   if(step===2&&sites.length===0){setError(tr(lang,'أضف فرعًا واحدًا على الأقل للمتابعة.','Add at least one branch to continue.'));return;}
   if(step===3&&(member.name.trim()||member.phone.trim())){setError(tr(lang,'اضغط إضافة الفني قبل الانتقال، أو امسح الحقول للمتابعة دون إضافة.','Add the technician before continuing, or clear the fields to skip.'));return;}
   if(step===4){
     const snapshot={organization:data.organization,sector:data.sector==='other'?otherSector:data.sector,city:data.city,owner:data.owner,email:data.email,
       branch:data.branch,branchCity:data.branchCity,departments:data.departments,
       sites,members,reportersByInvite:true};
     try{localStorage.setItem('tadaruk-organization-preview',JSON.stringify(snapshot))}catch{}
     setDone(true);
   }else setStep(s=>s+1);
 };
 const field=(key:keyof typeof data,ar:string,en:string,placeholder:string,type='text',required=true)=><label className="org-field">
   <span>{tr(lang,ar,en)}</span>
   <input value={data[key]} type={type==='password'?(showPassword?'text':'password'):type} placeholder={placeholder}
    required={required} minLength={type==='password'?8:undefined} onChange={e=>set(key,e.target.value)}/>
 </label>;
 const Back=lang==='ar'?ArrowRight:ArrowLeft;
 const title=mode==='login'?tr(lang,'أهلًا بعودتك','Welcome back'):tr(lang,'إعداد المنشأة','Organization setup');
 return <div className={embedded?'org-embedded':'org-screen'} dir={lang==='ar'?'rtl':'ltr'}>
  {!embedded&&<header className="org-top">
    <Link href="/" className="org-brand">تدارك <small>TADARUK</small></Link>
    <Link href="/" className="org-home"><Back size={16}/>{tr(lang,'الرئيسية','Home')}</Link>
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
          {[['manager',tr(lang,'المدير','Manager'),Building2],['technician',tr(lang,'الفني','Technician'),Wrench],['reporter',tr(lang,'المبلّغ','Reporter'),ClipboardList]].map(([role,label,Icon])=><button key={role as string} type="button" className="org-demo-bubble" onClick={()=>go('/demo')}><span><Icon size={22}/></span><small>{label as string}</small></button>)}
        </div>
      </div>
      <div className="org-aside-switch">
        <span>{mode==='login'?tr(lang,'جديدة على تدارك؟','New to Tadaruk?'):tr(lang,'لديك حساب؟','Already have an account?')}</span>
        <button type="button" onClick={()=>switchPage(mode==='login'?'/signup':'/login')}>{mode==='login'?tr(lang,'إنشاء حساب منشأة','Create an account'):tr(lang,'تسجيل الدخول','Sign in')} <ArrowLeft size={16}/></button>
      </div>
    </aside>}
    <section className={embedded?'org-embedded-panel':'org-panel'}>
      <div className="org-auth-topline"><span>{tr(lang,'حساب المنشأة','Organization account')}</span><span>{mode==='login'?tr(lang,'تسجيل الدخول','Sign in'):tr(lang,'إنشاء حساب','Create account')}</span></div>
      {mode==='login'?<form className="org-form org-login-form" onSubmit={e=>{e.preventDefault();go('/demo')}}>
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
        <p>{tr(lang,'اكتمل إعداد المنشأة والفنيين. يمكن مشاركة روابط الدعوات، لكن تفعيل الحسابات الفعلية يحتاج ربط خدمة المصادقة.','Setup is complete. Invitation links can be shared, while real account activation requires authentication integration.')}</p>
        <div className="org-review"><b>{data.organization}</b><span>{sites.length} {tr(lang,'فروع','branches')}</span><span>{members.length} {tr(lang,'فني تمت إضافته','technicians added')}</span></div>
        <button type="button" className="org-next org-next--full" onClick={()=>go('/demo')}>{tr(lang,'الدخول إلى لوحة التحكم','Open dashboard')}<ChevronLeft size={18}/></button>
      </div>:<form className="org-form" onSubmit={next}>
        <span className="org-eyebrow">{tr(lang,`الخطوة ${step+1} من 5`,`Step ${step+1} of 5`)}</span>
        <h2>{[
          tr(lang,'بيانات المنشأة','Organization details'),
          tr(lang,'حساب مدير المنشأة','Organization manager account'),
          tr(lang,'الفروع والمدن','Branches and cities'),
          tr(lang,'إضافة الفنيين','Add technicians'),
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
            <label className="org-field"><span>{tr(lang,'المدينة','City')}</span><Select value={newCity} onValueChange={v=>{setNewCity(v);setError('')}}><SelectTrigger className="org-select-trigger"><SelectValue placeholder={tr(lang,'اختر المدينة','Select a city')}/></SelectTrigger><SelectContent className="org-select-content" dir={lang==='ar'?'rtl':'ltr'}>{[['الرياض','Riyadh'],['جدة','Jeddah'],['مكة','Makkah'],['المدينة المنورة','Madinah'],['الدمام','Dammam'],['الخبر','Khobar'],['جازان','Jazan'],['أبو عريش','Abu Arish'],['أبها','Abha'],['تبوك','Tabuk'],['حائل','Hail'],['بريدة','Buraydah'],['الطائف','Taif'],['نجران','Najran'],['ينبع','Yanbu'],['الأحساء','Al Ahsa'],['other','أخرى','Other']].map(([v,ar,en])=><SelectItem key={v} value={v}>{tr(lang,ar,en)}</SelectItem>)}</SelectContent></Select></label>
            <label className="org-field"><span>{tr(lang,'اسم الفرع','Branch name')}</span><input value={newBranch} onChange={e=>setNewBranch(e.target.value)} placeholder={tr(lang,'مثال: فرع العليا','Example: Olaya branch')}/></label>
          </div>
          {newCity==='other'&&<label className="org-field"><span>{tr(lang,'اسم المدينة','City name')}</span><input value={otherCity} onChange={e=>setOtherCity(e.target.value)} placeholder={tr(lang,'اكتب اسم المدينة','Enter city name')}/></label>}
          <button type="button" className="org-add org-add-branch" onClick={addSite}><Plus size={17}/>{tr(lang,'إضافة الفرع','Add branch')}</button>
          {sites.length>0&&<div className="org-site-groups">{Array.from(new Set(sites.map(s=>s.city))).map(city=><div className="org-city-group" key={city}><div className="org-city-heading"><MapPin size={15}/><b>{city}</b><small>{sites.filter(s=>s.city===city).length} {tr(lang,'فروع','branches')}</small></div><div className="org-site-chips">{sites.filter(s=>s.city===city).map(s=><span key={s.id}>{s.name}<button type="button" aria-label={tr(lang,'حذف الفرع','Remove branch')} onClick={()=>setSites(old=>old.filter(x=>x.id!==s.id))}><X size={13}/></button></span>)}</div></div>)}</div>}
          <div className="org-info-inline"><MapPin size={16}/>{tr(lang,'سيشاهد المبلّغ الفروع التي أضافتها منشأته في قائمة الفروع الموجودة أصلًا في واجهته.','Reporters will choose from their organization’s branches in the existing branch selector.')}</div>
        </div>}
        {step===3&&<div className="org-access-page org-tech-setup">
          <div className="org-tech-intro"><div className="org-tech-intro-icon"><CheckCircle2 size={22}/></div><div><b>{tr(lang,'حساب المدير جاهز ضمن إعداد المنشأة','Manager account is part of registration')}</b><p>{tr(lang,'الحساب الذي تم إنشاؤه في الخطوة الثانية هو حساب مدير المنشأة. هنا تُضاف بيانات الفنيين فقط، مع تحديد الفرع والتخصص لكل فني.','The account created in step two is the organization manager account. Add technician profiles here, assigning each branch and specialty.')}</p></div></div>
          <div className="org-access-heading"><h3>{tr(lang,'بيانات الفني','Technician details')}</h3><span className="org-mini-count">{members.length} {tr(lang,'فني مضاف','technicians added')}</span></div>
          <div className="org-fields">
            <label className="org-field"><span>{tr(lang,'اسم الفني','Technician name')}</span><input autoComplete="off" value={member.name} placeholder={tr(lang,'الاسم الكامل','Full name')} onChange={e=>{setMember(m=>({...m,name:e.target.value}));setError('')}}/></label>
            <label className="org-field"><span>{tr(lang,'رقم الجوال','Mobile number')}</span><input type="tel" autoComplete="off" dir="ltr" value={member.phone} placeholder="05XXXXXXXX" onChange={e=>{setMember(m=>({...m,phone:e.target.value}));setError('')}}/></label>
            <label className="org-field"><span>{tr(lang,'التخصص','Specialty')}</span><Select value={member.specialty} onValueChange={value=>{setMember(m=>({...m,specialty:value}));setError('')}}><SelectTrigger className="org-select-trigger"><SelectValue placeholder={tr(lang,'اختر التخصص','Choose specialty')}/></SelectTrigger><SelectContent className="org-select-content" dir={lang==='ar'?'rtl':'ltr'}>{[...specialties,['other','أخرى','Other']].map(([v,ar,en])=><SelectItem key={v} value={v}>{tr(lang,ar,en)}</SelectItem>)}</SelectContent></Select></label>
            <label className="org-field"><span>{tr(lang,'الفرع التابع له','Assigned branch')}</span><Select value={member.branch|| (sites[0]?branchLabel(sites[0]):'')} onValueChange={value=>{setMember(m=>({...m,branch:value}));setError('')}}><SelectTrigger className="org-select-trigger"><SelectValue placeholder={tr(lang,'اختر الفرع','Choose branch')}/></SelectTrigger><SelectContent className="org-select-content" dir={lang==='ar'?'rtl':'ltr'}>{sites.map(s=><SelectItem key={s.id} value={branchLabel(s)}>{branchLabel(s)}</SelectItem>)}</SelectContent></Select></label>
            {member.specialty==='other'&&<label className="org-field org-field-wide"><span>{tr(lang,'اكتب تخصص الفني','Technician specialty')}</span><input value={otherSpecialty} onChange={e=>{setOtherSpecialty(e.target.value);setError('')}} placeholder={tr(lang,'مثال: صيانة المصاعد','Example: Elevator maintenance')}/></label>}
          </div>
          <div className="org-tech-add-row"><p>{tr(lang,'يُحدد النظام صلاحية «فني» تلقائيًا، ويُرسل رابط التفعيل في الخطوة التالية.','Technician access is assigned automatically. The activation link is shared in the next step.')}</p><button type="button" className="org-add org-add-tech" onClick={addMember}><Plus size={16}/>{tr(lang,'إضافة الفني','Add technician')}</button></div>
          {members.length>0&&<div className="org-tech-list"><div className="org-tech-list-head"><b>{tr(lang,'الفنيون المضافون','Added technicians')}</b><span>{members.length}</span></div>{members.map(m=><div className="org-tech-row" key={m.id}><span className="org-invite-avatar"><Wrench size={17}/></span><span className="org-invite-person"><b>{m.name}</b><small>{m.phone} · {m.branch} · {specialtyLabel(m.specialty)}</small></span><button type="button" aria-label={tr(lang,'حذف الفني','Remove technician')} className="org-tech-remove" onClick={()=>setMembers(a=>a.filter(x=>x.id!==m.id))}><X size={16}/></button></div>)}</div>}
        </div>}
        {step===4&&<div className="org-final-review org-invitation-step">
          <div className="org-final-organization"><Building2 size={21}/><span><b>{data.organization}</b><small>{tr(lang,'المدير: ','Manager: ')}{data.owner} · {sites.length} {tr(lang,'فروع','branches')}</small></span></div>
          <div className="org-invite-section">
            <div className="org-invite-section-head"><span className="org-invite-section-icon"><Wrench size={19}/></span><div><h3>{tr(lang,'دعوات الفنيين','Technician invitations')}</h3><p>{tr(lang,'لكل فني دعوة شخصية مرتبطة بتخصصه وفرعه. يضيف الفني بريده وكلمة المرور عند التفعيل.','Each technician gets a personal invitation with their assigned branch and specialty. They set their email and password when activating.')}</p></div></div>
            {members.length>0?<div className="org-invite-summary-list">{members.map(m=><div className="org-invite-summary" key={m.id}><span><b>{m.name}</b><small>{m.phone} · {m.branch} · {specialtyLabel(m.specialty)}</small></span><div className="org-share-actions"><button type="button" onClick={()=>shareWhatsapp('technician',m)} className="org-share-wa"><MessageCircle size={16}/>{tr(lang,'واتساب','WhatsApp')}</button><button type="button" aria-label={tr(lang,'نسخ دعوة الفني','Copy technician invitation')} onClick={()=>copyInvite('technician',m)}><Copy size={16}/></button></div></div>)}</div>:<p className="org-muted">{tr(lang,'لم تتم إضافة فنيين. يمكن إضافة الفنيين لاحقًا من لوحة المدير.','No technicians added. They can also be added from the manager dashboard.')}</p>}
          </div>
          <div className="org-invite-section">
            <div className="org-invite-section-head"><span className="org-invite-section-icon"><ClipboardList size={19}/></span><div><h3>{tr(lang,'دعوة المبلّغين','Reporter invitation')}</h3><p>{tr(lang,'رابط واحد لموظفي المنشأة. يسجل كل موظف اسمه وبريده وكلمة المرور، ثم يختار الفرع من القائمة الموجودة في واجهة المبلّغ.','One organization-wide link. Each employee enters their name, email and password, then selects a branch in the reporter workspace.')}</p></div></div>
            <div className="org-share-actions org-reporter-share"><button type="button" className="org-share-wa" onClick={()=>shareWhatsapp('reporter')}><MessageCircle size={17}/>{tr(lang,'مشاركة عبر واتساب','Share on WhatsApp')}</button><button type="button" onClick={()=>shareEmail('reporter')}><Mail size={17}/>{tr(lang,'البريد الإلكتروني','Email')}</button><button type="button" onClick={()=>copyInvite('reporter')}><Copy size={17}/>{copied?tr(lang,'تم النسخ','Copied'):tr(lang,'نسخ الدعوة','Copy invitation')}</button></div>
          </div>
          <p className="org-final-disclosure">{tr(lang,'أزرار المشاركة تفتح واتساب أو البريد برسالة جاهزة. ربط الحسابات والتحقق من الصلاحيات يتطلبان خدمة تسجيل فعلية.','Share buttons open WhatsApp or email with a prepared invitation. Account verification and live permissions require backend authentication.')}</p>
        </div>}
        {error&&<p className="org-error" role="alert">{error}</p>}
        <div className="org-bottom">{step>0&&<button type="button" className="org-prev" onClick={()=>{setError('');setStep(s=>s-1)}}>{tr(lang,'السابق','Back')}</button>}
          <button type="submit" className="org-next">{step===4?tr(lang,'إنهاء الإعداد','Complete setup'):tr(lang,'التالي','Continue')}<ChevronLeft size={18}/></button>
        </div>
        <p className="org-small">{tr(lang,'لديك حساب بالفعل؟','Already have an account?')} <button type="button" className="org-inline-switch" onClick={()=>switchPage('/login')}>{tr(lang,'تسجيل الدخول','Sign in')}</button></p>
      </form>}
    </section>
  </div>
 </div>;
}
