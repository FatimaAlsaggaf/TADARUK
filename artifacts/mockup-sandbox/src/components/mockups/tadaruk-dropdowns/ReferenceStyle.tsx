import { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  Copy,
  FilePenLine,
  Link2,
  Moon,
  MoreHorizontal,
  Share2,
  Sun,
  Trash2,
} from 'lucide-react';
import './_group.css';

const menuActions = [
  { id: 'edit', icon: FilePenLine, ar: 'تعديل البلاغ', en: 'Edit report' },
  { id: 'share', icon: Share2, ar: 'مشاركة التقرير', en: 'Share report' },
  { id: 'copy', icon: Copy, ar: 'نسخ رقم البلاغ', en: 'Copy report number' },
  { id: 'link', icon: Link2, ar: 'نسخ رابط البلاغ', en: 'Copy report link' },
  { id: 'archive', icon: Archive, ar: 'نقل إلى الأرشيف', en: 'Move to archive' },
  { id: 'delete', icon: Trash2, ar: 'حذف البلاغ', en: 'Delete report', destructive: true },
];

export function ReferenceStyle() {
  const [open, setOpen] = useState(true);
  const [dark, setDark] = useState(false);
  const [rtl, setRtl] = useState(true);
  const [selected, setSelected] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const english = !rtl;

  return (
    <main className={`td-menu-stage ${dark ? 'td-menu-dark' : 'td-menu-light'}`} dir={rtl ? 'rtl' : 'ltr'}>
      <style>{`
        .td-menu-stage {
          --td-ink: #1d3654;
          --td-muted: #8091a4;
          --td-line: #e6ebef;
          --td-surface: #fff;
          --td-canvas: #f5f8fa;
          --td-hover: #f1f8f9;
          --td-cyan: #37b9c3;
          --td-danger: #c75e62;
          min-height: 100dvh;
          display: grid;
          place-items: center;
          padding: 28px 20px;
          color: var(--td-ink);
          background:
            radial-gradient(ellipse at 50% 18%, rgba(55,185,195,.075), transparent 46%),
            var(--td-canvas);
          font-family: 'Noto Sans Arabic', sans-serif;
          transition: background-color .2s ease, color .2s ease;
        }
        .td-menu-dark {
          --td-ink: #e4edf2;
          --td-muted: #9eafbd;
          --td-line: #33485b;
          --td-surface: #1d3042;
          --td-canvas: #142536;
          --td-hover: #294151;
          --td-cyan: #63cbd0;
          --td-danger: #f18b8d;
        }
        .td-menu-demo { width: min(100%, 340px); }
        .td-menu-tools {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 15px;
        }
        .td-menu-brand {
          color: var(--td-muted);
          font-family: 'Anek Latin', 'Noto Sans Arabic', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .14em;
        }
        .td-menu-toolset { display: flex; align-items: center; gap: 7px; }
        .td-menu-tool {
          display: inline-flex;
          height: 29px;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0 9px;
          border: 1px solid var(--td-line);
          border-radius: 8px;
          color: var(--td-muted);
          background: var(--td-surface);
          font: 600 10px 'Anek Latin', 'Noto Sans Arabic', sans-serif;
          cursor: pointer;
          transition: color .16s ease, border-color .16s ease, background-color .16s ease;
        }
        .td-menu-tool:hover { color: var(--td-ink); border-color: #b8d9dd; }
        .td-menu-tool:focus-visible, .td-menu-trigger:focus-visible, .td-menu-item:focus-visible {
          outline: 2px solid var(--td-cyan);
          outline-offset: 2px;
        }
        .td-menu-tool svg { width: 13px; height: 13px; }
        .td-menu-record {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px 16px;
          border: 1px solid var(--td-line);
          border-radius: 12px;
          background: var(--td-surface);
        }
        .td-menu-record-copy { min-width: 0; }
        .td-menu-record-label {
          display: block;
          margin-bottom: 4px;
          color: var(--td-muted);
          font-size: 10px;
          font-weight: 500;
        }
        .td-menu-record-title { margin: 0; font-size: 14px; font-weight: 600; }
        .td-menu-record-meta {
          display: block;
          margin-top: 4px;
          color: var(--td-muted);
          font-family: 'Anek Latin', sans-serif;
          font-size: 10px;
          letter-spacing: .02em;
        }
        .td-menu-anchor { position: relative; flex: 0 0 auto; margin-inline-start: 14px; }
        .td-menu-trigger {
          display: flex;
          height: 36px;
          align-items: center;
          gap: 8px;
          padding: 0 11px;
          border: 1px solid #dce7ea;
          border-radius: 9px;
          color: #25445f;
          background: #fff;
          box-shadow: 0 1px 2px rgba(26,56,79,.035);
          font: 600 11px 'Noto Sans Arabic', sans-serif;
          cursor: pointer;
          transition: border-color .16s ease, background-color .16s ease, box-shadow .16s ease;
        }
        .td-menu-dark .td-menu-trigger {
          color: #e4edf2;
          border-color: #3a5164;
          background: #22384b;
        }
        .td-menu-trigger:hover, .td-menu-trigger[aria-expanded="true"] {
          border-color: #a8d9dc;
          box-shadow: 0 2px 7px rgba(37,119,129,.08);
        }
        .td-menu-trigger svg { width: 14px; height: 14px; }
        .td-menu-trigger .td-menu-trigger-icon { color: #3c9ca5; }
        .td-menu-trigger .td-menu-chevron { color: #8294a2; transition: transform .18s ease; }
        .td-menu-trigger[aria-expanded="true"] .td-menu-chevron { transform: rotate(180deg); }
        .td-menu-popover {
          position: absolute;
          z-index: 3;
          inset-block-start: calc(100% + 8px);
          inset-inline-end: 0;
          width: 226px;
          padding: 6px;
          border: 1px solid rgba(41,67,88,.09);
          border-radius: 12px;
          color: var(--td-ink);
          background: var(--td-surface);
          box-shadow: 0 9px 26px rgba(28,52,72,.10), 0 2px 5px rgba(28,52,72,.045);
          transform-origin: top right;
          animation: td-menu-in .16s cubic-bezier(.2,.7,.25,1) both;
        }
        [dir="ltr"] .td-menu-popover { transform-origin: top left; }
        .td-menu-popover[hidden] { display: none; }
        .td-menu-heading {
          padding: 7px 9px 8px;
          color: var(--td-muted);
          font-size: 10px;
          font-weight: 600;
        }
        .td-menu-items { display: grid; gap: 2px; }
        .td-menu-item {
          display: flex;
          width: 100%;
          min-height: 37px;
          align-items: center;
          gap: 10px;
          padding: 0 9px;
          border: 0;
          border-radius: 7px;
          color: var(--td-ink);
          background: transparent;
          text-align: start;
          font: 500 11px 'Noto Sans Arabic', sans-serif;
          cursor: pointer;
          transition: background-color .14s ease, color .14s ease;
        }
        .td-menu-item:hover, .td-menu-item:focus-visible { background: var(--td-hover); }
        .td-menu-item svg { width: 15px; height: 15px; flex: 0 0 auto; color: #8296a7; stroke-width: 1.7; }
        .td-menu-dark .td-menu-item svg { color: #a8bbc7; }
        .td-menu-item-destructive { color: var(--td-danger); }
        .td-menu-item-destructive svg { color: var(--td-danger); }
        .td-menu-separator { height: 1px; margin: 5px 4px; background: var(--td-line); }
        .td-menu-feedback {
          min-height: 22px;
          margin: 10px 2px 0;
          color: var(--td-muted);
          font-size: 10px;
          text-align: center;
        }
        .td-menu-feedback strong { color: #359ca4; font-weight: 600; }
        @keyframes td-menu-in {
          from { opacity: 0; transform: translateY(-4px) scale(.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .td-menu-stage *, .td-menu-stage *::before, .td-menu-stage *::after {
            animation-duration: .01ms !important;
            transition-duration: .01ms !important;
            scroll-behavior: auto !important;
          }
        }
        @media (max-width: 380px) {
          .td-menu-demo { width: 100%; }
          .td-menu-record { padding: 13px 12px; }
          .td-menu-anchor { margin-inline-start: 8px; }
          .td-menu-trigger { gap: 6px; padding-inline: 8px; }
        }
      `}</style>
      <section className="td-menu-demo" ref={rootRef} aria-label={english ? 'Dropdown menu sample' : 'نموذج القائمة المنسدلة'}>
        <div className="td-menu-tools">
          <span className="td-menu-brand">TADARUK / MENU</span>
          <div className="td-menu-toolset">
            <button className="td-menu-tool" type="button" onClick={() => setRtl((value) => !value)} aria-label={rtl ? 'Switch to left-to-right layout' : 'التبديل إلى اتجاه من اليمين إلى اليسار'}>
              {rtl ? 'RTL' : 'LTR'}
            </button>
            <button className="td-menu-tool" type="button" onClick={() => setDark((value) => !value)} aria-label={dark ? 'Switch to light theme' : 'التبديل إلى المظهر الداكن'}>
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              <span>{dark ? (english ? 'Light' : 'فاتح') : (english ? 'Dark' : 'داكن')}</span>
            </button>
          </div>
        </div>
        <div className="td-menu-record">
          <div className="td-menu-record-copy">
            <span className="td-menu-record-label">{english ? 'Maintenance report' : 'بلاغ صيانة'}</span>
            <h2 className="td-menu-record-title">{english ? 'Water leak — level 2' : 'تسرّب مياه — الطابق ٢'}</h2>
            <span className="td-menu-record-meta">TR-2048 · {english ? 'Today, 10:42' : 'اليوم، ١٠:٤٢'}</span>
          </div>
          <div className="td-menu-anchor">
            <button
              className="td-menu-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls="tadaruk-report-menu"
              onClick={() => setOpen((value) => !value)}
            >
              <MoreHorizontal className="td-menu-trigger-icon" aria-hidden="true" />
              <span>{english ? 'Actions' : 'الإجراءات'}</span>
              <ChevronDown className="td-menu-chevron" aria-hidden="true" />
            </button>
            <div
              className="td-menu-popover"
              id="tadaruk-report-menu"
              role="menu"
              aria-label={english ? 'Report actions' : 'إجراءات البلاغ'}
              hidden={!open}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setOpen(false);
                  (event.currentTarget.parentElement?.querySelector('button') as HTMLButtonElement | null)?.focus();
                }
              }}
            >
              <div className="td-menu-heading">{english ? 'Report actions' : 'إجراءات البلاغ'}</div>
              <div className="td-menu-items">
                {menuActions.map(({ id, icon: Icon, ar, en, destructive }) => (
                  <div key={id}>
                    {id === 'delete' && <div className="td-menu-separator" role="separator" />}
                    <button
                      className={`td-menu-item ${destructive ? 'td-menu-item-destructive' : ''}`}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSelected(english ? en : ar);
                        setOpen(false);
                      }}
                    >
                      <Icon aria-hidden="true" />
                      <span>{english ? en : ar}</span>
                      {selected === (english ? en : ar) && <Check aria-label={english ? 'Selected' : 'تم الاختيار'} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="td-menu-feedback" aria-live="polite">
          {selected ? <><strong>{english ? 'Selected:' : 'تم الاختيار:'}</strong> {selected}</> : (english ? 'Choose an action to see it selected' : 'اختر إجراءً لعرضه هنا')}
        </p>
      </section>
    </main>
  );
}
