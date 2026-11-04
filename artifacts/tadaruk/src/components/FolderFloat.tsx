'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Matter from 'matter-js';
import { MessageSquare, CheckCheck, FileText } from 'lucide-react';
import './FolderFloat.css';

const { Bodies, Body, Composite, Engine } = Matter;

export type FolderItem = string | {
  label: string;
  value: string;
  time?: string;
  branch?: string;
};

const DEFAULT_ITEMS: FolderItem[] = [
  { label: 'مكيف الفرع يقطر موية فوق الطاولات', value: 'ac-leak', time: '10:42 ص', branch: 'فرع العليا' },
  { label: 'تسريب ماء تحت المغاسل الرئيسية', value: 'water-leak', time: '11:15 ص', branch: 'فرع النخيل' },
  { label: 'عطل في لوحة الكهرباء الرئيسية', value: 'power-fault', time: '01:30 م', branch: 'فرع التخصصي' },
  { label: 'قفل باب المستودع الخلفي معلق', value: 'door-lock', time: '02:05 م', branch: 'فرع الصحافة' },
  { label: 'ثلاجة المشروبات متوقفة عن التبريد', value: 'fridge-cooling', time: '03:20 م', branch: 'فرع الملقا' },
];

const PAD = 32;
const CHAR = 7.0;
const GAP = 12;
const ROW = 48;
const DRAG_MIN = 4;
const ZONE_PAD = 8;

const jitter = (i: number) => {
  const x = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return x - Math.floor(x);
};

type ItemSize = { w: number; h: number } | null;

const layout = (list: { label: string; value: string }[], spread: number, lift: number, tilt: number, sizes: ItemSize[]) => {
  const rows: { items: { i: number; pw: number }[]; width: number }[] = [];
  let row: { i: number; pw: number }[] = [];
  let width = 0;

  list.forEach((item, i) => {
    const pw = sizes[i]?.w ?? PAD + item.label.length * CHAR;
    if (row.length && width + GAP + pw > spread * 2) {
      rows.push({ items: row, width });
      row = [];
      width = 0;
    }
    row.push({ i, pw });
    width += (row.length > 1 ? GAP : 0) + pw;
  });
  if (row.length) rows.push({ items: row, width });

  const pos: { x: number; y: number; r: number }[] = [];
  rows.forEach((r, ri) => {
    let x = -r.width / 2;
    const shift = (ri % 2 ? 1 : -1) * Math.min(14, spread * 0.08);
    r.items.forEach(({ i, pw }) => {
      const j = jitter(i);
      pos[i] = {
        x: x + pw / 2 + shift + (j - 0.5) * 4,
        y: -lift - ri * ROW - j * 4,
        r: tilt * (j * 2 - 1)
      };
      x += pw + GAP;
    });
  });
  return pos;
};

export interface FolderFloatProps {
  items?: FolderItem[];
  label?: string;
  sublabel?: string;
  trigger?: 'hover' | 'click';
  defaultOpen?: boolean;
  closeOnSelect?: boolean;
  physics?: boolean;
  drift?: number;
  onSelect?: (value: string, index: number) => void;
  onOpenChange?: (open: boolean) => void;
  folderColor?: string;
  frontColor?: string;
  paperColor?: string;
  itemColor?: string;
  itemTextColor?: string;
  labelColor?: string;
  width?: number;
  height?: number;
  radius?: number;
  spread?: number;
  lift?: number;
  tilt?: number;
  flapAngle?: number;
  restAngle?: number;
  openDuration?: number;
  stagger?: number;
  bounce?: number;
  className?: string;
}

export default function FolderFloat({
  items = DEFAULT_ITEMS,
  label = 'ملف بلاغات تدارك',
  sublabel = '',
  trigger = 'hover',
  defaultOpen = true,
  closeOnSelect = false,
  physics = true,
  drift = 0.35,
  onSelect,
  onOpenChange,
  folderColor = '#162544',
  frontColor = '#1e3263',
  paperColor = '#ffffff',
  itemColor = '#ffffff',
  itemTextColor = '#1e3263',
  labelColor = '#ffffff',
  width = 230,
  height = 150,
  radius = 16,
  spread = 190,
  lift = 20,
  tilt = 4,
  flapAngle = 36,
  restAngle = 14,
  openDuration = 520,
  stagger = 45,
  bounce = 0.3,
  className = '',
}: FolderFloatProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [popped, setPopped] = useState(-1);
  const [live, setLive] = useState(false);
  const [sizes, setSizes] = useState<ItemSize[]>([]);
  const anchorRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const world = useRef<{
    engine: Matter.Engine | null;
    bodies: Matter.Body[];
    sizes: { w: number; h: number }[];
    raf: number;
    last: number;
    t0: number;
    drag: { i: number; id: number; dx: number; dy: number; sx: number; sy: number; moved: boolean } | null;
    zone: { left: number; right: number; top: number; bottom: number } | null;
    live: boolean;
  }>({
    engine: null,
    bodies: [],
    sizes: [],
    raf: 0,
    last: 0,
    t0: 0,
    drag: null,
    zone: null,
    live: false
  });

  const latest = useRef<{
    onSelect?: (value: string, index: number) => void;
    onOpenChange?: (open: boolean) => void;
    drift: number;
    reduce: boolean;
  }>({
    onSelect,
    onOpenChange,
    drift,
    reduce: false
  });
  latest.current = { onSelect, onOpenChange, drift, reduce: false };

  const popTimer = useRef<number | undefined>(undefined);
  const liveTimer = useRef<number | undefined>(undefined);

  const list = items.map(item =>
    typeof item === 'string'
      ? { label: item, value: item, time: '', branch: '' }
      : { label: item.label, value: item.value, time: item.time || '', branch: item.branch || '' }
  );

  const n = list.length;
  const sub = sublabel || `${n} ${n === 1 ? 'بلاغ مسجل وموثق' : 'بلاغات مسجلة وموثقة'}`;
  const pos = layout(list, spread, lift, tilt, sizes);

  const labelsKey = list.map(item => item.label).join('|');

  useLayoutEffect(() => {
    const measure = () => {
      const next = pillRefs.current.slice(0, n).map(el => (el ? { w: el.offsetWidth, h: el.offsetHeight } : null));
      if (next.some(s => !s)) return;
      setSizes(prev =>
        prev.length === next.length && prev.every((s, i) => s && next[i] && s.w === next[i]?.w && s.h === next[i]?.h) ? prev : next
      );
    };
    measure();
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(measure);
    }
  }, [n, labelsKey]);

  const stopPhysics = useCallback(() => {
    const w = world.current;
    clearTimeout(liveTimer.current);
    cancelAnimationFrame(w.raf);
    w.raf = 0;
    if (w.engine) {
      w.bodies.forEach((b, i) => {
        const el = pillRefs.current[i];
        if (!el) return;
        el.style.setProperty('--x', `${b.position.x.toFixed(1)}px`);
        el.style.setProperty('--y', `${(b.position.y - w.sizes[i].h / 2).toFixed(1)}px`);
      });
      Composite.clear(w.engine.world, false, true);
      Engine.clear(w.engine);
      w.engine = null;
    }
    w.bodies = [];
    w.drag = null;
    w.live = false;
    setLive(false);
  }, []);

  const startPhysics = useCallback(() => {
    const w = world.current;
    if (w.engine) return;
    const els = pillRefs.current.slice(0, n);
    if (els.some(el => !el)) return;
    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    engine.enableSleeping = false;
    w.engine = engine;
    w.sizes = els.map(el => ({ w: el?.offsetWidth ?? 170, h: el?.offsetHeight ?? 36 }));

    // Tightly bounded zone so items never overlap headings or float away
    const maxRowY = -lift - Math.ceil(n / 2) * ROW;
    const zone = {
      left: -spread - ZONE_PAD,
      right: spread + ZONE_PAD,
      top: maxRowY - 14,
      bottom: -lift + 20
    };
    w.zone = zone;

    w.bodies = els.map((_el, i) => {
      const { w: bw, h: bh } = w.sizes[i];
      const b = Bodies.rectangle(pos[i].x, pos[i].y + bh / 2, bw, bh, {
        chamfer: { radius: Math.min(bh / 2 - 1, 14) },
        restitution: 0.5,
        friction: 0,
        frictionAir: 0.09,
        inertia: Infinity
      });
      (b as unknown as { plugin: { phase: number } }).plugin = { phase: jitter(i) * Math.PI * 2 };
      return b;
    });

    const T = 80;
    const walls = [
      Bodies.rectangle((zone.left + zone.right) / 2, zone.top - T / 2, zone.right - zone.left + 2 * T, T, { isStatic: true }),
      Bodies.rectangle((zone.left + zone.right) / 2, zone.bottom + T / 2, zone.right - zone.left + 2 * T, T, { isStatic: true }),
      Bodies.rectangle(zone.left - T / 2, (zone.top + zone.bottom) / 2, T, zone.bottom - zone.top + 2 * T, { isStatic: true }),
      Bodies.rectangle(zone.right + T / 2, (zone.top + zone.bottom) / 2, T, zone.bottom - zone.top + 2 * T, { isStatic: true })
    ];

    Composite.add(engine.world, [...w.bodies, ...walls]);
    w.live = true;
    w.last = 0;
    w.t0 = performance.now();
    setLive(true);

    const tick = (now: number) => {
      const s = world.current;
      if (!s.engine) return;
      const dt = s.last ? Math.min(32, now - s.last) : 16;
      s.last = now;
      const t = (now - s.t0) / 1000;
      const k = latest.current.drift * 0.00004 * Math.min(1, t / 2);

      s.bodies.forEach((b, i) => {
        if (s.drag && s.drag.i === i) return;
        const ph = (b as unknown as { plugin: { phase: number } }).plugin.phase;
        Body.applyForce(b, b.position, {
          x: Math.sin(t * 0.85 + ph) * k * b.mass,
          y: Math.cos(t * 1.1 + ph * 1.5) * k * b.mass
        });
      });

      Engine.update(s.engine, dt);
      s.bodies.forEach((b, i) => {
        const el = pillRefs.current[i];
        if (!el) return;
        el.style.setProperty('--x', `${b.position.x.toFixed(1)}px`);
        el.style.setProperty('--y', `${(b.position.y - s.sizes[i].h / 2).toFixed(1)}px`);
      });

      s.raf = requestAnimationFrame(tick);
    };

    w.raf = requestAnimationFrame(tick);
  }, [n, spread, lift, pos]);

  const set = useCallback(
    (next: boolean) => {
      if (!next) stopPhysics();
      setOpen(prev => {
        if (prev === next) return prev;
        latest.current.onOpenChange?.(next);
        return next;
      });
    },
    [stopPhysics]
  );

  useEffect(() => {
    clearTimeout(liveTimer.current);
    if (!open || !physics || latest.current.reduce) {
      if (!open) stopPhysics();
      else if (!physics) stopPhysics();
      return undefined;
    }
    liveTimer.current = window.setTimeout(startPhysics, openDuration + (n - 1) * stagger + 80);
    return () => clearTimeout(liveTimer.current);
  }, [open, physics, openDuration, stagger, n, startPhysics, stopPhysics]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      latest.current.reduce = mq.matches;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(
    () => () => {
      clearTimeout(popTimer.current);
      stopPhysics();
    },
    [stopPhysics]
  );

  const pick = (item: { label: string; value: string }, i: number) => {
    latest.current.onSelect?.(item.value, i);
    clearTimeout(popTimer.current);
    setPopped(i);
    popTimer.current = window.setTimeout(() => setPopped(-1), 320);
    if (closeOnSelect) set(false);
  };

  const pointerAt = (e: React.PointerEvent) => {
    const r = anchorRef.current?.getBoundingClientRect();
    return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
  };

  const down = (e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    const w = world.current;
    if (!w.live || e.button !== 0) return;
    const b = w.bodies[i];
    if (!b) return;
    const p = pointerAt(e);
    w.drag = {
      i,
      id: e.pointerId,
      dx: b.position.x - p.x,
      dy: b.position.y - p.y,
      sx: e.clientX,
      sy: e.clientY,
      moved: false
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const move = (e: React.PointerEvent<HTMLButtonElement>, i: number) => {
    const w = world.current;
    const d = w.drag;
    if (!d || d.i !== i || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) >= DRAG_MIN) {
      d.moved = true;
      e.currentTarget.setAttribute('data-drag', '');
    }
    if (!d.moved) return;
    const b = w.bodies[i];
    const { w: bw, h: bh } = w.sizes[i];
    const z = w.zone;
    if (!z) return;
    const p = pointerAt(e);
    const x = Math.min(z.right - bw / 2, Math.max(z.left + bw / 2, p.x + d.dx));
    const y = Math.min(z.bottom - bh / 2, Math.max(z.top + bh / 2, p.y + d.dy));
    Body.setVelocity(b, { x: (x - b.position.x) * 0.6, y: (y - b.position.y) * 0.6 });
    Body.setPosition(b, { x, y });
  };

  const up = (e: React.PointerEvent<HTMLButtonElement>, i: number, item: { label: string; value: string }) => {
    const w = world.current;
    const d = w.drag;
    if (!d || d.i !== i || d.id !== e.pointerId) return;
    w.drag = null;
    e.currentTarget.removeAttribute('data-drag');
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    if (!d.moved && e.type === 'pointerup') pick(item, i);
  };

  const hover = trigger === 'hover';

  return (
    <div className="folder-float-wrapper">
      <div
        className={`folder-float${className ? ` ${className}` : ''}`}
        data-open={open ? '' : undefined}
        data-live={live ? '' : undefined}
        data-physics={physics ? '' : undefined}
        data-trigger={trigger}
        onPointerEnter={hover ? () => set(true) : undefined}
        onPointerLeave={
          hover
            ? () => {
                if (!world.current.drag) set(false);
              }
            : undefined
        }
        onKeyDown={e => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            set(false);
          }
        }}
        style={
          {
            '--ff-w': `${width}px`,
            '--ff-h': `${height}px`,
            '--ff-r': `${radius}px`,
            '--ff-back': folderColor,
            '--ff-front': frontColor,
            '--ff-paper': paperColor,
            '--ff-item': itemColor,
            '--ff-item-ink': itemTextColor,
            '--ff-label': labelColor,
            '--ff-spread': `${spread}px`,
            '--ff-lift': `${lift}px`,
            '--ff-angle': `${flapAngle}deg`,
            '--ff-rest': `${restAngle}deg`,
            '--ff-open': `${openDuration}ms`,
            '--ff-close': `${Math.round(openDuration * 0.6)}ms`,
            '--ff-stagger': `${stagger}ms`,
            '--ff-n': n,
            '--ff-spring': `cubic-bezier(0.34, ${(1 + bounce * 1.9).toFixed(2)}, 0.64, 1)`
          } as CSSProperties
        }
      >
        <div ref={anchorRef} className="folder-float__items">
          {list.map((item, i) => {
            const p = pos[i] || { x: 0, y: 0, r: 0 };
            return (
              <button
                key={`${item.value}-${i}`}
                ref={el => {
                  pillRefs.current[i] = el;
                }}
                type="button"
                className="folder-float__item whatsapp-report-pill"
                tabIndex={open ? 0 : -1}
                aria-hidden={!open}
                data-pop={popped === i ? '' : undefined}
                style={
                  {
                    '--i': i,
                    '--x': `${p.x.toFixed(1)}px`,
                    '--y': `${p.y.toFixed(1)}px`,
                    '--r': `${p.r.toFixed(2)}deg`
                  } as CSSProperties
                }
                onPointerDown={e => down(e, i)}
                onPointerMove={e => move(e, i)}
                onPointerUp={e => up(e, i, item)}
                onPointerCancel={e => up(e, i, item)}
                onClick={e => {
                  if (!world.current.live || e.detail === 0) pick(item, i);
                }}
                title={item.branch ? `${item.branch}: ${item.label}` : item.label}
              >
                <span className="folder-float__drift whatsapp-bubble-inner">
                  <span className="whatsapp-bubble-icon" aria-hidden="true">
                    <MessageSquare size={13} strokeWidth={2.4} />
                  </span>
                  <span className="whatsapp-bubble-text">{item.label}</span>
                  {item.time && (
                    <span className="whatsapp-bubble-meta">
                      <span className="whatsapp-bubble-time">{item.time}</span>
                      <CheckCheck size={12} className="whatsapp-bubble-check" strokeWidth={2.2} />
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="folder-float__folder">
          <span className="folder-float__back" aria-hidden="true">
            <span className="folder-float__tab-mark">TADARUK</span>
          </span>
          <span className="folder-float__paper" aria-hidden="true">
            <span className="folder-paper-header">
              <FileText size={14} className="folder-paper-icon" />
              <span className="folder-paper-badge">سجل البلاغ #2401</span>
              <span className="folder-paper-status">معتمد</span>
            </span>
            <span className="folder-paper-line" />
            <span className="folder-paper-line folder-paper-line-short" />
          </span>
          <span className="folder-float__front" aria-hidden="true">
            <span className="folder-float__badge">
              <span className="folder-badge-dot" />
              <span>أرشيف البلاغات</span>
            </span>
            <span className="folder-float__label">{label}</span>
            <span className="folder-float__sub">{sub}</span>
          </span>
          <button
            type="button"
            className="folder-float__trigger"
            aria-expanded={open}
            aria-label={`${label}, ${sub}`}
            onClick={() => set(!open)}
          />
        </div>
      </div>
    </div>
  );
}
