import {useState,type FormEvent} from 'react';
import {Link,useLocation} from 'wouter';
import {ArrowLeft,ArrowRight,Building2,Check,CheckCircle2,ChevronLeft,ClipboardList,Copy,Eye,EyeOff,Mail,MapPin,Plus,ShieldCheck,UserRound,Users,Wrench,X,MessageCircle,Send,Smartphone,LogIn} from 'lucide-react';
import './organization-onboarding.css';

type Lang='ar'|'en';
type Role='manager'|'technician'|'reporter';
type Member={id:number;name:string;email:string;phone:string;role:Role;specialty:string;branch:string;status:'pending'};
type Site={id:number;city:string;name:string};
const tr=(lang:Lang,ar:string,en:string)=>lang==='ar'?ar:en;
const specialties=[['plumbing','سباكة ومياه','Plumbing'],['electrical','كهرباء وإنارة','Electrical'],['cooling','تكييف وتبريد','Cooling'],['general','صيانة عامة','General maintenance'],['civil','أعمال مدنية','Civil']];
const branches=(lang:Lang)=>[tr(lang,'المنشأة','Organization'),tr(lang,'المسؤول','Owner'),tr(lang,'الفرع','Branch'),tr(lang,'الصلاحيات','Access'),tr(lang,'الدعوات','Invites')];
export default function OrganizationOnboarding({lang,mode}:{lang:Lang;mode:'signup'|'login'}){
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
 const [newBranch,setNewBranch]=useState('');
 const [switching,setSwitching]=useState(false);
 const [reportersByInvite,setReportersByInvite]=useState(true);
 const [loginEmail,setLoginEmail]=useState('');
 const [loginPassword,setLoginPassword]=useState('');
 const set=(key:keyof typeof data,value:string)=>{setData(old=>({...old,[key]:value}));setError('')};
 const switchPage=(path:'/login'|'/signup')=>{setSwitching(true);window.setTimeout(()=>go(path),570)};
 const addSite=()=>{if(!newCity||!newBranch.trim()){setError(tr(lang,'اختاري المدينة واكتبي اسم الفرع.','Select a city and enter a branch name.'));return;}if(sites.some(x=>x.city===newCity&&x.name===newBranch.trim())){setError(tr(lang,'هذا الفرع مضاف بالفعل.','This branch already exists.'));return;}setSites(old=>[...old,{id:Date.now()+old.length,city:newCity,name:newBranch.trim()}]);setNewBranch('');setError('')};
 const siteNames=sites.map(s=>s.name);
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
   if(!member.name.trim()||(!member.phone.trim()&&!member.email.trim())||(member.email.trim()&&!/^\S+@\S+\.\S+$/.test(member.email))){
    setError(tr(lang,'أدخلي الاسم ورقم الجوال أو البريد الإلكتروني.','Enter a name and phone or email.'));return;
   }
   if(member.email.trim()&&members.some(x=>x.email.toLowerCase()===member.email.trim().toLowerCase())){
     setError(tr(lang,'هذا البريد مضاف مسبقًا.','This email is already added.'));return;
   }
   setMembers(old=>[...old,{...member,id:Date.now()+old.length,name:member.name.trim(),email:member.email.trim(),branch:member.branch||sites[0]?.name||data.branch,status:'pending'}]);
   setMember({name:'',email:'',phone:'',role:'technician',specialty:'plumbing',branch:''});setError('');
 };
 const next=(event:FormEvent<HTMLFormElement>)=>{
   event.preventDefault();setError('');
   if(step===1&&data.password.length<8){setError(tr(lang,'كلمة المرور لا تقل عن 8 أحرف.','Use at least 8 characters.'));return;}
   if(step===2&&sites.length===0){setError(tr(lang,'أضيفي فرعًا واحدًا على الأقل للمتابعة.','Add at least one branch to continue.'));return;}
   if(step===4){
     const snapshot={organization:data.organization,sector:data.sector,city:data.city,owner:data.owner,email:data.email,
       branch:data.branch,branchCity:data.branchCity,departments:data.departments,
       sites,members,reportersByInvite};
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
 const title=mode==='login'?tr(lang,'أهلًا بعودتك','Welcome back'):tr(lang,'كل شيء يبدأ من منشأتك','It starts with your organization');
 return <div className="org-screen" dir={lang==='ar'?'rtl':'ltr'}>
  <header className="org-top">
    <Link href="/" className="org-brand">تدارك <small>TADARUK</small></Link>
    <Link href="/" className="org-home"><Back size={16}/>{tr(lang,'الرئيسية','Home')}</Link>
  </header>
  <div className={`org-layout org-layout--${mode} ${switching?'org-switching':''}`}>
    <aside className="org-aside">
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
    </aside>
    <section className="org-panel">
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
        <h2>{tr(lang,'منشأتك جاهزة للانطلاق','Organization setup complete')}</h2>
        <p>{tr(lang,'تم تجهيز بيانات المنشأة والصلاحيات في هذه المعاينة. الدعوات محفوظة كمخطط، ولم تُرسل رسائل فعلية إلى الأعضاء.','Your setup and access plan are ready in this preview. No real invitations have been sent.')}</p>
        <div className="org-review"><b>{data.organization}</b><span>{data.branch}</span><span>{members.length} {tr(lang,'أعضاء تمت إضافتهم','team members added')}</span></div>
        <button type="button" className="org-next org-next--full" onClick={()=>go('/demo')}>{tr(lang,'الدخول إلى لوحة التحكم','Open dashboard')}<ChevronLeft size={18}/></button>
      </div>:<form className="org-form" onSubmit={next}>
        <span className="org-eyebrow">{tr(lang,'ابدئي بخطوات بسيطة','GET STARTED')}</span>
        <h2>{[
          tr(lang,'بيانات المنشأة','Organization details'),
          tr(lang,'حساب المسؤول','Account owner'),
          tr(lang,'إعداد الفرع الأول','First branch'),
          tr(lang,'صلاحيات أعضاء المنشأة','Team access'),
          tr(lang,'مراجعة الدعوات','Review invitations')
        ][step]}</h2>
        <div className="org-steps" aria-label={tr(lang,'خطوات إعداد المنشأة','Organization setup progress')}>
         {branches(lang).map((name,i)=><div key={name} className={i<step?'done':i===step?'current':''}><span>{i<step?<Check size={14}/>:i+1}</span><small>{name}</small></div>)}
        </div>
        {step===0&&<div className="org-fields">
          {field('organization','اسم المنشأة','Organization name',tr(lang,'مثال: مجموعة الأفق','Example: Horizon Group'))}
          <label className="org-field"><span>{tr(lang,'نوع المنشأة','Organization type')}</span><select required value={data.sector} onChange={e=>set('sector',e.target.value)}>
            <option value="">{tr(lang,'اختاري نوع المنشأة','Choose organization type')}</option>
            {[['restaurant','مطاعم ومقاهي','Restaurants'],['health','منشأة صحية','Healthcare'],['education','تعليمية','Education'],['retail','تجزئة ومتاجر','Retail'],['office','مكاتب ومنشآت','Offices'],['other','أخرى','Other']].map(([v,ar,en])=><option key={v} value={v}>{tr(lang,ar,en)}</option>)}
          </select></label>
          {field('city','المدينة','City',tr(lang,'الرياض','Riyadh'))}
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
          <p className="org-muted">{tr(lang,'أضيفي فروع المنشأة حسب مدنها؛ يمكن إضافة أكثر من فرع في كل مدينة.','Add branches by city; you can add multiple branches in each city.')}</p>
          <div className="org-fields">
            <label className="org-field"><span>{tr(lang,'المدينة','City')}</span><select value={newCity} onChange={e=>setNewCity(e.target.value)}><option value="">{tr(lang,'اختاري المدينة','Select a city')}</option>{[['الرياض','Riyadh'],['جدة','Jeddah'],['مكة','Makkah'],['المدينة المنورة','Madinah'],['الدمام','Dammam'],['الخبر','Khobar'],['جازان','Jazan'],['أبو عريش','Abu Arish'],['أبها','Abha'],['تبوك','Tabuk'],['حائل','Hail'],['بريدة','Buraydah'],['الطائف','Taif'],['نجران','Najran'],['ينبع','Yanbu'],['الأحساء','Al Ahsa']].map(([ar,en])=><option key={ar} value={ar}>{tr(lang,ar,en)}</option>)}</select></label>
            <label className="org-field"><span>{tr(lang,'اسم الفرع','Branch name')}</span><input value={newBranch} onChange={e=>setNewBranch(e.target.value)} placeholder={tr(lang,'مثال: فرع العليا','Example: Olaya branch')}/></label>
          </div>
          <button type="button" className="org-add" onClick={addSite}><Plus size={17}/>{tr(lang,'إضافة الفرع','Add branch')}</button>
          {sites.length>0&&<div className="org-site-groups">{Array.from(new Set(sites.map(s=>s.city))).map(city=><div className="org-city-group" key={city}><div className="org-city-heading"><MapPin size={15}/><b>{city}</b><small>{sites.filter(s=>s.city===city).length} {tr(lang,'فروع','branches')}</small></div><div className="org-site-chips">{sites.filter(s=>s.city===city).map(s=><span key={s.id}>{s.name}<button type="button" aria-label={tr(lang,'حذف الفرع','Remove branch')} onClick={()=>setSites(old=>old.filter(x=>x.id!==s.id))}><X size={13}/></button></span>)}</div></div>)}</div>}
          <div className="org-info-inline"><MapPin size={16}/>{tr(lang,'سيشاهد المبلّغ الفروع التي أضافتها منشأته في قائمة الفروع الموجودة أصلًا في واجهته.','Reporters will choose from their organization’s branches in the existing branch selector.')}</div>
        </div>}
        {step===3&&<div className="org-access-page">
          <div className="org-access-explain">
            <div><span className="org-access-icon"><Wrench size={18}/></span><b>{tr(lang,'الفني','Technician')}</b><small>{tr(lang,'يستقبل البلاغات المسندة له ويحدّث حالة الإصلاح.','Sees assigned tickets and updates repairs.')}</small></div>
            <div><span className="org-access-icon"><Users size={18}/></span><b>{tr(lang,'المدير','Manager')}</b><small>{tr(lang,'يدير فروعه والفنيين والإسناد والمتابعة.','Manages branches, technicians, assignments and follow-ups.')}</small></div>
            <div><span className="org-access-icon"><ClipboardList size={18}/></span><b>{tr(lang,'المبلّغ','Reporter')}</b><small>{tr(lang,'يرسل بلاغاته ويتابع بلاغاته فقط.','Submits and tracks only their own reports.')}</small></div>
          </div>
          <div className="org-access-heading"><h3>{tr(lang,'إضافة الفنيين والمديرين','Add technicians and managers')}</h3><small>{sites.length} {tr(lang,'فروع','branches')}</small></div>
          <div className="org-fields">
            <label className="org-field"><span>{tr(lang,'اسم العضو','Member name')}</span><input value={member.name} placeholder={tr(lang,'الاسم الكامل','Full name')} onChange={e=>setMember(m=>({...m,name:e.target.value}))}/></label>
            <label className="org-field"><span>{tr(lang,'رقم جوال الفني','Phone number')}</span><input type="tel" value={member.phone} placeholder="05XXXXXXXX" onChange={e=>setMember(m=>({...m,phone:e.target.value}))}/></label><label className="org-field"><span>{tr(lang,'البريد الإلكتروني (اختياري)','Email (optional)')}</span><input type="email" value={member.email} placeholder="employee@company.com" onChange={e=>setMember(m=>({...m,email:e.target.value}))}/></label>
            <label className="org-field"><span>{tr(lang,'الدور والصلاحية','Role and access')}</span><select value={member.role} onChange={e=>setMember(m=>({...m,role:e.target.value as Role}))}>
              <option value="technician">{tr(lang,'فني','Technician')}</option><option value="manager">{tr(lang,'مدير فرع','Branch manager')}</option><option value="reporter">{tr(lang,'مبلّغ','Reporter')}</option>
            </select></label>
            {member.role==='technician'&&<label className="org-field"><span>{tr(lang,'التخصص','Specialization')}</span><select value={member.specialty} onChange={e=>setMember(m=>({...m,specialty:e.target.value}))}>{specialties.map(([v,ar,en])=><option key={v} value={v}>{tr(lang,ar,en)}</option>)}</select></label>}<label className="org-field"><span>{tr(lang,'الفرع التابع له','Assigned branch')}</span><select value={member.branch||sites[0]?.name||''} onChange={e=>setMember(m=>({...m,branch:e.target.value}))}>{sites.map(s=><option key={s.id} value={s.name}>{s.name} · {s.city}</option>)}</select></label>
          </div>
          <button type="button" className="org-add" onClick={addMember}><Plus size={16}/>{tr(lang,'إضافة إلى قائمة الدعوات','Add to invitations')}</button>
          {members.length>0&&<div className="org-invite-list">{members.map(m=><div key={m.id}><span className="org-invite-avatar"><UserRound size={17}/></span><span className="org-invite-person"><b>{m.name}</b><small>{m.phone||m.email} · {m.branch}</small></span><span className="org-role-pill">{m.role==='manager'?tr(lang,'مدير','Manager'):m.role==='reporter'?tr(lang,'مبلّغ','Reporter'):tr(lang,'فني','Technician')}</span><button type="button" className="org-whatsapp-icon" aria-label={tr(lang,'مشاركة دعوة واتساب','Share WhatsApp invite')} onClick={()=>shareWhatsapp(m.role,m)}><MessageCircle size={17}/></button><button type="button" onClick={()=>setMembers(a=>a.filter(x=>x.id!==m.id))} aria-label={tr(lang,'حذف','Remove')}><X size={16}/></button></div>)}</div>}
          <label className="org-reporter-access"><input type="checkbox" checked={reportersByInvite} onChange={e=>setReportersByInvite(e.target.checked)}/><span><b>{tr(lang,'السماح بانضمام المبلّغين عبر دعوة الفرع','Let reporters join using a branch invitation')}</b><small>{tr(lang,'أي موظف لديه دعوة الفرع يستطيع طلب حساب مبلّغ. لن تحتاجي إضافته يدويًا؛ ويُربط بفرعه بعد التحقق.','Branch staff can request a reporter account using a branch invite, then join after verification.')}</small></span></label>
        </div>}
        {step===4&&<div className="org-final-review">
          <div className="org-final-organization"><Building2 size={21}/><span><b>{data.organization}</b><small>{sites.length} {tr(lang,'فروع','branches')} · {Array.from(new Set(sites.map(s=>s.city))).join('، ')}</small></span></div>
          <h3>{tr(lang,'دعوات الفريق','Team invitations')}</h3>
          {members.length>0?members.map(m=><div className="org-invite-summary" key={m.id}>
            <span><b>{m.name}</b><small>{m.phone||m.email} · {m.branch}</small></span>
            <div className="org-share-actions"><button type="button" onClick={()=>shareWhatsapp(m.role,m)} className="org-share-wa"><MessageCircle size={15}/>{tr(lang,'واتساب','WhatsApp')}</button>{m.email&&<button type="button" onClick={()=>shareEmail(m.role,m)}><Mail size={15}/></button>}<button type="button" onClick={()=>copyInvite(m.role,m)}><Copy size={15}/></button></div>
          </div>):<p className="org-muted">{tr(lang,'لم تضيفي أعضاء بعد. يمكنك إضافتهم من لوحة الإدارة لاحقًا.','No members yet. You can invite them later from the dashboard.')}</p>}
          <div className="org-flow-explainer">
            <h3>{tr(lang,'كيف تصل الصلاحيات؟','How does access work?')}</h3>
            <div><span>1</span>{tr(lang,'المسؤول يحدد الفرع والدور والتخصص للفني.','The owner defines each member’s branch, role and specialty.')}</div>
            <div><span>2</span>{tr(lang,'بعد تفعيل خدمة الدعوات يصل رابط خاص لكل عضو.','When invitations are enabled, each member gets their own invitation link.')}</div>
            <div><span>3</span>{tr(lang,'بعد قبول الدعوة وتعيين كلمة المرور يدخل العضو لواجهته فقط.','After accepting and setting a password, they access their assigned workspace.')}</div>
          </div>
          {reportersByInvite&&<div className="org-branch-link">
            <b>{tr(lang,'انضمام المبلّغين للفرع','Reporter joining')}</b>
            <p>{tr(lang,'يمكن للموظفين طلب الانضمام إلى الفرع عبر رابط دعوة؛ مدير المنشأة لا يحتاج إنشاء حساب لكل مبلّغ.','Staff can request reporter access via branch invitation; the manager does not need to add every reporter manually.')}</p>
            <div className="org-share-actions"><button type="button" className="org-share-wa" onClick={()=>shareWhatsapp('reporter')}><MessageCircle size={17}/>{tr(lang,'مشاركة عبر واتساب','Share via WhatsApp')}</button><button type="button" onClick={()=>shareEmail('reporter')}><Mail size={17}/>{tr(lang,'البريد','Email')}</button><button type="button" onClick={()=>copyInvite('reporter')}><Copy size={17}/>{copied?tr(lang,'تم النسخ','Copied'):tr(lang,'نسخ','Copy')}</button></div>
          </div>}
          <p className="org-final-disclosure">{tr(lang,'تفتح أزرار المشاركة تطبيق واتساب أو البريد برسالة جاهزة. تفعيل الحساب والصلاحيات الفعلية يتطلب ربط نظام المصادقة والدعوات.','Sharing opens WhatsApp or email with a prefilled message. Live activation and authorization require an authentication backend.')}</p>
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
