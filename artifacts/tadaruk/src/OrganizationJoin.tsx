import {useState,type FormEvent} from 'react';
import {Link,useLocation} from 'wouter';
import {Building2,CheckCircle2,ClipboardList,LockKeyhole,Mail,Phone,ShieldCheck,UserRound,Wrench} from 'lucide-react';
import './organization-onboarding.css';
type Lang='ar'|'en';
const tr=(l:Lang,ar:string,en:string)=>l==='ar'?ar:en;
export default function OrganizationJoin({lang}:{lang:Lang}){
 const [,go]=useLocation();
 const params=new URLSearchParams(typeof window!=='undefined'?window.location.search:'');
 const role=params.get('role')==='technician'?'technician':params.get('role')==='manager'?'manager':'reporter';
 const organization=params.get('organization')||'تدارك';
 const branch=params.get('branch')||'';
 const name=params.get('name')||'';
 const specialty=params.get('specialty')||'';
 const [form,setForm]=useState({name,phone:'',email:'',password:''});
 const [complete,setComplete]=useState(false);
 const label=role==='technician'?tr(lang,'فني','Technician'):role==='manager'?tr(lang,'مدير','Manager'):tr(lang,'مبلّغ','Reporter');
 const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setComplete(true)};
 return <main className="org-screen org-join-screen" dir={lang==='ar'?'rtl':'ltr'}>
  <header className="org-top"><Link href="/" className="org-brand">تدارك <small>TADARUK</small></Link><Link href="/login" className="org-home">{tr(lang,'تسجيل الدخول','Sign in')}</Link></header>
  <div className="org-join-card">
   {complete?<div className="org-success"><CheckCircle2 size={46}/><h2>{tr(lang,'تم استكمال بيانات الدعوة','Invitation details completed')}</h2><p>{tr(lang,'يمكنك الآن تجربة واجهة الدور. التفعيل الحقيقي يتطلب التحقق من الدعوة وإنشاء الحساب على الخادم.','You can now explore the role. Live activation requires a verified invitation and server-side account creation.')}</p><button className="org-next" onClick={()=>go('/demo')}>{tr(lang,'استكشف تدارك','Explore Tadaruk')}</button></div>:<>
    <div className="org-join-heading"><span className="org-join-icon">{role==='technician'?<Wrench size={26}/>:<ClipboardList size={26}/>}</span><h1>{tr(lang,'انضم إلى فريق تدارك','Join the Tadaruk team')}</h1><p>{tr(lang,'أكملي بيانات الحساب للانضمام إلى منشأتك','Complete your account information to join your organization.')}</p></div>
    <div className="org-join-org"><Building2 size={21}/><span><b>{organization}</b><small>{branch&&role!=='reporter'?branch+' · ':''}{label}{specialty&&role==='technician'?' · '+specialty:''}</small></span><ShieldCheck size={17}/></div>
    <form className="org-form" onSubmit={submit}>
     <div className="org-fields">
      <label className="org-field"><span>{tr(lang,'الاسم الكامل','Full name')}</span><input required value={form.name} onChange={e=>setForm(s=>({...s,name:e.target.value}))} placeholder={tr(lang,'اسم الموظف','Employee name')}/></label>
      <label className="org-field"><span>{tr(lang,'رقم الجوال','Mobile')}</span><input required type="tel" value={form.phone} onChange={e=>setForm(s=>({...s,phone:e.target.value}))} placeholder="05XXXXXXXX"/></label>
      <label className="org-field"><span>{tr(lang,'البريد الإلكتروني','Email')}</span><input required type="email" value={form.email} onChange={e=>setForm(s=>({...s,email:e.target.value}))} placeholder="name@company.com"/></label>
      <label className="org-field"><span>{tr(lang,'كلمة المرور','Password')}</span><input required minLength={8} type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm(s=>({...s,password:e.target.value}))} placeholder={tr(lang,'8 أحرف على الأقل','At least 8 characters')}/></label>
     </div>
     <button type="submit" className="org-next org-next--full">{tr(lang,'تفعيل حسابي','Activate my account')}</button>
     <p className="org-final-disclosure">{tr(lang,'صفحة تجربة لتوضيح رحلة الدعوة؛ لا تحفظ كلمة المرور ولا تنشئ حسابًا حقيقيًا.','This is an interactive invitation preview; no password is stored or real account created.')}</p>
    </form>
   </>}
  </div>
 </main>
}
