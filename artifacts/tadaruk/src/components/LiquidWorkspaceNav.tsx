import { useState, type ComponentType } from 'react';
import { Link } from 'wouter';
import { motion, useReducedMotion } from 'motion/react';
import './liquid-workspace-nav.css';

/**
 * Lightweight Waterline navigation.
 * Adapted to the supplied Nimbus Liquid Navbar design: translucent rounded
 * glass pill, elastic active-water drop, ripple and animated icons.
 * CSS + Motion are used instead of a permanent WebGL render loop on phones.
 */
export type WaterlineTab = {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
};
type WaterlineProps = {
  items: WaterlineTab[];
  activeHref?: string;
  dark: boolean;
  lang: 'ar' | 'en';
};
export default function LiquidWorkspaceNav({ items, activeHref, dark, lang }: WaterlineProps) {
  const reduceMotion = useReducedMotion();
  const [played, setPlayed] = useState<{ href: string; count: number }>({ href: '', count: 0 });
  return (
    <div className="td-liquid-dock">
      <nav
        className="td-liquid-nav"
        aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}
        data-tone={dark ? 'dark' : 'light'}
        data-count={items.length}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <span className="td-liquid-glass" aria-hidden="true"/>
        {items.map(({ href, label, icon: Icon }) => {
          const selected = activeHref === href;
          const animated = played.href === href;
          return (
            <Link
              href={href}
              key={href}
              className={`td-liquid-item ${selected ? 'is-selected' : ''}`}
              aria-current={selected ? 'page' : undefined}
              aria-label={label}
              title={label}
              data-testid={`mobile-nav-${href.replaceAll('/', '-').replace(/^-/, 'root')}`}
              onClick={() => setPlayed(prev => ({ href, count: prev.count + 1 }))}
            >
              {selected && (
                <motion.span
                  layoutId="tadaruk-waterline-drop"
                  className="td-liquid-active"
                  transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 280, damping: 24, mass: .85 }}
                  aria-hidden="true"
                >
                  <span className="td-liquid-shine"/>
                </motion.span>
              )}
              <span
                key={animated ? `${href}-${played.count}` : href}
                className={`td-liquid-icon ${animated && !reduceMotion ? 'is-playing' : ''}`}
                aria-hidden="true"
              ><Icon size={20} strokeWidth={selected ? 2.2 : 1.8}/></span>
              <span className="td-liquid-label">{label}</span>
              {animated && !reduceMotion && <span className="td-liquid-ripple" key={`rip-${played.count}`} aria-hidden="true"/>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
