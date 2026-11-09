import {useState,type FormEvent} from 'react';
import {Link,useLocation} from 'wouter';
import {ArrowLeft,ArrowRight,Building2,Check,CheckCircle2,ChevronLeft,ClipboardList,Copy,Eye,EyeOff,Mail,MapPin,Plus,ShieldCheck,UserRound,Users,Wrench,X} from 'lucide-react';
import './organization-onboarding.css';

type Lang='ar'|'en';
type Role='manager'|'technician'|'reporter';
type Member={id:number;name:string;email:string;role:Role;specialty:string;branch:string;status:'pending'};
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
 const [member,setMember]=useState({name:'',email:'',role:'technician' as Role,specialty:'plumbing'});
 const [reportersByInvite,setReportersByInvite]=useState(true);
 const [loginEmail,setLoginEmail]=useState('');
 const [loginPassword,setLoginPassword]=useState('');
 const set=(key:keyof typeof data,value:string)=>{setData(old=>({...old,[key]:value}));setError('')};
 const entryUrl=typeof window==='undefined'?'':window.location.origin+'/login';
 const inviteText=tr(lang,`انضم إلى فريق ${data.organization||'المنشأة'} على تدارك. الفرع: ${data.branch||'الفرع'}. افتح رابط تسجيل الدخول: ${entryUrl} (رابط تعريفي - دعوات الحسابات غير مفعلة بعد).`,`Join ${data.organization||'our organization'} on Tadaruk. Branch: ${data.branch||'branch'}. Sign in: ${entryUrl} (Invitation activation is not yet connected).`);
 const copy=()=>{if(navigator.clipboard){void navigator.clipboard.writeText(inviteText).then(()=>setCopied(true)).catch(()=>setCopied(false))}};
 const addMember=()=>{
   if(!member.name.trim()||!member.email.trim()||!/^\S+@\S+\.\S+$/.test(member.email)){
    setError(tr(lang,'أدخلي اسم العضو وبريده الإلكتروني الصحيح.','Enter a name and a valid email.'));return;
   }
   if(members.some(x=>x.email.toLowerCase()===member.email.trim().toLowerCase())){
     setError(tr(lang,'هذا البريد مضاف مسبقًا.','This email is already added.'));return;
   }
   setMembers(old=>[...old,{...member,id:Date.now()+old.length,name:member.name.trim(),email:member.email.trim(),branch:data.branch,status:'pending'}]);
   setMember({name:'',email:'',role:'technician',specialty:'plumbing'});setError('');
 };
 const next=(event:FormEvent<HTMLFormElement>)=>{
   event.preventDefault();setError('');
   if(step===1&&data.password.length<8){setError(tr(lang,'كلمة المرور لا تقل عن 8 أحرف.','Use at least 8 characters.'));return;}
   if(step===4){
     const snapshot={organization:data.organization,sector:data.sector,city:data.city,owner:data.owner,email:data.email,
       branch:data.branch,branchCity:data.branchCity,departments:data.departments,
       members,reportersByInvite};
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
 const title=mode==='login'?tr(lang,'أهلًا بعودتك','Welcome back'):tr(lang,'إدارة صيانة أذكى تبدأ من هنا','Better maintenance starts here');
 return <div className="org-screen" dir={lang==='ar'?'rtl':'ltr'}>
  <header className="org-top">
    <Link href="/" className="org-brand">تدارك <small>TADARUK</small></Link>
    <Link href="/" className="org-home"><Back size={16}/>{tr(lang,'الرئيسية','Home')}</Link>
  </header>
  <div className={`org-layout org-layout--${mode}`}>
    <aside className="org-aside">
      <div className="org-aside-visual" aria-hidden="true">
        <span className="org-visual-orbit"/>
        <span className="org-visual-card"><Building2 size={35}/><i/><i/></span>
        <span className="org-visual-spark"><Check size={17}/></span>
      </div>
      <span className="org-pill"><ShieldCheck size={15}/>{tr(lang,'مساحة منشأتك','Your organization workspace')}</span>
      <h1>{title}</h1>
      <p>{mode==='login'?tr(lang,'كل فريق الصيانة والبلاغات في مكان واحد.','Your maintenance team and reports in one place.'):tr(lang,'سجلي منشأتك، أضيفي الفروع، وحددي صلاحيات الفريق بسهولة.','Create your organization, add branches, and assign access to your team.')}</p>
      <div className="org-aside-point"><Building2 size={19}/>{tr(lang,'إدارة الفروع من مكان واحد','Manage all branches')}</div>
      <div className="org-aside-point"><Wrench size={19}/>{tr(lang,'توزيع المهام حسب التخصص','Assign by specialization')}</div>
      <div className="org-aside-point"><ClipboardList size={19}/>{tr(lang,'متابعة كل بلاغ حتى إغلاقه','Track reports to closure')}</div>
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
        <p className="org-auth-helper">{tr(lang,'سيتم توجيهك إلى اختيار حساب العرض؛ تسجيل الدخول الفعلي يتطلب ربط خدمة الحسابات.','Continue to a demo account; live authentication is not yet connected.')}</p>
        <p className="org-small">{tr(lang,'ليس لديك حساب؟','New to Tadaruk?')} <Link href="/signup">{tr(lang,'إنشاء حساب منشأة','Create an account')}</Link></p>
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
        {step===2&&<div className="org-fields">
          {field('branch','اسم الفرع الأول','First branch name',tr(lang,'فرع العليا','Olaya branch'))}
          {field('branchCity','مدينة الفرع','Branch city',tr(lang,'الرياض','Riyadh'))}
          {field('departments','أقسام الفرع (اختياري)','Departments (optional)',tr(lang,'المطبخ، الاستقبال، المستودع','Kitchen, reception, storage'),'text',false)}
          <div className="org-info-inline"><MapPin size={18}/>{tr(lang,'يمكنك إضافة فروع ومواقع أخرى من لوحة المدير لاحقًا.','You can add more branches and locations later.')}</div>
        </div>}
        {step===3&&<div className="org-access-page">
          <div className="org-access-explain">
            <div><span className="org-access-icon"><Wrench size={18}/></span><b>{tr(lang,'الفني','Technician')}</b><small>{tr(lang,'يستقبل البلاغات المسندة له ويحدّث حالة الإصلاح.','Sees assigned tickets and updates repairs.')}</small></div>
            <div><span className="org-access-icon"><Users size={18}/></span><b>{tr(lang,'المدير','Manager')}</b><small>{tr(lang,'يدير فروعه والفنيين والإسناد والمتابعة.','Manages branches, technicians, assignments and follow-ups.')}</small></div>
            <div><span className="org-access-icon"><ClipboardList size={18}/></span><b>{tr(lang,'المبلّغ','Reporter')}</b><small>{tr(lang,'يرسل بلاغاته ويتابع بلاغاته فقط.','Submits and tracks only their own reports.')}</small></div>
          </div>
          <div className="org-access-heading"><h3>{tr(lang,'إضافة أعضاء الفريق','Add team members')}</h3><small>{data.branch}</small></div>
          <div className="org-fields">
            <label className="org-field"><span>{tr(lang,'اسم العضو','Member name')}</span><input value={member.name} placeholder={tr(lang,'الاسم الكامل','Full name')} onChange={e=>setMember(m=>({...m,name:e.target.value}))}/></label>
            <label className="org-field"><span>{tr(lang,'البريد الإلكتروني','Email address')}</span><input type="email" value={member.email} placeholder="employee@company.com" onChange={e=>setMember(m=>({...m,email:e.target.value}))}/></label>
            <label className="org-field"><span>{tr(lang,'الدور والصلاحية','Role and access')}</span><select value={member.role} onChange={e=>setMember(m=>({...m,role:e.target.value as Role}))}>
              <option value="technician">{tr(lang,'فني','Technician')}</option><option value="manager">{tr(lang,'مدير فرع','Branch manager')}</option><option value="reporter">{tr(lang,'مبلّغ','Reporter')}</option>
            </select></label>
            {member.role==='technician'&&<label className="org-field"><span>{tr(lang,'التخصص','Specialization')}</span><select value={member.specialty} onChange={e=>setMember(m=>({...m,specialty:e.target.value}))}>{specialties.map(([v,ar,en])=><option key={v} value={v}>{tr(lang,ar,en)}</option>)}</select></label>}
          </div>
          <button type="button" className="org-add" onClick={addMember}><Plus size={16}/>{tr(lang,'إضافة إلى قائمة الدعوات','Add to invitations')}</button>
          {members.length>0&&<div className="org-invite-list">{members.map(m=><div key={m.id}><span className="org-invite-avatar"><UserRound size={17}/></span><span className="org-invite-person"><b>{m.name}</b><small>{m.email}</small></span><span className="org-role-pill">{m.role==='manager'?tr(lang,'مدير','Manager'):m.role==='reporter'?tr(lang,'مبلّغ','Reporter'):tr(lang,'فني','Technician')}</span><button type="button" onClick={()=>setMembers(a=>a.filter(x=>x.id!==m.id))} aria-label={tr(lang,'حذف','Remove')}><X size={16}/></button></div>)}</div>}
          <label className="org-reporter-access"><input type="checkbox" checked={reportersByInvite} onChange={e=>setReportersByInvite(e.target.checked)}/><span><b>{tr(lang,'السماح بانضمام المبلّغين عبر دعوة الفرع','Let reporters join using a branch invitation')}</b><small>{tr(lang,'أي موظف لديه دعوة الفرع يستطيع طلب حساب مبلّغ. لن تحتاجي إضافته يدويًا؛ ويُربط بفرعه بعد التحقق.','Branch staff can request a reporter account using a branch invite, then join after verification.')}</small></span></label>
        </div>}
        {step===4&&<div className="org-final-review">
          <div className="org-final-organization"><Building2 size={21}/><span><b>{data.organization}</b><small>{data.branch} · {data.branchCity}</small></span></div>
          <h3>{tr(lang,'دعوات الفريق','Team invitations')}</h3>
          {members.length>0?members.map(m=><div className="org-invite-summary" key={m.id}>
            <span><b>{m.name}</b><small>{m.email} · {m.branch}</small></span>
            <span className="org-pending-pill">{tr(lang,'دعوة جاهزة','Invite prepared')}</span>
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
            <button type="button" className="org-add" onClick={copy}><Copy size={16}/>{copied?tr(lang,'نُسخ النص التعريفي','Intro text copied'):tr(lang,'نسخ رسالة تعريفية','Copy introduction')}</button>
          </div>}
          <p className="org-final-disclosure">{tr(lang,'لن تُرسل الدعوات فعليًا حتى يتم ربط خدمة الحسابات والتحقق.','Invitations will be delivered once account and verification services are connected.')}</p>
        </div>}
        {error&&<p className="org-error" role="alert">{error}</p>}
        <div className="org-bottom">{step>0&&<button type="button" className="org-prev" onClick={()=>{setError('');setStep(s=>s-1)}}>{tr(lang,'السابق','Back')}</button>}
          <button type="submit" className="org-next">{step===4?tr(lang,'إنهاء الإعداد','Complete setup'):tr(lang,'التالي','Continue')}<ChevronLeft size={18}/></button>
        </div>
        <p className="org-small">{tr(lang,'لديك حساب بالفعل؟','Already have an account?')} <Link href="/login">{tr(lang,'تسجيل الدخول','Sign in')}</Link></p>
      </form>}
    </section>
  </div>
 </div>;
}
