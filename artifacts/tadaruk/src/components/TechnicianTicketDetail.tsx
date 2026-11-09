import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { Link } from 'wouter';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileText,
  LoaderCircle,
  MapPin,
  MapPinned,
  Maximize2,
  Layers3,
  Mic,
  RotateCcw,
  Square,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import TechnicianIssueMedia from './TechnicianIssueMedia';
import type { Ticket, DemoUser } from '@workspace/api-client-react';

type Lang = 'ar' | 'en';

const tr = (lang: Lang, ar: string, en: string) => (lang === 'ar' ? ar : en);

function priorityBadgeClass(priority: string) {
  if (priority === 'urgent') return 'priority-urgent';
  if (priority === 'high') return 'priority-high';
  if (priority === 'low') return 'priority-low';
  return 'priority-medium';
}

function priorityLabel(priority: string, lang: Lang) {
  const map: Record<string, [string, string]> = {
    urgent: ['طارئة', 'Urgent'],
    high: ['عالية', 'High'],
    medium: ['متوسطة', 'Medium'],
    low: ['منخفضة', 'Low'],
  };
  const item = map[priority] || ['متوسطة', 'Medium'];
  return lang === 'ar' ? item[0] : item[1];
}

function statusBadgeClass(status: string) {
  return `status-pill status-${status}`;
}

function statusLabel(status: string, lang: Lang) {
  const map: Record<string, [string, string]> = {
    new: ['جديد', 'New'],
    review: ['قيد المراجعة', 'In review'],
    in_progress: ['قيد التنفيذ', 'In progress'],
    awaiting_confirmation: ['بانتظار التأكيد', 'Awaiting confirmation'],
    closed: ['مغلق', 'Closed'],
    cancelled: ['ملغي', 'Cancelled'],
  };
  const item = map[status] || [status, status];
  return lang === 'ar' ? item[0] : item[1];
}

function classificationText(value: string | undefined, lang: Lang) {
  const map: Record<string, [string, string]> = {
    plumbing: ['سباكة ومياه', 'Plumbing & Water'],
    electrical: ['كهرباء وإنارة', 'Electrical & Lighting'],
    cooling: ['تكييف وتبريد', 'HVAC & Cooling'],
    equipment: ['معدات وآلات', 'Equipment & Machinery'],
    civil: ['أعمال مدنية وتشطيبات', 'Civil & Facilities'],
    safety: ['سلامة وأمان', 'Safety & Security'],
  };
  if (!value) return tr(lang, 'صيانة عامة', 'General maintenance');
  const found = map[value.toLowerCase()];
  return found ? (lang === 'ar' ? found[0] : found[1]) : value;
}

function dateText(value: string | undefined, lang: Lang) {
  if (!value) return '';
  try {
    const d = new Date(value);
    return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function branchMapUrl(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined,
  city: string | null | undefined,
  customUrl: string | null | undefined
) {
  if (customUrl) return customUrl;
  if (lat && lng) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const query = [address, city].filter(Boolean).join(', ');
  if (query) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  return undefined;
}

/* Minimalist Voice Recorder for Technicians */
function TechVoiceRecorder({
  lang,
  onTranscript,
}: {
  lang: Lang;
  onTranscript: (text: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [bars, setBars] = useState<number[]>(() => Array(16).fill(4));
  const [error, setError] = useState('');
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setRecording(false);
    setBars(Array(16).fill(4));
  };

  useEffect(() => {
    return () => cleanup();
  }, []);

  const startRecording = async () => {
    setError('');
    setSeconds(0);
    const speechWindow = window as any;
    const Speech = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Audio frequency visualizer
      const AudioCtx = window.AudioContext || speechWindow.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);

        const updateBars = () => {
          analyser.getByteFrequencyData(buffer);
          setBars(Array.from({ length: 16 }, (_, i) => Math.max(4, Math.min(26, (buffer[i] || 0) / 8))));
          animFrameRef.current = requestAnimationFrame(updateBars);
        };
        updateBars();
      }

      // Speech recognition if supported
      if (Speech) {
        const recognition = new Speech();
        recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          let fullText = '';
          for (let i = 0; i < event.results.length; i++) {
            fullText += event.results[i][0].transcript + ' ';
          }
          if (fullText.trim()) {
            onTranscript(fullText.trim());
          }
        };

        recognition.onerror = (e: any) => {
          if (e.error !== 'no-speech') {
            setError(tr(lang, 'تعذر التعرّف على الصوت. يمكنك كتابة الحل بدلاً من ذلك.', 'Speech recognition error. You can type instead.'));
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      timerRef.current = window.setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);

      setRecording(true);
    } catch {
      setError(tr(lang, 'يرجى السماح بالوصول إلى الميكروفون أو كتابة الحل في خانة النص.', 'Microphone access denied. Please allow permission or type the solution.'));
    }
  };

  const stopRecording = () => {
    cleanup();
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {!recording ? (
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1f3363] text-white text-xs font-bold hover:bg-[#2b457e] transition-all"
            onClick={startRecording}
          >
            <Mic size={15} />
            <span>{tr(lang, 'بدء التسجيل الصوتي', 'Start recording')}</span>
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all animate-pulse"
            onClick={stopRecording}
          >
            <Square size={13} fill="currentColor" />
            <span>{tr(lang, 'إيقاف وحفظ التسجيل', 'Stop & save')} ({formatSeconds(seconds)})</span>
          </button>
        )}

        {recording && (
          <div className="flex items-center gap-1 h-6 px-2 bg-slate-100 dark:bg-slate-800 rounded-md">
            {bars.map((bar, i) => (
              <span
                key={i}
                className="w-1 bg-[#307190] dark:bg-[#56f4ef] rounded-full transition-all duration-75"
                style={{ height: `${bar}px` }}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-rose-500 m-0">{error}</p>
      )}
    </div>
  );
}

export interface TechnicianTicketDetailProps {
  ticket: Ticket;
  lang: Lang;
  user: DemoUser;
  act: (action: 'start' | 'complete' | 'confirm' | 'reject' | 'reassign', extra?: Record<string, string>) => void;
  action: { isPending: boolean };
  actionFeedback?: string;
  localPhoto?: string;
  reduced?: boolean;
}

export function TechnicianTicketDetail({
  ticket,
  lang,
  user,
  act,
  action,
  actionFeedback,
  localPhoto,
}: TechnicianTicketDetailProps) {
  // Input method: 'text' or 'voice' (allow ONE input method)
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [solutionText, setSolutionText] = useState(ticket.resolution || ticket.repairNotes || '');
  const [repairPhoto, setRepairPhoto] = useState<string>(() => {
    return localStorage.getItem(`tadaruk-repair-photo:${ticket.id}`) || '';
  });
  // Sync solution text if ticket changes from backend
  useEffect(() => {
    if (ticket.resolution || ticket.repairNotes) {
      setSolutionText(ticket.resolution || ticket.repairNotes || '');
    }
    const saved = localStorage.getItem(`tadaruk-repair-photo:${ticket.id}`);
    if (saved) setRepairPhoto(saved);
  }, [ticket.id, ticket.resolution, ticket.repairNotes]);

  // Stage mapping (1: Received, 2: In Progress, 3: Awaiting Confirmation, 4: Closed)
  const currentStage =
    ticket.status === 'closed' ? 4
    : ticket.status === 'awaiting_confirmation' ? 3
    : ticket.status === 'in_progress' ? 2
    : 1;

  // Permissions: Is this ticket assigned to current technician?
  const isAssignedToMe = !ticket.technicianId || ticket.technicianId === user.id;

  // Reported issue photo
  const reportedPhotoUrl = ticket.imageUrl || localPhoto || null;
  const [photoError, setPhotoError] = useState('');

  // Handle repair photo upload
  const handleRepairPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
    const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
    if (!ALLOWED_TYPES.includes(file.type) && !hasValidExt) {
      setPhotoError(tr(lang, 'صيغة الصورة غير مدعومة. الصيغ المقبولة هي: PNG, JPG, JPEG فقط.', 'Unsupported image format. Accepted formats are: PNG, JPG, JPEG only.'));
      e.target.value = '';
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setPhotoError(tr(lang, 'حجم الصورة أكبر من ١٢ ميجابايت.', 'The image is larger than 12 MB.'));
      e.target.value = '';
      return;
    }
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) {
        setRepairPhoto(dataUrl);
        localStorage.setItem(`tadaruk-repair-photo:${ticket.id}`, dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const mapLink = branchMapUrl(
    ticket.branchLatitude,
    ticket.branchLongitude,
    ticket.branchAddress,
    ticket.branchCity,
    ticket.branchGoogleMapsUrl
  );

  return (
    <div className="tech-detail-page">
      {/* 1. Top Navigation & Context */}
      <div className="tech-detail-back">
        <Link href="/workspace/tickets" className="tech-back-link">
          {lang === 'ar' ? <ArrowRight size={15} /> : <ArrowLeft size={15} />}
          <span>{tr(lang, 'العودة إلى قائمة المهام', 'Back to tasks')}</span>
        </Link>

        <div className="tech-header-meta">
          <span className="tech-ticket-id-pill">{ticket.number}</span>
          {mapLink && (
            <a
              className="tech-map-pill"
              href={mapLink}
              target="_blank"
              rel="noreferrer"
              title={tr(lang, 'موقع الفرع في خرائط Google', 'Open location on Google Maps')}
            >
              <MapPinned size={14} />
              <span>{tr(lang, 'موقع الفرع في الخرائط', 'Branch on Maps')}</span>
              <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      </div>

      {/* Permission alert if assigned to another technician */}
      {!isAssignedToMe && (
        <div className="tech-notice-card" role="alert">
          <CircleAlert size={18} className="flex-shrink-0" />
          <div>
            <b>{tr(lang, 'هذا البلاغ مسند إلى فني آخر', 'Assigned to another technician')}</b>
            <p>
              {tr(
                lang,
                `المسؤول عن معالجة هذا العطل هو ${ticket.technicianName}. يمكنك الاطلاع على التفاصيل فقط.`,
                `This ticket is assigned to ${ticket.technicianName}. You can view the information in read-only mode.`
              )}
            </p>
          </div>
        </div>
      )}

      {/* 2. Priority 1: Hero Task Information Card */}
      <header className="tech-hero-card">
        <div className="tech-hero-badges">
          <span className={statusBadgeClass(ticket.status)}>
            {statusLabel(ticket.status, lang)}
          </span>
          <span className={`priority-badge ${priorityBadgeClass(ticket.priority)}`}>
            {priorityLabel(ticket.priority, lang)}
          </span>
          <span className="tech-spec-tag">
            <Wrench size={13} />
            {classificationText(ticket.specialization || ticket.category, lang)}
          </span>
        </div>

        <h1 className="tech-hero-title">{ticket.title}</h1>

        <div className="tech-meta-strip">
          <span className="tech-meta-item">
            <Building2 size={15} />
            <b>{ticket.branchName}</b>
          </span>
          <span className="tech-meta-item">
            <MapPin size={15} />
            <span>{ticket.location}</span>
          </span>
          <span className="tech-meta-item">
            <UserRound size={15} />
            <span>{tr(lang, 'المبلّغ:', 'Reporter:')} {ticket.reporterName}</span>
          </span>
          <span className="tech-meta-item">
            <Clock3 size={15} />
            <time>{dateText(ticket.createdAt, lang)}</time>
          </span>
        </div>
      </header>

      {/* 3. Priority 2: Clear Section to Update Ticket Status (Action Hub) */}
      <section className="tech-action-hub" aria-busy={action.isPending}>
        {/* Visual 4-Stage Pipeline */}
        <div className="tech-stages-bar" aria-label={tr(lang, 'مراحل متابعة العطل', 'Repair stages')}>
          {[
            { step: 1, ar: 'استلام الطلب', en: 'Received' },
            { step: 2, ar: 'قيد التنفيذ', en: 'In progress' },
            { step: 3, ar: 'بانتظار التأكيد', en: 'Confirmation' },
            { step: 4, ar: 'تم الإغلاق', en: 'Closed' },
          ].map(st => {
            const isPast = currentStage > st.step;
            const isCurrent = currentStage === st.step;
            return (
              <div
                key={st.step}
                className={`tech-stage-step ${isPast ? 'is-past' : ''} ${isCurrent ? 'is-current' : ''}`}
              >
                <span className="tech-stage-dot">
                  {isPast ? <Check size={14} strokeWidth={3} /> : st.step}
                </span>
                <span className="tech-stage-label">{tr(lang, st.ar, st.en)}</span>
              </div>
            );
          })}
        </div>

        {/* Action Content Based on Current Status */}
        {ticket.status === 'cancelled' ? (
          <div className="tech-notice-card" role="status">
            <CircleAlert size={18} />
            <div>
              <b>{tr(lang, 'أُلغي هذا البلاغ', 'Report cancelled')}</b>
              <p>{tr(lang, 'تم إلغاء البلاغ قبل بدء أعمال الصيانة.', 'This ticket was cancelled before work started.')}</p>
            </div>
          </div>
        ) : (ticket.status === 'new' || ticket.status === 'review') ? (
          /* STAGE 1: Fast One-Click Start Action (NO forms required!) */
          <div className="tech-action-box highlight-start">
            <div className="tech-action-intro">
              <div className="tech-action-icon-circle">
                <Wrench size={22} />
              </div>
              <div>
                <h3>{tr(lang, 'استلام الطلب وبدء العمل الميداني', 'Acknowledge & Start Work')}</h3>
                <p>
                  {tr(
                    lang,
                    'ابدأ العمل لتحديث حالة البلاغ وإشعار المبلّغ.',
                    'Start work to update the ticket and notify the reporter.'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="tech-primary-action-btn"
              disabled={action.isPending || !isAssignedToMe}
              onClick={() => act('start')}
              data-testid="button-tech-start"
            >
              {action.isPending ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <Wrench size={18} />
              )}
              <span>{tr(lang, 'استلمت الطلب — بدء العمل', 'Acknowledge & Start Work')}</span>
            </button>
          </div>
        ) : ticket.status === 'in_progress' ? (
          /* STAGE 2: Simple Repair Documentation Section */
          <div className="tech-action-box highlight-complete">
            <div className="tech-action-intro">
              <div className="tech-action-icon-circle success-tint">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <h3>{tr(lang, 'كيف أصلحت المشكلة؟', 'How did you fix the issue?')}</h3>
                <p>
                  {tr(
                    lang,
                    'وثّق الإصلاح كتابة أو صوتيًا قبل إرساله للتأكيد.',
                    'Document the repair by text or voice before confirmation.'
                  )}
                </p>
              </div>
            </div>

            {/* Input Method Selector (Choose ONE) */}
            <div className="tech-input-mode-picker" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'text'}
                className={`tech-mode-pill ${inputMode === 'text' ? 'is-active' : ''}`}
                onClick={() => setInputMode('text')}
              >
                <FileText size={15} />
                <span>{tr(lang, 'كتابة الحل (نص)', 'Written solution')}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'voice'}
                className={`tech-mode-pill ${inputMode === 'voice' ? 'is-active' : ''}`}
                onClick={() => setInputMode('voice')}
              >
                <Mic size={15} />
                <span>{tr(lang, 'تسجيل صوتي', 'Voice recording')}</span>
              </button>
            </div>

            {/* Input Area */}
            {inputMode === 'text' ? (
              <div className="tech-solution-text-zone">
                <label className="tech-field-label">
                  <span>{tr(lang, 'شرح الإجراء المنفذ (مطلوب)', 'Action taken (required)')}</span>
                  <textarea
                    value={solutionText}
                    onChange={e => setSolutionText(e.target.value)}
                    rows={3}
                    placeholder={tr(
                      lang,
                      'مثال: تم فحص التوصيلات واستبدال الجزء التالف والتأكد من إحكام الغلق وتشغيل الوحدة بنجاح...',
                      'Example: Inspected fittings, replaced damaged section, verified seals, and tested operation...'
                    )}
                    data-testid="input-tech-solution-text"
                    className="tech-solution-textarea"
                  />
                </label>
              </div>
            ) : (
              <div className="tech-solution-voice-zone">
                <div className="tech-voice-card">
                  <span className="tech-voice-hint">
                    {tr(lang, 'سجّل شرحاً موجزاً لما قمت به لحل العطل:', 'Record a brief explanation of how you resolved the issue:')}
                  </span>
                  <TechVoiceRecorder
                    lang={lang}
                    onTranscript={text => {
                      setSolutionText(cur => (cur ? `${cur.trimEnd()} ${text}` : text));
                    }}
                  />
                  {solutionText ? (
                    <div className="tech-voice-result">
                      <span className="tech-voice-result-label">
                        {tr(lang, 'النص المسجل:', 'Transcribed text:')}
                      </span>
                      <p className="tech-voice-result-text">{solutionText}</p>
                      <button
                        type="button"
                        className="tech-voice-clear-btn"
                        onClick={() => setSolutionText('')}
                      >
                        <RotateCcw size={12} />
                        <span>{tr(lang, 'إعادة التسجيل', 'Re-record')}</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* Mandatory Photo Upload: "صورة توثيق الحل (إلزامي)" */}
            <div className="tech-after-photo-section">
              <div className="tech-after-photo-head">
                <span className="tech-after-photo-title">
                  <Camera size={14} />
                  <span>{tr(lang, 'صورة توثيق الحل', 'Solution documentation photo')}</span>
                  <span className="rw-field-required-badge">{tr(lang, 'إلزامي', 'Required')}</span>
                </span>
                {repairPhoto && (
                  <span className="tech-after-photo-badge">
                    <Check size={12} strokeWidth={2.8} />
                    {tr(lang, 'تم إرفاق صورة الحل', 'Solution photo attached')}
                  </span>
                )}
              </div>

              {!repairPhoto ? (
                <div className="tech-photo-upload-wrap">
                  <label className="tech-photo-upload-btn" data-testid="button-upload-repair-photo">
                    <Camera size={16} />
                    <span>{tr(lang, 'التقاط أو رفع صورة للحل (إلزامي)', 'Capture or upload repair photo (Required)')}</span>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                      capture="environment"
                      className="sr-only"
                      onChange={handleRepairPhotoChange}
                    />
                  </label>
                  <p className="tech-photo-formats-hint">
                    {tr(lang, 'الصيغ المدعومة: PNG, JPG, JPEG (الحد الأقصى ١٢ ميجابايت)', 'Supported formats: PNG, JPG, JPEG (Max 12 MB)')}
                  </p>
                </div>
              ) : (
                <div className="tech-repair-photo-preview">
                  <img
                    src={repairPhoto}
                    alt={tr(lang, 'صورة بعد الإصلاح', 'After repair preview')}
                    className="tech-repair-thumb"
                    onClick={() => setExpandedPhoto(repairPhoto)}
                  />
                  <div className="tech-repair-photo-actions">
                    <button
                      type="button"
                      className="tech-photo-action-btn"
                      onClick={() => setExpandedPhoto(repairPhoto)}
                      title={tr(lang, 'تكبير الصورة', 'Expand photo')}
                    >
                      <Maximize2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="tech-photo-action-btn delete"
                      onClick={() => {
                        setRepairPhoto('');
                        localStorage.removeItem(`tadaruk-repair-photo:${ticket.id}`);
                      }}
                      title={tr(lang, 'حذف الصورة', 'Delete photo')}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              )}

              {photoError && (
                <p className="tech-photo-error-msg" role="alert">
                  <CircleAlert size={14} />
                  <span>{photoError}</span>
                </p>
              )}

              {!repairPhoto && solutionText.trim() && (
                <p className="tech-photo-missing-hint" role="status">
                  <CircleAlert size={14} />
                  <span>{tr(lang, 'يلزم إرفاق صورة توضح اكتمال الإصلاح لإتاحة إرسال البلاغ للتأكيد.', 'A photo confirming the fix is required before submitting for confirmation.')}</span>
                </p>
              )}
            </div>

            {/* Single Clear Primary Action to Submit for Confirmation */}
            <button
              type="button"
              className="tech-primary-action-btn"
              disabled={!solutionText.trim() || !repairPhoto || action.isPending || !isAssignedToMe}
              onClick={() => {
                if (!repairPhoto) {
                  setPhotoError(tr(lang, 'إرفاق صورة الحل إلزامي لإتمام الإصلاح.', 'Attaching a solution photo is required to complete the repair.'));
                  return;
                }
                localStorage.setItem(`tadaruk-repair-photo:${ticket.id}`, repairPhoto);
                act('complete', {
                  note: solutionText.trim(),
                  resolution: solutionText.trim(),
                });
              }}
              data-testid="button-tech-complete"
            >
              {action.isPending ? (
                <LoaderCircle size={18} className="animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              <span>{tr(lang, 'إرسال الإصلاح لتأكيد المبلّغ', 'Submit for Reporter Confirmation')}</span>
            </button>
          </div>
        ) : ticket.status === 'awaiting_confirmation' ? (
          /* STAGE 3: Waiting on Reporter Confirmation */
          <div className="tech-action-box">
            <div className="tech-status-card-inner">
              <div className="tech-status-icon-bubble waiting">
                <Clock3 size={24} />
              </div>
              <div className="tech-status-card-copy">
                <h3>{tr(lang, 'تم إرسال الإصلاح — بانتظار مراجعة وتأكيد المبلّغ', 'Repair Submitted — Awaiting Confirmation')}</h3>
                <p>
                  {tr(
                    lang,
                    `بانتظار تأكيد المبلّغ لإغلاق البلاغ.`,
                    `Waiting for reporter confirmation to close the ticket.`
                  )}
                </p>
              </div>
            </div>

            {/* Documented Solution Display */}
            <div className="tech-documented-record">
              <span className="tech-record-label">{tr(lang, 'الحل الموثق من طرفك:', 'Documented solution:')}</span>
              <p className="tech-record-text">{ticket.resolution || ticket.repairNotes || solutionText}</p>

              {repairPhoto && (
                <div className="tech-documented-photo">
                  <span className="tech-record-label">{tr(lang, 'صورة بعد الإصلاح:', 'After-repair photo:')}</span>
                  <img
                    src={repairPhoto}
                    alt={tr(lang, 'صورة بعد الإصلاح', 'After repair')}
                    className="tech-documented-img"
                    onClick={() => setExpandedPhoto(repairPhoto)}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* STAGE 4: Closed / Confirmed */
          <div className="tech-action-box">
            <div className="tech-status-card-inner">
              <div className="tech-status-icon-bubble closed">
                <CheckCircle2 size={24} />
              </div>
              <div className="tech-status-card-copy">
                <h3>{tr(lang, 'تم تأكيد الإصلاح وإغلاق البلاغ بنجاح', 'Repair Confirmed & Ticket Closed')}</h3>
                <p>
                  {tr(
                    lang,
                    'أكّد المبلّغ الإصلاح وأُغلق البلاغ.',
                    'The reporter confirmed the repair and the ticket is closed.'
                  )}
                </p>
              </div>
            </div>

            <div className="tech-documented-record">
              <span className="tech-record-label">{tr(lang, 'الحل المعتمد في قاعدة المعرفة:', 'Confirmed solution in knowledge base:')}</span>
              <p className="tech-record-text">{ticket.resolution || ticket.repairNotes}</p>
            </div>
          </div>
        )}

        {actionFeedback && (
          <div className="mt-3 text-xs font-bold text-[#1f3363] dark:text-[#56f4ef] flex items-center gap-2">
            <Check size={14} />
            <span>{actionFeedback}</span>
          </div>
        )}
      </section>

      {/* Issue Description & Small Preview of Reported Photo */}
      <section className="tech-info-card">
        <div className="tech-info-header">
          <ClipboardList size={16} className="text-[#307190]" />
          <h3>{tr(lang, 'وصف المشكلة في البلاغ', 'Reported Issue Description')}</h3>
        </div>

        <p className="tech-issue-description">{ticket.description}</p>

        <div className="tech-reported-photo-block">
          <span className="tech-sublabel">{tr(lang, 'صورة العطل المرفقة:', 'Attached issue photo:')}</span>
          {reportedPhotoUrl ? (
            <TechnicianIssueMedia key={ticket.id} ticketId={ticket.id} imageUrl={reportedPhotoUrl} lang={lang}/>
          ) : (
            <p className="tech-no-photo-note">
              {tr(lang, 'لا توجد صورة محفوظة لهذا البلاغ.', 'No saved issue photo is available.')}
            </p>
          )}
        </div>
      </section>


    </div>
  );
}

