import {useEffect,useState,type FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useListDemoUsers,useSelectDemoAccount,getGetDemoSessionQueryKey,type DemoUser} from '@workspace/api-client-react';
import {Link,useLocation} from 'wouter';
import {Building2,ClipboardList,Eye,EyeOff,LockKeyhole,Mail,Wrench,ArrowLeft,Languages} from 'lucide-react';
import SunMoonThemeToggle from './components/ui/sun-moon-theme-toggle';
import StripedWaves from './components/StripedWaves';
import OrganizationOnboarding from './OrganizationOnboarding';
import './auth-morph.css';

type Lang='ar'|'en';
const tr=(lang:Lang,ar:string,en:string)=>lang==='ar'?ar:en;
const FALLBACK_DEMO_USERS:DemoUser[]=[
{id:'demo-manager',name:'فهد السليمان',role:'manager',initials:'فس',branchId:null,branchName:null,specialization:null},
{id:'demo-tech',name:'خالد الحربي',role:'technician',initials:'خح',branchId:'branch-olaya',branchName:'فرع العليا',specialization:'plumbing'},
{id:'demo-reporter',name:'سارة القحطاني',role:'reporter',initials:'سق',branchId:'branch-olaya',branchName:'فرع العليا',specialization:null}
];

export default function AuthMorph({lang,setLang,dark,setDark}:{lang:Lang;setLang:(v:Lang)=>void;dark:boolean;setDark:(v:boolean)=>void}){
 const [path,go]=useLocation();
 const signupRoute=path.startsWith('/signup');
 const [signup,setSignup]=useState(signupRoute);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 const [showRecovery,setShowRecovery]=useState(false);
 const [loginNotice,setLoginNotice]=useState('');
 const qc=useQueryClient();
 const {data:users}=useListDemoUsers();
 const demoUsers=Array.isArray(users)&&users.length?users:FALLBACK_DEMO_USERS;
 const selectDemo=useSelectDemoAccount();
 const enterDemo=(role:string)=>{
   const user=demoUsers.find(item=>item.role===role)??FALLBACK_DEMO_USERS.find(item=>item.role===role);
   if(!user)return;
   try{localStorage.setItem('tadaruk-demo-session-user',JSON.stringify(user));}catch{}
   selectDemo.mutate({data:{userId:user.id}},{
     onSuccess:()=>{void qc.invalidateQueries({queryKey:getGetDemoSessionQueryKey()});go('/workspace');},
     onError:()=>go('/workspace')
   });
 };
 useEffect(()=>{setSignup(signupRoute)},[signupRoute]);
 const toggle=(next:boolean)=>{if(next===signup)return;setSignup(next);window.setTimeout(()=>go(next?'/signup':'/login'),90)};
 const onLogin=(event:FormEvent<HTMLFormElement>)=>{
   event.preventDefault();
   // Real credentials are not authenticated by the current demo backend.
   setLoginNotice(tr(lang,'تسجيل الدخول بالبريد لم يُفعّل بعد. للدخول الآن، اختَر أحد الحسابات التجريبية أدناه.','Email/password authentication is not enabled yet. Choose a demo account below to enter.'));
 };
 const roles=[
   {name:tr(lang,'المدير','Manager'),note:tr(lang,'إدارة الفروع','Manage branches'),icon:Building2,role:'manager'},
   {name:tr(lang,'الفني','Technician'),note:tr(lang,'متابعة مهامي','Assigned tasks'),icon:Wrench,role:'technician'},
   {name:tr(lang,'المبلّغ','Reporter'),note:tr(lang,'تقديم بلاغ','Report an issue'),icon:ClipboardList,role:'reporter'},
 ];
 return <main className="auth-morph-page" dir={lang==='ar'?'rtl':'ltr'}>
  <div className="auth-striped-waves" aria-hidden="true">
    <StripedWaves preset="2" background={dark?'#0d2238':'#e8f4fa'} color1={dark?'#5de6ef':'#80b7d3'} color2={dark?'#3692bc':'#9ac7de'} color3={dark?'#a0d0ed':'#b8d9e9'} speed={20} density={52} lineWidth={40} distance={115} angle={38} glowOnHover={false}/>
  </div>
  <header className="auth-morph-header">
    <Link href="/" className="auth-morph-brand" aria-label={tr(lang,'تدارك - الرئيسية','Tadaruk - Home')}><img src={`${import.meta.env.BASE_URL}${dark?'brand-logo-dark.png':'brand-logo.png'}`} alt="تدارك TADARUK" /></Link>
    <div className="nav-actions auth-morph-header-actions">
      <button className="nav-lang" type="button" onClick={()=>setLang(lang==='ar'?'en':'ar')} aria-label={tr(lang,'التبديل إلى الإنجليزية','Switch to Arabic')}><Languages size={16}/><span>{lang==='ar'?'English':'العربية'}</span></button>
      <SunMoonThemeToggle className="landing-theme-toggle" theme={dark?'dark':'light'} onThemeChange={theme=>setDark(theme==='dark')} aria-label={dark?tr(lang,'تفعيل الوضع الفاتح','Switch to light mode'):tr(lang,'تفعيل الوضع الداكن','Switch to dark mode')} data-testid="theme-toggle-auth" size={40} duration={860}/>
      
    </div>
    <Link href="/" className="auth-morph-home"><ArrowLeft size={17}/>{tr(lang,'رجوع','Back')}</Link>
  </header>
  <section className={`auth-morph-card ${signup?'auth-morph-signup':''}`} aria-label={tr(lang,'الدخول وإنشاء الحساب','Sign in and registration')}>
    <div className="auth-signup-back" aria-hidden={!signup}><button type="button" onClick={()=>toggle(false)} tabIndex={signup?0:-1}><span className="auth-signup-back-icon"><ArrowLeft size={18}/></span><span>{tr(lang,'رجوع','Back')}</span></button></div>
    <div className="auth-morph-form-area">
     <div className="auth-morph-login" aria-hidden={signup}>
      <form className="auth-morph-login-form" onSubmit={onLogin}>
       <h1>{tr(lang,'تسجيل الدخول','Sign in')}</h1>
       <p className="auth-morph-subtitle">{tr(lang,'العودة إلى مساحة الصيانة','Welcome back to your workspace')}</p>
       <label className="auth-morph-input"><Mail size={19}/><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={tr(lang,'البريد الإلكتروني','Email address')} tabIndex={signup?-1:0}/></label>
       <label className="auth-morph-input"><LockKeyhole size={19}/><input type={showPassword?'text':'password'} minLength={4} required autoComplete="current-password" placeholder={tr(lang,'كلمة المرور','Password')} value={password} onChange={e=>setPassword(e.target.value)} tabIndex={signup?-1:0}/><button type="button" aria-label={tr(lang,'إظهار أو إخفاء كلمة المرور','Toggle password visibility')} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></label>
       <button type="submit" className="auth-morph-primary" tabIndex={signup?-1:0}>{tr(lang,'دخول','Sign in')}</button>
       <button type="button" className="auth-morph-forgot" onClick={()=>setShowRecovery(v=>!v)} tabIndex={signup?-1:0} aria-expanded={showRecovery}>{tr(lang,'نسيت كلمة المرور؟','Forgot your password?')}</button>
       {showRecovery&&<p className="auth-morph-login-notice" role="status">{tr(lang,'في النسخة التجريبية، اطلب إعادة تعيين كلمة المرور من مدير المنشأة؛ استعادة البريد لم تُفعّل بعد.','In this demo, contact your organization manager to reset access. Email recovery is not yet enabled.')}</p>}
       {loginNotice&&<p className="auth-morph-login-notice" role="status">{loginNotice}</p>}
       <div className="auth-morph-demo">
         <small>{tr(lang,'الدخول بحساب تجريبي','Try a demo account')}</small>
         <div className="auth-morph-roles">{roles.map(({name,role,note,icon:Icon})=><button type="button" key={role} tabIndex={signup?-1:0} className="auth-morph-role" onClick={()=>enterDemo(role)} disabled={selectDemo.isPending} title={note}><span><Icon size={23}/></span><b>{name}</b><small>{note}</small></button>)}</div>
       </div>
      </form>
     </div>
     <div className="auth-morph-register" aria-hidden={!signup}>
       <div className="auth-morph-register-content">
         <OrganizationOnboarding lang={lang} mode="signup" embedded/>
       </div>
     </div>
    </div>
    <div className="auth-morph-panels" aria-hidden="false">
      <div className="auth-morph-panel auth-morph-left">
        <div className="auth-morph-panel-content">
          <h2>{tr(lang,'جديد في تدارك؟','New to Tadaruk?')}</h2>
          <p>{tr(lang,'أنشئ حساب المنشأة وابدأ بتنظيم الفروع وفريق الصيانة.','Create your organization and manage branches and maintenance staff.')}</p>
         <button type="button" onClick={()=>toggle(true)} tabIndex={signup?-1:0}>{tr(lang,'إنشاء حساب منشأة','Create account')}</button>
        </div>
      </div>
      <div className="auth-morph-panel auth-morph-right">
        <div className="auth-morph-panel-content">
         <h2>{tr(lang,'لديك حساب بالفعل؟','Already have an account?')}</h2>
         <p>{tr(lang,'الدخول إلى حسابك ومتابعة أعمال الصيانة من مكان واحد.','Sign in and continue where you left off.')}</p>
         <button type="button" onClick={()=>toggle(false)} tabIndex={signup?0:-1}>{tr(lang,'تسجيل الدخول','Sign in')}</button>
        </div>
      </div>
    </div>
  </section>
 </main>;
}
