import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowLeft, Bell, Camera, CheckCheck, ChevronLeft, FolderOpen, Image as ImageIcon, Maximize2, Mic, Pause, Play, RotateCcw, Settings2, Volume2, VolumeX, X } from 'lucide-react';
import FolderFloat from '@/components/FolderFloat';
import './PitchHook.css';

type Stage = 'ready' | 'lock' | 'chat' | 'question' | 'transfer' | 'final';
type AssetKey = 'sink' | 'camera' | 'door' | 'light' | 'voice' | 'notification' | 'sent' | 'open';
type ChatMessage = { who: string; text?: string; time: string; photo?: AssetKey; voice?: boolean; mine?: boolean };
type Flight = { text: string; dx: number; dy: number; x: number; y: number; delay: number };
const VOICE_TEXT = 'السلام عليكم، المغسلة اللي في دورات المياه انكسرت، والمويه تتجمع حولها. أرسلت صورتها بالقروب من بدري، ونحتاج فني يشوفها بأسرع وقت.';
const PHOTO_LABELS: { key: AssetKey; label: string }[] = [
  { key: 'sink', label: 'صورة المغسلة المكسورة' },
  { key: 'camera', label: 'صورة الكاميرا المتعطلة' },
  { key: 'door', label: 'صورة باب دورة المياه' },
  { key: 'light', label: 'صورة اللمبة المعطلة' }
];
const SOUND_LABELS: { key: AssetKey; label: string }[] = [
  { key: 'notification', label: 'صوت استقبال الرسائل' },
  { key: 'sent', label: 'صوت إرسال الرسالة' },
  { key: 'open', label: 'صوت فتح القروب' },
  { key: 'voice', label: 'تسجيل الفويس الحقيقي' }
];
const MESSAGES: ChatMessage[] = [
  { who: 'أحمد', text: 'صباح الخير، اللمبة عند الممر طافية من أمس.', time: '٩:٠١', photo: 'light' },
  { who: 'سارة', text: 'المغسلة في دورات المياه انكسرت، شوفوا الصورة.', time: '٩:٠٣', photo: 'sink' },
  { who: 'نورة', text: 'والكاميرا اللي عند المدخل ما تشتغل.', time: '٩:٠٥', photo: 'camera' },
  { who: 'خالد', text: 'باب دورة المياه تقفل وما قدرنا نفتحه!', time: '٩:٠٧', photo: 'door' },
  { who: 'المشرف', text: 'مين الفني الموجود اليوم؟', time: '٩:٠٩', mine: true },
  { who: 'أحمد', text: 'يا جماعة فيه أحد شاف البلاغات؟', time: '٩:١٠' },
  { who: 'فهد', time: '٩:١١', voice: true },
  { who: 'المشرف', text: 'مين استلم بلاغ المغسلة؟', time: '٩:١٣', mine: true },
  { who: 'سارة', text: 'أنا أرسلت الصورة من بدري!', time: '٩:١٤' },
  { who: 'خالد', text: 'والباب للحين مقفل، وش نسوي؟', time: '٩:١٥' },
  { who: 'نورة', text: 'والكاميرا محد رد علينا بخصوصها.', time: '٩:١٦' },
  { who: 'المشرف', text: 'طيب مين الفني المسؤول عن كل بلاغ؟', time: '٩:١٧', mine: true },
  { who: 'سارة', text: 'المغسلة للحين مكسورة والمويه تزيد!', time: '٩:١٨' }
];
const FOLDER_ITEMS = [
  { label: 'المغسلة مكسورة', value: 'sink', time: '٩:٠٣', branch: 'دورات المياه' },
  { label: 'كاميرا المدخل متعطلة', value: 'camera', time: '٩:٠٥', branch: 'المدخل' },
  { label: 'باب دورة المياه مقفل', value: 'door', time: '٩:٠٧', branch: 'دورات المياه' },
  { label: 'لمبة الممر معطلة', value: 'light', time: '٩:٠١', branch: 'الممر' }
];

function openAssetDatabase(): Promise<IDBDatabase | null> {
  if (!('indexedDB' in window)) return Promise.resolve(null);
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('tadaruk-pitch-assets-v1', 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('files')) req.result.createObjectStore('files'); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
async function storeAsset(key: string, blob: Blob) {
  const db = await openAssetDatabase();
  if (!db) return;
  await new Promise<void>(resolve => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}
async function readAssets(): Promise<Partial<Record<AssetKey, string>>> {
  const db = await openAssetDatabase();
  if (!db) return {};
  const keys: AssetKey[] = ['sink', 'camera', 'door', 'light', 'voice', 'notification', 'sent', 'open'];
  const out: Partial<Record<AssetKey, string>> = {};
  await Promise.all(keys.map(key => new Promise<void>(resolve => {
    const tx = db.transaction('files', 'readonly');
    const req = tx.objectStore('files').get(key);
    req.onsuccess = () => { if (req.result instanceof Blob) out[key] = URL.createObjectURL(req.result); resolve(); };
    req.onerror = () => resolve();
  })));
  db.close();
  return out;
}
function waveform() {
  return Array.from({ length: 30 }, (_, i) => <span key={i} style={{ height: String(5 + (i * 13 + i * i * 3) % 19) + 'px' }} />);
}

export default function PitchHook() {
  const [stage, setStage] = useState<Stage>('ready');
  const [noticeCount, setNoticeCount] = useState(0);
  const [shown, setShown] = useState(0);
  const [voiceState, setVoiceState] = useState<'idle' | 'playing' | 'done'>('idle');
  const [muted, setMuted] = useState(false);
  const [settings, setSettings] = useState(false);
  const [assets, setAssets] = useState<Partial<Record<AssetKey, string>>>({});
  const [flights, setFlights] = useState<Flight[]>([]);
  const [imagePreview, setImagePreview] = useState<AssetKey | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const voiceAudio = useRef<HTMLAudioElement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);
  const folderRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const assetsRef = useRef(assets);
  const mutedRef = useRef(muted);
  const timers = useRef<number[]>([]);
  const latestStage = useRef(stage);
  assetsRef.current = assets;
  mutedRef.current = muted;
  latestStage.current = stage;

  useEffect(() => {
    let alive = true;
    readAssets().then(loaded => { if (alive) setAssets(loaded); else Object.values(loaded).forEach(url => URL.revokeObjectURL(url)); });
    return () => { alive = false; };
  }, []);
  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [shown, stage]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(id => window.clearTimeout(id));
    timers.current = [];
  }, []);
  const schedule = useCallback((callback: () => void, ms: number) => {
    const id = window.setTimeout(callback, ms);
    timers.current.push(id);
    return id;
  }, []);
  const sound = useCallback((kind: 'notification' | 'sent' | 'open' | 'transition') => {
    if (mutedRef.current) return;
    if (kind !== 'transition' && assetsRef.current[kind]) {
      const audio = new Audio(assetsRef.current[kind]);
      audio.volume = kind === 'notification' ? .56 : .66;
      void audio.play().catch(() => {});
      return;
    }
    try {
      const ctx = audioContext.current ?? new AudioContext();
      audioContext.current = ctx;
      if (ctx.state === 'suspended') void ctx.resume();
      const now = ctx.currentTime;
      const notes = kind === 'notification' ? [880, 1175] : kind === 'sent' ? [1220, 1550] : kind === 'open' ? [540, 780] : [520, 720, 980];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === 'notification' ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * .075);
        gain.gain.setValueAtTime(.0001, now + i * .075);
        gain.gain.exponentialRampToValueAtTime(kind === 'notification' ? .105 : .06, now + i * .075 + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, now + i * .075 + .20);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + i * .075); osc.stop(now + i * .075 + .21);
      });
      if (kind === 'notification') navigator.vibrate?.(30);
    } catch { /* Browsers may block sound until a user gesture. */ }
  }, []);

  const stopVoice = useCallback(() => {
    if (voiceAudio.current) { voiceAudio.current.pause(); voiceAudio.current = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);
  const reset = useCallback(() => {
    clearTimers(); stopVoice();
    setStage('ready'); setNoticeCount(0); setShown(0);
    setVoiceState('idle'); setFlights([]); setImagePreview(null);
  }, [clearTimers, stopVoice]);

  const start = () => {
    reset();
    try {
      audioContext.current = audioContext.current ?? new AudioContext();
      void audioContext.current.resume();
    } catch { /* Audio is optional. */ }
    setStage('lock');
  };
  useEffect(() => {
    if (stage !== 'lock') return;
    if (noticeCount >= 6) return;
    return () => {};
  }, [stage, noticeCount]);
  useEffect(() => {
    if (stage !== 'lock' || noticeCount >= 6) return;
    const id = window.setTimeout(() => { setNoticeCount(n => n + 1); sound('notification'); }, noticeCount === 0 ? 650 : 560);
    return () => window.clearTimeout(id);
  }, [stage, noticeCount, sound]);
  const openChat = () => {
    clearTimers(); sound('open');
    setShown(0); setVoiceState('idle'); setStage('chat');
  };
  useEffect(() => {
    if (stage !== 'chat') return;
    const shouldAdvance = shown < 7 || (voiceState === 'done' && shown < MESSAGES.length);
    if (!shouldAdvance) return;
    const id = window.setTimeout(() => {
      const m = MESSAGES[shown];
      sound(m?.mine ? 'sent' : 'notification');
      setShown(n => Math.min(MESSAGES.length, n + 1));
    }, shown === 0 ? 420 : shown < 7 ? 920 : 1080);
    return () => window.clearTimeout(id);
  }, [stage, shown, voiceState, sound]);
  useEffect(() => {
    if (stage !== 'chat' || shown !== MESSAGES.length) return;
    const id = window.setTimeout(() => setStage('question'), 1800);
    return () => window.clearTimeout(id);
  }, [stage, shown]);

  const finishVoice = useCallback(() => {
    if (latestStage.current !== 'chat') return;
    setVoiceState('done');
  }, []);
  const playVoice = () => {
    if (voiceState === 'playing') {
      stopVoice(); setVoiceState('idle'); return;
    }
    if (voiceState === 'done') return;
    setVoiceState('playing');
    const file = assetsRef.current.voice;
    if (file) {
      const audio = new Audio(file);
      voiceAudio.current = audio;
      audio.onended = finishVoice;
      audio.onerror = finishVoice;
      void audio.play().catch(finishVoice);
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(VOICE_TEXT);
      utterance.lang = 'ar-SA'; utterance.rate = .95; utterance.pitch = .86;
      const arVoice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('ar'));
      if (arVoice) utterance.voice = arVoice;
      utterance.onend = finishVoice; utterance.onerror = finishVoice;
      window.speechSynthesis.speak(utterance);
    } else {
      finishVoice();
    }
  };
  const transfer = () => {
    clearTimers(); stopVoice(); sound('transition');
    const p = phoneRef.current?.getBoundingClientRect();
    const f = folderRef.current?.getBoundingClientRect();
    if (p && f) {
      const startX = p.left + p.width * .48, startY = p.top + p.height * .48;
      const endX = f.left + f.width * .5, endY = f.top + f.height * .56;
      setFlights(FOLDER_ITEMS.map((item, i) => ({
        text: item.label,
        x: startX - 105 + (i % 2) * 30,
        y: startY - 75 + i * 37,
        dx: endX - startX + 105 - (i % 2) * 30,
        dy: endY - startY + 75 - i * 37,
        delay: i * 290
      })));
    }
    setStage('transfer');
    schedule(() => { setStage('final'); setFlights([]); }, 2600);
  };
  const setFile = async (key: AssetKey, file?: File) => {
    if (!file) return;
    if ((key === 'sink' || key === 'camera' || key === 'door' || key === 'light') && !file.type.startsWith('image/')) return;
    if ((key === 'voice' || key === 'notification' || key === 'sent' || key === 'open') && !file.type.startsWith('audio/')) return;
    if (file.size > 12 * 1024 * 1024) { window.alert('اختاري ملفًا أصغر من 12 ميجابايت.'); return; }
    const url = URL.createObjectURL(file);
    setAssets(prev => ({ ...prev, [key]: url }));
    await storeAsset(key, file);
  };
  const fullscreen = () => {
    if (!document.fullscreenElement) void stageRef.current?.requestFullscreen?.();
    else void document.exitFullscreen?.();
  };

  return <main className={'pitch-hook-root pitch-stage-' + stage} ref={stageRef} dir="rtl">
    <div className="pitch-bg-orb pitch-bg-orb-one" aria-hidden="true"/>
    <div className="pitch-bg-orb pitch-bg-orb-two" aria-hidden="true"/>
    <div className="pitch-grain" aria-hidden="true"/>
    <header className="pitch-toolbar">
      <div className="pitch-toolbar-title"><span className="pitch-mini-mark">ت</span><span>تدارك <small>تجربة تفاعلية · محاكاة توضيحية</small></span></div>
      <div className="pitch-toolbar-actions">
        <button type="button" title="إعداد الصور والأصوات" onClick={() => setSettings(v => !v)}><Settings2 size={17}/></button>
        <button type="button" title={muted ? 'تشغيل الصوت' : 'كتم الصوت'} onClick={() => setMuted(v => !v)}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
        <button type="button" title="ملء الشاشة" onClick={fullscreen}><Maximize2 size={17}/></button>
        <button type="button" title="إعادة العرض" onClick={reset}><RotateCcw size={17}/></button>
      </div>
    </header>
    <div className="pitch-main-stage">
      <div className="pitch-stage-hint">
        <span className="pitch-eyebrow">قصة بلاغ ضائع</span>
        <h1>{stage === 'final' ? 'كل بلاغ صار له مسار.' : stage === 'question' || stage === 'transfer' ? 'وسط كل هالرسائل…' : 'تخيّلوا تبدأون يومكم…'}</h1>
        <p>{stage === 'final' ? 'من لحظة الإبلاغ حتى إغلاق الطلب.' : stage === 'question' ? 'مين استلم البلاغ؟ وش صار عليه؟ وهل انحل أصلًا؟' : stage === 'lock' ? 'إشعارات ما توقف… اضغطي على قروب الصيانة.' : stage === 'chat' ? 'صور، فويسات، وبلاغات تختلط وسط المحادثة.' : 'قروب العمل فيه أكثر من 200 رسالة فائتة.'}</p>
      </div>
      <div className="pitch-scene">
        <div className="pitch-phone-anchor" ref={phoneRef}>
          <div className="pitch-device">
            <div className="pitch-device-side pitch-side-left"/><div className="pitch-device-side pitch-side-right"/>
            <div className="pitch-glass">
              <div className="pitch-island" aria-hidden="true"><span/></div>
              <div className="pitch-phone-status"><span>9:41</span><span className="pitch-status-symbols">●●● ▰</span></div>
              {(stage === 'ready' || stage === 'lock') && <div className="pitch-lock">
                <div className="pitch-lock-wallpaper"/>
                <div className="pitch-lock-content">
                  <div className="pitch-lock-date">الاثنين، ١٦ نوفمبر</div>
                  <div className="pitch-lock-time">9:41</div>
                  <div className="pitch-lock-notifications">
                    {stage === 'ready' ? <div className="pitch-lock-ready">قروب العمل · ٢٠٠+ رسالة فائتة</div> : <>
                      {noticeCount > 0 && <button className="pitch-lock-alert pitch-lock-alert-main" type="button" onClick={openChat}>
                        <span className="pitch-whats-icon">✆</span><span><strong>قروب الصيانة</strong><small>٢٠٠+ رسالة غير مقروءة</small></span><span className="pitch-unread">200+</span>
                      </button>}
                      {noticeCount > 1 && <div className="pitch-lock-alert pitch-lock-alert-second"><span className="pitch-whats-icon">✆</span><span><strong>سارة</strong><small>المغسلة انكسرت، شوفوا الصورة!</small></span></div>}
                      {noticeCount > 2 && <div className="pitch-lock-alert pitch-lock-alert-second"><span className="pitch-whats-icon">✆</span><span><strong>خالد</strong><small>باب دورة المياه ما يفتح!</small></span></div>}
                      {noticeCount > 3 && <div className="pitch-lock-alert pitch-lock-alert-second"><span className="pitch-whats-icon">✆</span><span><strong>نورة</strong><small>الكاميرا عند المدخل خربانة.</small></span></div>}
                    </>}
                  </div>
                </div>
                <div className="pitch-lock-bottom"><span>◉</span><span>⌁</span></div>
              </div>}
              {(stage === 'chat' || stage === 'question' || stage === 'transfer' || stage === 'final') && <div className="pitch-chat-screen">
                <div className="pitch-chat-header">
                  <button type="button" title="العودة للإشعارات" onClick={() => { stopVoice(); setStage('lock'); }}><ChevronLeft size={22}/></button>
                  <span className="pitch-chat-avatar">ص</span>
                  <span className="pitch-chat-title"><strong>قروب الصيانة</strong><small>المشرف، أحمد، سارة، خالد، نورة…</small></span>
                  <Camera size={18}/>
                </div>
                <div className="pitch-chat-list" ref={chatRef}>
                  <div className="pitch-chat-day">اليوم</div>
                  {MESSAGES.slice(0, shown).map((m, i) => <div className={'pitch-chat-bubble ' + (m.mine ? 'is-mine' : '')} key={i}>
                    <span className="pitch-chat-sender">{m.who}</span>
                    {m.text && <p>{m.text}</p>}
                    {m.photo && <button className="pitch-photo-message" type="button" onClick={() => setImagePreview(m.photo ?? null)} title="تكبير صورة العطل">
                      {assets[m.photo] ? <img src={assets[m.photo]} alt={m.text ?? 'صورة العطل'}/> : <span className="pitch-photo-fallback"><ImageIcon size={24}/><small>اضغطي ⚙ لإضافة الصورة الحقيقية</small></span>}
                      <span className="pitch-photo-expand"><Maximize2 size={14}/></span>
                    </button>}
                    {m.voice && <button type="button" className={'pitch-voice-button ' + (voiceState === 'playing' ? 'is-playing' : '')} onClick={playVoice} disabled={voiceState === 'done'} title="تشغيل الرسالة الصوتية">
                      <span className="pitch-voice-play">{voiceState === 'playing' ? <Pause size={17}/> : <Play size={17} fill="currentColor"/>}</span>
                      <span className="pitch-wave">{waveform()}</span>
                      <span className="pitch-voice-duration">{voiceState === 'done' ? 'تم التشغيل' : voiceState === 'playing' ? 'يعمل…' : '0:12'}</span>
                      <Mic size={17}/>
                    </button>}
                    <span className="pitch-chat-meta">{m.time} {m.mine && <CheckCheck size={13}/>}</span>
                  </div>)}
                  {shown === 7 && voiceState === 'idle' && <div className="pitch-voice-prompt">اضغطي على الفويس لسماع البلاغ <span>↑</span></div>}
                  {shown === 7 && voiceState === 'playing' && <div className="pitch-voice-prompt">جارٍ تشغيل الرسالة الصوتية…</div>}
                </div>
                <div className="pitch-chat-composer"><span>＋</span><span className="pitch-chat-placeholder">رسالة</span><Camera size={16}/><Mic size={17}/></div>
              </div>}
              <div className="pitch-home-indicator" aria-hidden="true"/>
            </div>
          </div>
          {stage === 'ready' && <button className="pitch-start-overlay" type="button" onClick={start}><span className="pitch-start-play"><Play fill="currentColor" size={22}/></span><strong>ابدئي المشهد بالصوت</strong><small>اضغطي لتفعيل المؤثرات وبدء الإشعارات</small></button>}
        </div>
        <div className="pitch-folder-area" ref={folderRef} aria-hidden={stage !== 'final' && stage !== 'transfer'}>
          <FolderFloat items={FOLDER_ITEMS} label="ملف بلاغات تدارك" sublabel="بلاغات منظمة" open={stage === 'final'} trigger="click" physics={false} width={220} height={144} spread={145} lift={18} stagger={170}/>
        </div>
        {(stage === 'question' || stage === 'transfer') && <div className="pitch-question-card">
          <span className="pitch-eyebrow">وسط ٢٠٠ رسالة…</span>
          <h2>مين استلم البلاغ؟</h2>
          <h2>وش صار عليه؟</h2>
          <h2>وهل انحل أصلًا؟</h2>
          {stage === 'question' && <button type="button" onClick={transfer}>شوفي كيف تدارك ينظمها <ArrowLeft size={17}/></button>}
        </div>}
        {stage === 'final' && <div className="pitch-final-brand">
          <img src="/brand-logo-dark.png" alt="شعار تدارك" onError={e => { e.currentTarget.style.display = 'none'; }}/>
          <strong>تدارك</strong>
          <p>من بلاغات مشتّتة إلى متابعة واضحة.</p>
          <a href="/" className="pitch-visit">استكشفي تدارك <ArrowLeft size={17}/></a>
        </div>}
      </div>
      <div className="pitch-footer-controls">
        {stage === 'lock' && <button type="button" onClick={openChat}>افتحي قروب الصيانة <ChevronLeft size={17}/></button>}
        {stage === 'chat' && shown >= 7 && voiceState !== 'done' && <button type="button" onClick={() => { stopVoice(); setVoiceState('done'); }}>تخطي الفويس والمتابعة <ArrowLeft size={16}/></button>}
        {stage === 'chat' && shown === MESSAGES.length && <button type="button" onClick={() => setStage('question')}>التالي <ArrowLeft size={16}/></button>}
        {stage === 'final' && <button type="button" onClick={reset}>إعادة التجربة <RotateCcw size={16}/></button>}
        <span>{stage === 'ready' ? 'جاهزة للعرض' : stage === 'final' ? 'نهاية المشهد' : 'محاكاة تفاعلية · الصوت يعمل بعد الضغط على البدء'}</span>
      </div>
    </div>
    {flights.map((f, i) => <div key={i} className="pitch-flying-card" style={{ left: f.x, top: f.y, '--flight-x': String(f.dx) + 'px', '--flight-y': String(f.dy) + 'px', animationDelay: String(f.delay) + 'ms' } as CSSProperties}><FolderOpen size={15}/>{f.text}</div>)}
    {imagePreview && <div className="pitch-image-modal" role="dialog" aria-modal="true" aria-label="معاينة صورة العطل" onClick={() => setImagePreview(null)}>
      <button type="button" onClick={() => setImagePreview(null)} aria-label="إغلاق"><X size={20}/></button>
      {assets[imagePreview] && <img src={assets[imagePreview]} alt="صورة العطل الأصلية"/>}
    </div>}
    {settings && <div className="pitch-settings-backdrop" onClick={() => setSettings(false)}>
      <section className="pitch-settings-panel" role="dialog" aria-modal="true" aria-label="صور وأصوات العرض" onClick={e => e.stopPropagation()}>
        <div className="pitch-settings-head"><div><strong>صور وأصوات العرض</strong><p>ارفعي صور الأعطال الأربع الأصلية. تُحفظ على هذا المتصفح فقط.</p></div><button type="button" onClick={() => setSettings(false)}><X size={20}/></button></div>
        <h3>صور البلاغات</h3>
        {PHOTO_LABELS.map(item => <label className="pitch-asset-row" key={item.key}><span>{item.label}</span><span className="pitch-asset-status">{assets[item.key] ? 'تمت الإضافة ✓' : 'اختيار صورة'}</span><input type="file" accept="image/*" onChange={e => void setFile(item.key, e.target.files?.[0])}/></label>)}
        <h3>المؤثرات الصوتية والفويس</h3>
        <p className="pitch-settings-explain">المؤثرات الافتراضية أصلية ومشابهة لطابع تطبيقات المحادثة وليست نغمات واتساب الرسمية. يمكنكِ إضافة تسجيلات صوتية تملكين حق استخدامها لتعمل بدلها.</p>
        {SOUND_LABELS.map(item => <label className="pitch-asset-row" key={item.key}><span>{item.label}</span><span className="pitch-asset-status">{assets[item.key] ? 'تمت الإضافة ✓' : 'اختيار ملف صوتي'}</span><input type="file" accept="audio/*" onChange={e => void setFile(item.key, e.target.files?.[0])}/></label>)}
        <button className="pitch-settings-done" type="button" onClick={() => setSettings(false)}>تم <CheckCheck size={17}/></button>
      </section>
    </div>}
  </main>;
}
