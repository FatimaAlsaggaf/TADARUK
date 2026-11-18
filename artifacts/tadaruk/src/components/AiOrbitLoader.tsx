import type { CSSProperties } from 'react';
import './ai-orbit-loader.css';

/** Inline AI analysis indicator — preserves the report wizard and never overlays the whole screen. */
export default function AiOrbitLoader({lang}:{lang:'ar'|'en'}) {
  const letters=(lang==='ar'?'تدارك':'TADARUK').split('');
  return (
    <div className="td-ai-orbit" role="status" aria-live="polite"
      aria-label={lang==='ar'?'جاري تحليل البلاغ بالذكاء الاصطناعي':'Analyzing report with AI'}>
      <span className="td-ai-orbit-ring" aria-hidden="true"/>
      <span className="td-ai-orbit-halo" aria-hidden="true"/>
      <span className="td-ai-orbit-word" dir={lang==='ar'?'rtl':'ltr'} aria-hidden="true">
        {letters.map((letter,index)=><span key={index} style={{'--letter-index':index} as CSSProperties}>{letter}</span>)}
      </span>
    </div>
  );
}
