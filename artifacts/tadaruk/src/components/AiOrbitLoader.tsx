import type { CSSProperties } from 'react';
import './ai-orbit-loader.css';

/** The supplied circular loader, embedded inline so reporting remains usable. */
export default function AiOrbitLoader({lang}:{lang:'ar'|'en'}) {
  const letters=(lang==='ar'?'تدارك':'TADARUK').split('');
  return (
    <div className="td-ai-orbit" role="status" aria-live="polite"
      aria-label={lang==='ar'?'جاري تحليل البلاغ بالذكاء الاصطناعي':'Analyzing report with AI'}>
      {letters.map((letter,index)=>(
        <span className="td-ai-orbit-letter" key={index} aria-hidden="true"
          style={{animationDelay:`${index*.1}s`} as CSSProperties}>{letter}</span>
      ))}
      <div className="td-ai-orbit-circle" aria-hidden="true"/>
    </div>
  );
}
