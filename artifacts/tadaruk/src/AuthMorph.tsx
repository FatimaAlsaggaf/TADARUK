import {useEffect,useState,type FormEvent} from 'react';
import {Link,useLocation} from 'wouter';
import {Building2,ClipboardList,Eye,EyeOff,LockKeyhole,Mail,Wrench,ArrowLeft,Languages} from 'lucide-react';
import SunMoonThemeToggle from './components/ui/sun-moon-theme-toggle';
import DarkVeil from './AuthDarkVeil';
import OrganizationOnboarding from './OrganizationOnboarding';
import './auth-morph.css';

type Lang='ar'|'en';
const tr=(lang:Lang,ar:string,en:string)=>lang==='ar'?ar:en;

export default function AuthMorph({lang,setLang,dark,setDark}:{lang:Lang;setLang:(v:Lang)=>void;dark:boolean;setDark:(v:boolean)=>void}){
 const [path,go]=useLocation();
 const signupRoute=path.startsWith('/signup');
 const [signup,setSignup]=useState(signupRoute);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [showPassword,setShowPassword]=useState(false);
 useEffect(()=>{setSignup(signupRoute)},[signupRoute]);
 const toggle=(next:boolean)=>{if(next===signup)return;setSignup(next);window.setTimeout(()=>go(next?'/signup':'/login'),90)};
 const onLogin=(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();go('/demo')};
 const roles=[
   {name:tr(lang,'المدير','Manager'),note:tr(lang,'إدارة الفروع','Manage branches'),icon:Building2,role:'manager'},
   {name:tr(lang,'الفني','Technician'),note:tr(lang,'متابعة مهامي','Assigned tasks'),icon:Wrench,role:'technician'},
   {name:tr(lang,'المبلّغ','Reporter'),note:tr(lang,'تقديم بلاغ','Report an issue'),icon:ClipboardList,role:'reporter'},
 ];
 return <main className="auth-morph-page" dir={lang==='ar'?'rtl':'ltr'}>
  <DarkVeil className="auth-morph-dark-veil" color={dark?'#4ba7c7':'#2c85ae'} speed={0.64} scale={1.05} flow={1.3} warp={0.16} variation={0.28} brightness={dark?1.24:1.72} sheen={0.55} glow={0.84} grain={0.02} quality={0.55} mouseInteraction mouseStrength={0.52} intro fade={0.13} opacity={dark?0.92:0.86} lightMode={!dark} dpr={1.4}/>
  <header className="auth-morph-header">
    <Link href="/" className="auth-morph-brand" aria-label={tr(lang,'تدارك - الرئيسية','Tadaruk - Home')}><img src={`${import.meta.env.BASE_URL}brand-logo.png`} alt="تدارك TADARUK" /></Link>
    <div className="nav-actions auth-morph-header-actions">
      <button className="nav-lang" type="button" onClick={()=>setLang(lang==='ar'?'en':'ar')} aria-label={tr(lang,'التبديل إلى الإنجليزية','Switch to Arabic')}><Languages size={16}/><span>{lang==='ar'?'English':'العربية'}</span></button>
      <SunMoonThemeToggle className="landing-theme-toggle" theme={dark?'dark':'light'} onThemeChange={theme=>setDark(theme==='dark')} aria-label={dark?tr(lang,'تفعيل الوضع الفاتح','Switch to light mode'):tr(lang,'تفعيل الوضع الداكن','Switch to dark mode')} data-testid="theme-toggle-auth" size={40} duration={860}/>
      <Link href="/" className="auth-morph-home">{tr(lang,'الرئيسية','Home')} <ArrowLeft size={16}/></Link>
    </div>
  </header>
  <section className={`auth-morph-card ${signup?'auth-morph-signup':''}`} aria-label={tr(lang,'الدخول وإنشاء الحساب','Sign in and registration')}>
    <div className="auth-signup-back" aria-hidden={!signup}><button type="button" onClick={()=>toggle(false)} tabIndex={signup?0:-1}><span className="auth-signup-back-icon"><ArrowLeft size={19}/></span><span>{tr(lang,'تسجيل الدخول','Sign in')}</span></button></div>
    <div className="auth-morph-form-area">
     <div className="auth-morph-login" aria-hidden={signup}>
      <form className="auth-morph-login-form" onSubmit={onLogin}>
       <h1>{tr(lang,'تسجيل الدخول','Sign in')}</h1>
       <p className="auth-morph-subtitle">{tr(lang,'العودة إلى مساحة الصيانة','Welcome back to your workspace')}</p>
       <label className="auth-morph-input"><Mail size={19}/><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={tr(lang,'البريد الإلكتروني','Email address')} tabIndex={signup?-1:0}/></label>
       <label className="auth-morph-input"><LockKeyhole size={19}/><input type={showPassword?'text':'password'} minLength={4} required autoComplete="current-password" placeholder={tr(lang,'كلمة المرور','Password')} value={password} onChange={e=>setPassword(e.target.value)} tabIndex={signup?-1:0}/><button type="button" aria-label={tr(lang,'إظهار أو إخفاء كلمة المرور','Toggle password visibility')} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></label>
       <button type="submit" className="auth-morph-primary" tabIndex={signup?-1:0}>{tr(lang,'دخول','Sign in')}</button>
       <div className="auth-morph-demo">
         <small>{tr(lang,'اكتشف تجربة كل دور','Explore each role')}</small>
         <div className="auth-morph-roles">{roles.map(({name,role,note,icon:Icon})=><button type="button" key={role} tabIndex={signup?-1:0} className="auth-morph-role" onClick={()=>go('/demo')} title={note}><span><Icon size={23}/></span><b>{name}</b><small>{note}</small></button>)}</div>
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
         <img className="auth-morph-panel-mark" src={`${import.meta.env.BASE_URL}brand-mark-dark.png`} alt="" aria-hidden="true"/>
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
