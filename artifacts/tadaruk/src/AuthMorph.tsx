import {useEffect,useState,type FormEvent} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useListDemoUsers,useSelectDemoAccount,getGetDemoSessionQueryKey,type DemoUser} from '@workspace/api-client-react';
import {Link,useLocation} from 'wouter';
import {Building2,ClipboardList,Eye,EyeOff,LockKeyhole,Mail,Wrench,ArrowLeft,ArrowRight,Languages,CheckCircle2} from 'lucide-react';
import SunMoonThemeToggle from './components/ui/sun-moon-theme-toggle';
import DarkVeil from './AuthDarkVeil';
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
 const [recoveryEmail,setRecoveryEmail]=useState('');
 const [newPassword,setNewPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [recoveryDone,setRecoveryDone]=useState(false);
 const [recoveryError,setRecoveryError]=useState('');
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
 const onRecovery=(event:FormEvent<HTMLFormElement>)=>{
   event.preventDefault();
   if(newPassword!==confirmPassword){
     setRecoveryError(tr(lang,'كلمتا المرور غير متطابقتين.','Passwords do not match.'));
     return;
   }
   // Presentation-only form: intentionally does not change server credentials.
   setRecoveryError('');
   setRecoveryDone(true);
 };
 const resetRecovery=()=>{
   setShowRecovery(false);setRecoveryDone(false);setRecoveryError('');
   setNewPassword('');setConfirmPassword('');
 };
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
  <div className="auth-veiled-background" aria-hidden="true">
    <DarkVeil lightMode={!dark} color={dark?'#4ba7c7':'#245c82'}
      speed={0.5} scale={1} flow={1} warp={0} sheen={0.58} glow={0.52}
      brightness={dark?1.2:1.5} grain={0.02} quality={0.5} mouseInteraction mouseStrength={0.65}
      fade={0.12} opacity={dark?0.9:0.92} className="auth-morph-dark-veil"/>
  </div>
  <header className="auth-morph-header">
    <div className="nav-actions auth-morph-header-actions">
      <SunMoonThemeToggle className="landing-theme-toggle" theme={dark?'dark':'light'} onThemeChange={theme=>setDark(theme==='dark')} aria-label={dark?tr(lang,'تفعيل الوضع الفاتح','Switch to light mode'):tr(lang,'تفعيل الوضع الداكن','Switch to dark mode')} data-testid="theme-toggle-auth" size={40} duration={860}/>
      <button className="nav-lang" type="button" onClick={()=>setLang(lang==='ar'?'en':'ar')} aria-label={tr(lang,'التبديل إلى الإنجليزية','Switch to Arabic')}><Languages size={16}/><span>{lang==='ar'?'English':'العربية'}</span></button>
      {!signup&&<Link href="/" className="auth-morph-home">{lang==='ar'?<ArrowRight size={17}/>:<ArrowLeft size={17}/>} {tr(lang,'رجوع','Back')}</Link>}
    </div>
    <div className="auth-morph-brand" aria-label={tr(lang,'شعار تدارك','Tadaruk logo')}><img src={`${import.meta.env.BASE_URL}${dark?'brand-logo-dark.png':'brand-logo.png'}`} alt="تدارك TADARUK" /></div>
  </header>
  <section className={`auth-morph-card ${signup?'auth-morph-signup':''}`} aria-label={tr(lang,'الدخول وإنشاء الحساب','Sign in and registration')}>
    <div className="auth-morph-form-area">
     <div className="auth-morph-login" aria-hidden={signup}>
      <form className="auth-morph-login-form" onSubmit={showRecovery?onRecovery:onLogin}>
       {showRecovery?<>
         <h1>{recoveryDone?tr(lang,'تم تغيير كلمة المرور','Password updated'):tr(lang,'استعادة كلمة المرور','Reset password')}</h1>
         {recoveryDone?<>
           <div className="auth-morph-recovery-success" role="status"><CheckCircle2 size={27}/><span>{tr(lang,'تم تحديث كلمة المرور بنجاح.','Your password has been updated.')}</span></div>
           <button type="button" className="auth-morph-primary" onClick={resetRecovery}>{tr(lang,'العودة لتسجيل الدخول','Back to sign in')}</button>
         </>:<>
           <label className="auth-morph-input"><Mail size={19}/><input type="email" required autoComplete="email" value={recoveryEmail} onChange={e=>setRecoveryEmail(e.target.value)} placeholder={tr(lang,'البريد الإلكتروني','Email address')}/></label>
           <label className="auth-morph-input"><LockKeyhole size={19}/><input type="password" minLength={8} required autoComplete="new-password" value={newPassword} onChange={e=>{setNewPassword(e.target.value);setRecoveryError('')}} placeholder={tr(lang,'كلمة المرور الجديدة','New password')}/></label>
           <label className="auth-morph-input"><LockKeyhole size={19}/><input type="password" minLength={8} required autoComplete="new-password" value={confirmPassword} onChange={e=>{setConfirmPassword(e.target.value);setRecoveryError('')}} placeholder={tr(lang,'تأكيد كلمة المرور','Confirm new password')}/></label>
           {recoveryError&&<p className="auth-morph-login-notice" role="alert">{recoveryError}</p>}
           <button type="submit" className="auth-morph-primary">{tr(lang,'تغيير كلمة المرور','Change password')}</button>
           <button type="button" className="auth-morph-forgot" onClick={resetRecovery}>{tr(lang,'رجوع لتسجيل الدخول','Back to sign in')}</button>
         </>}
       </>:<>
         <h1>{tr(lang,'تسجيل الدخول','Sign in')}</h1>
         <label className="auth-morph-input"><Mail size={19}/><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder={tr(lang,'البريد الإلكتروني','Email address')} tabIndex={signup?-1:0}/></label>
         <label className="auth-morph-input"><LockKeyhole size={19}/><input type={showPassword?'text':'password'} minLength={4} required autoComplete="current-password" placeholder={tr(lang,'كلمة المرور','Password')} value={password} onChange={e=>setPassword(e.target.value)} tabIndex={signup?-1:0}/><button type="button" aria-label={tr(lang,'إظهار أو إخفاء كلمة المرور','Toggle password visibility')} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></label>
         <button type="submit" className="auth-morph-primary" tabIndex={signup?-1:0}>{tr(lang,'دخول','Sign in')}</button>
         <button type="button" className="auth-morph-forgot" onClick={()=>{setRecoveryEmail(email);setShowRecovery(true);setLoginNotice('')}} tabIndex={signup?-1:0}>{tr(lang,'نسيت كلمة المرور؟','Forgot your password?')}</button>
         {loginNotice&&<p className="auth-morph-login-notice" role="status">{loginNotice}</p>}
         <div className="auth-morph-demo">
           <small>{tr(lang,'الدخول بحساب تجريبي','Try a demo account')}</small>
           <div className="auth-morph-roles">{roles.map(({name,role,note,icon:Icon})=><button type="button" key={role} tabIndex={signup?-1:0} className="auth-morph-role" onClick={()=>enterDemo(role)} disabled={selectDemo.isPending} title={note}><span><Icon size={23}/></span><b>{name}</b><small>{note}</small></button>)}</div>
         </div>
       </>}
      </form>
     </div>
     <div className="auth-morph-register" aria-hidden={!signup}>
       <div className="auth-morph-register-content">
         <OrganizationOnboarding lang={lang} mode="signup" embedded onExit={()=>toggle(false)}/>
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
