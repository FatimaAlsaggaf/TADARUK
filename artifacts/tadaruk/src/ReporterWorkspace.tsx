import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, Building2, CalendarDays, Camera, Check, CheckCircle2,
  ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Clock3, FileText, ImagePlus,
  LoaderCircle, MapPin, Plus, RefreshCw, RotateCcw, Search, Send, ShieldCheck, Sparkles,
  Ticket as TicketIcon, Trash2, UserRound, Wrench, X
} from 'lucide-react';
import {
  getGetOverviewQueryKey, getListTicketsQueryKey, useCreateTicket, useListReporterBranches,
  useGetOverview, useListTickets,
  type DemoUser, type ReporterBranch, type Ticket, type TicketAnalysis, type TicketInput, type TicketPriority,
  FALLBACK_REPORTER_BRANCHES
} from '@workspace/api-client-react';
import { AiVoiceInput } from '@/components/ui/ai-voice-input';
import { TadarukSelect } from '@/components/TadarukSelect';
import {
  reporterDemoAnalysisAdapter,
  PRESET_DEMO_SCENARIOS,
  type ReporterDemoAnalysisRequest
} from '@/services/reporter-demo-analysis';
import Stepper, { Step } from '@/components/Stepper';
import './reporter-workspace.css';

type ReporterLang = 'ar' | 'en';
type ReporterPageProps = { lang: ReporterLang; user: DemoUser };
type NewTicketPageProps = ReporterPageProps & {
  selectedBranchId: string;
};

const text = (lang: ReporterLang, ar: string, en: string) => lang === 'ar' ? ar : en;
const dateLabel = (value: string, lang: ReporterLang) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', { day: 'numeric', month: 'short' }).format(date);
};
const statusLabel = (status: string, lang: ReporterLang) => {
  const labels: Record<string, [string, string]> = {
    new: ['جديد', 'New'], review: ['قيد المراجعة', 'In review'],
    in_progress: ['جاري العمل', 'In progress'],
    awaiting_confirmation: ['بانتظار التأكيد', 'Awaiting confirmation'],
    closed: ['مغلق', 'Closed'],
    cancelled: ['ملغي', 'Cancelled']
  };
  return labels[status]?.[lang === 'ar' ? 0 : 1] ?? status;
};
const priorityLabel = (priority: string, lang: ReporterLang) => {
  const labels: Record<string, [string, string]> = {
    urgent: ['طارئ', 'Urgent'], high: ['عالية', 'High'],
    medium: ['متوسطة', 'Medium'], low: ['منخفضة', 'Low']
  };
  return labels[priority]?.[lang === 'ar' ? 0 : 1] ?? priority;
};
const priorityClass = (priority: string) => `rw-priority rw-priority-${priority}`;
const locationChoices = ['المطبخ', 'صالة العملاء', 'المستودع', 'دورات المياه', 'مكان آخر'];
const classificationOptions: Array<[string, string, string]> = [
  ['cooling', 'تكييف وتبريد', 'Cooling'],
  ['electrical', 'كهرباء وإنارة', 'Electrical'],
  ['plumbing', 'سباكة ومياه', 'Plumbing'],
  ['general', 'صيانة عامة', 'General maintenance'],
];
const classificationLabel = (value: string, lang: ReporterLang) =>
  classificationOptions.find(([key]) => key === value)?.[lang === 'ar' ? 1 : 2] ?? value;

function ReporterHeading({ title, description, action, lang }: {
  eyebrow?: string; title: string; description: string; action?: ReactNode; lang: ReporterLang;
}) {
  return <div className="rw-heading">
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {action}
  </div>;
}

function ReporterTicketRows({ tickets, lang, emptyTitle, emptyDescription }: {
  tickets: Ticket[]; lang: ReporterLang; emptyTitle: string; emptyDescription: string;
}) {
  const rtl = lang === 'ar';
  if (!tickets.length) return <div className="rw-empty" data-testid="state-tickets-empty">
    <span className="rw-empty-mark"><ClipboardList size={21}/></span>
    <h3>{emptyTitle}</h3>
    <p>{emptyDescription}</p>
  </div>;
  return <div className="rw-ticket-list">
    {tickets.map(ticket => {
      const StatusIcon = ticket.status === 'closed' ? CheckCircle2
        : ticket.status === 'in_progress' ? Wrench
        : ticket.status === 'review' || ticket.status === 'awaiting_confirmation' ? Clock3
        : CircleAlert;
      return (
        <Link
          key={ticket.id}
          href={`/workspace/tickets/${ticket.id}`}
          className="rw-ticket-link"
          data-testid={`link-ticket-${ticket.id}`}
          aria-label={text(lang, `فتح البلاغ ${ticket.number}: ${ticket.title}`, `Open report ${ticket.number}: ${ticket.title}`)}
        >
          <span className="rw-ticket-no" data-testid={`text-ticket-number-${ticket.id}`}>{ticket.number}</span>
          <span className="rw-ticket-main">
            <b data-testid={`text-ticket-title-${ticket.id}`}>{ticket.title}</b>
            <small>{ticket.branchName}{ticket.location ? ` · ${ticket.location}` : ''}</small>
            <span className="rw-ticket-technician"><span className="rw-tech-avatar"><UserRound size={13}/></span>{ticket.technicianName || text(lang, 'بانتظار الإسناد', 'Awaiting assignment')}</span>
          </span>
          <span className={priorityClass(ticket.priority)} data-testid={`text-ticket-priority-${ticket.id}`}>{priorityLabel(ticket.priority, lang)}</span>
          <span className={`rw-status rw-status-${ticket.status}`} data-testid={`status-ticket-${ticket.id}`}>
            <StatusIcon size={13} aria-hidden="true"/>{statusLabel(ticket.status, lang)}
          </span>
          <time className="rw-date" dateTime={ticket.createdAt} data-testid={`date-ticket-${ticket.id}`}>{dateLabel(ticket.createdAt, lang)}</time>
          {rtl ? <ChevronLeft className="rw-arrow" size={16} aria-hidden="true"/> : <ChevronRight className="rw-arrow" size={16} aria-hidden="true"/>}
        </Link>
      );
    })}
  </div>;
}

function TicketLoadingState() {
  return <div className="rw-state" aria-label="Loading reports" role="status" data-testid="state-tickets-loading">
    <span className="rw-skeleton"/><span className="rw-skeleton"/><span className="rw-skeleton"/>
  </div>;
}

export function ReporterHomePage({ lang, user }: ReporterPageProps) {
  const { data: overview, isLoading: overviewLoading, isError: overviewError, refetch: refetchOverview } = useGetOverview();
  const { data: tickets, isLoading, isError, refetch } = useListTickets();
  const rows = Array.isArray(tickets) ? tickets.filter(ticket => !user || ticket.reporterId === user.id) : [];
  const openCount = rows.filter(ticket => ticket.status !== 'closed').length;
  const waitingCount = rows.filter(ticket => ticket.status === 'awaiting_confirmation').length;
  const resolvedCount = overview?.resolvedThisMonth ?? rows.filter(ticket => ticket.status === 'closed').length;
  const loading = isLoading || overviewLoading;
  const failed = isError || overviewError;
  const retry = () => { void refetch(); void refetchOverview(); };

  return <div className="reporter-view" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <ReporterHeading
      title={text(lang, `أهلاً ${user.name.split(' ')[0]}`, `Hello, ${user.name.split(' ')[0]}`)}
      description={text(lang, 'أرسل ما يحتاج إلى إصلاح، وتابع كل خطوة حتى يعود المكان للعمل.', 'Tell us what needs fixing, then follow each step until it is resolved.')}
      lang={lang}
    />
    <section className="rw-home-intro" aria-label={text(lang, 'بدء بلاغ صيانة', 'Start a maintenance report')}>
      <div className="rw-home-copy">
        <h2>{text(lang, 'ما الذي يحتاج إلى عناية في فرعك؟', 'What needs attention at your branch?')}</h2>
        <p>{text(lang, 'اكتب ما لاحظته بلغتك. سنرتب البلاغ ونبقيك على اطلاع بحالته.', 'Describe what you noticed in your own words. We will organize the report and keep you updated.')}</p>
        <Link href="/workspace/tickets/new" className="rw-button" data-testid="link-start-report">
          {text(lang, 'أخبرنا بالمشكلة', 'Tell us about it')}
          {lang === 'ar' ? <ArrowLeft size={16}/> : <ArrowRight size={16}/>}
        </Link>
      </div>
      <div className="rw-home-symbol" aria-hidden="true">
        <span className="rw-document-orbit"><FileText size={44} strokeWidth={1.45}/><i/><i/><i/></span>
      </div>
    </section>
    {loading ? <TicketLoadingState/> : failed ? <div className="rw-error" role="alert" data-testid="state-home-error">
      <CircleAlert size={19}/>
      <div><p>{text(lang, 'تعذر تحميل بلاغاتك الآن. حاول مرة أخرى.', 'Your reports could not be loaded. Please try again.')}</p>
        <button type="button" className="rw-text-button" onClick={retry} data-testid="button-retry-home"><RotateCcw size={14}/>{text(lang, 'إعادة المحاولة', 'Try again')}</button>
      </div>
    </div> : <>
      <section className="rw-overview-strip" aria-label={text(lang, 'ملخص بلاغاتي', 'My reports summary')} data-testid="overview-reporter">
        <div className="rw-stat"><span className="rw-stat-icon"><ClipboardList size={18}/></span><span><b data-testid="count-my-reports">{rows.length}</b><small>{text(lang, 'إجمالي بلاغاتي', 'Reports submitted')}</small></span></div>
        <div className="rw-stat"><span className="rw-stat-icon"><Clock3 size={18}/></span><span><b data-testid="count-open-reports">{openCount}</b><small>{text(lang, 'قيد المتابعة', 'Being followed up')}</small></span></div>
        <div className="rw-stat"><span className="rw-stat-icon"><Check size={18}/></span><span><b data-testid="count-resolved-reports">{resolvedCount}</b><small>{text(lang, 'إصلاحات هذا الشهر', 'Resolved this month')}</small></span></div>
      </section>
      {waitingCount > 0 && <p className="rw-branch-note" data-testid="status-awaiting-confirmation"><ShieldCheck size={16}/>{text(lang, `هناك ${waitingCount} بلاغ بانتظار تأكيدك.`, `${waitingCount} report${waitingCount === 1 ? ' is' : 's are'} waiting for your confirmation.`)}</p>}
      <section className="rw-section">
        <div className="rw-section-head">
          <div><h2>{text(lang, 'آخر بلاغاتك', 'Your recent reports')}</h2></div>
          <Link href="/workspace/tickets" className="rw-link" data-testid="link-all-reports">{text(lang, 'عرض الكل', 'View all')}{lang === 'ar' ? <ArrowLeft size={15}/> : <ArrowRight size={15}/>}</Link>
        </div>
        <ReporterTicketRows tickets={rows.slice(0, 5)} lang={lang}
          emptyTitle={text(lang, 'لم ترسل بلاغاً بعد', 'No reports yet')}
          emptyDescription={text(lang, 'عندما تلاحظ شيئاً يحتاج إلى إصلاح، ابدأ ببلاغك الأول هنا.', 'When you notice something that needs fixing, start your first report here.')}/>
      </section>
    </>}
  </div>;
}

export function ReporterTicketsPage({ lang, user }: ReporterPageProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const params = useMemo(() => ({ search: search.trim() || undefined, status: status || undefined }), [search, status]);
  const { data: tickets, isLoading, isError, refetch } = useListTickets(params);
  const shown = Array.isArray(tickets) ? tickets.filter(ticket => !user || ticket.reporterId === user.id) : [];
  const hasFilter = Boolean(search.trim() || status);

  return <div className="reporter-view" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <ReporterHeading
      eyebrow={text(lang, 'سجل بلاغاتك', 'YOUR REPORT HISTORY')}
      title={text(lang, 'بلاغاتي', 'My reports')}
      description={text(lang, 'كل ما أرسلته إلى فريق الصيانة، وحالته الحالية في مكان واحد.', 'Every report you have sent to maintenance, with its current status in one place.')}
      lang={lang}
      action={<Link href="/workspace/tickets/new" className="rw-button rw-button-secondary" data-testid="link-new-report"><Plus size={17}/>{text(lang, 'بلاغ جديد', 'New report')}</Link>}
    />
    <div className="rw-filter-bar">
      <label className="rw-search"><Search size={17} aria-hidden="true"/>
        <input value={search} onChange={event => setSearch(event.currentTarget.value)}
          placeholder={text(lang, 'ابحث برقم البلاغ أو عنوانه', 'Search by report number or title')}
          aria-label={text(lang, 'ابحث في بلاغاتي', 'Search my reports')} data-testid="input-ticket-search"/>
      </label>
      <div className="rw-filter">
        <TadarukSelect value={status} onValueChange={setStatus} ariaLabel={text(lang, 'تصفية حسب الحالة', 'Filter by status')} dir={lang === 'ar' ? 'rtl' : 'ltr'} testId="select-ticket-status" options={[
          { value: '', label: text(lang, 'كل الحالات', 'All statuses') },
          { value: 'new', label: statusLabel('new', lang) },
          { value: 'review', label: statusLabel('review', lang) },
          { value: 'in_progress', label: statusLabel('in_progress', lang) },
          { value: 'awaiting_confirmation', label: statusLabel('awaiting_confirmation', lang) },
          { value: 'closed', label: statusLabel('closed', lang) },
        ]}/>
      </div>
    </div>
    {isLoading ? <TicketLoadingState/> : isError ? <div className="rw-error" role="alert" data-testid="state-reports-error">
      <CircleAlert size={19}/>
      <div><p>{text(lang, 'تعذر تحميل سجل البلاغات.', 'Your report history could not be loaded.')}</p>
        <button type="button" className="rw-text-button" onClick={() => void refetch()} data-testid="button-retry-reports"><RotateCcw size={14}/>{text(lang, 'إعادة المحاولة', 'Try again')}</button>
      </div>
    </div> : <section className="rw-section" data-testid="list-my-reports">
      <ReporterTicketRows tickets={shown} lang={lang}
        emptyTitle={text(lang, hasFilter ? 'لا توجد نتائج مطابقة' : 'لم ترسل بلاغاً بعد', hasFilter ? 'No matching reports' : 'No reports yet')}
        emptyDescription={text(lang, hasFilter ? 'جرّب تغيير كلمات البحث أو الحالة.' : 'Your submitted maintenance reports will appear here.', hasFilter ? 'Try another search or status.' : 'عندما ترسل بلاغاً، ستظهر تفاصيله وحالته هنا.')}/>
    </section>}
  </div>;
}

async function fileToPreview(file: File, lang: ReporterLang): Promise<string> {
  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];
  const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_EXTENSIONS.some(ext => lowerName.endsWith(ext));
  if (!ALLOWED_MIME_TYPES.includes(file.type) && !hasValidExt) {
    throw new Error(text(lang, 'صيغة الملف غير مدعومة. الصيغ المقبولة هي: PNG, JPG, JPEG فقط.', 'Unsupported file format. Accepted formats are: PNG, JPG, JPEG only.'));
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error(text(lang, 'حجم الصورة أكبر من ١٢ ميغابايت.', 'The image is larger than 12 MB.'));
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(text(lang, 'تعذر قراءة هذا النوع من الصور. يرجى اختيار صورة صالحة بصيغة PNG أو JPG أو JPEG.', 'This image format could not be read. Please choose a valid PNG, JPG, or JPEG image.'));
  }
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error(text(lang, 'تعذر تجهيز الصورة.', 'Could not prepare the image.'));
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', .72);
}

export function ReporterNewTicketPage({ lang, user, selectedBranchId }: NewTicketPageProps) {
  const { data: reporterBranches, isLoading: branchesLoading, isError: branchesError, refetch: refetchBranches } = useListReporterBranches();
  const allowedBranches = useMemo(() => {
    if (Array.isArray(reporterBranches) && reporterBranches.length > 0) return reporterBranches;
    return (FALLBACK_REPORTER_BRANCHES as unknown as ReporterBranch[]);
  }, [reporterBranches]);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [otherLocation, setOtherLocation] = useState('');
  const [needsLocation, setNeedsLocation] = useState(false);
  const [photo, setPhoto] = useState('');

  const [photoError, setPhotoError] = useState('');
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [photoSaveFailed, setPhotoSaveFailed] = useState(false);
  const [submittedTicket, setSubmittedTicket] = useState<{ id: string; number: string } | null>(null);
  const [analysis, setAnalysis] = useState<TicketAnalysis | null>(null);
  const [title, setTitle] = useState('');
  const [reviewDescription, setReviewDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [specialization, setSpecialization] = useState('');
  const [reviewLocation, setReviewLocation] = useState('');
  const [reviewEditing, setReviewEditing] = useState(false);
  const [previewPreparedAt, setPreviewPreparedAt] = useState<Date | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiStage, setAiStage] = useState<number>(0);
  const reduced = useReducedMotion() === true;
  const analyze = useMutation({
    mutationFn: (input: ReporterDemoAnalysisRequest) => reporterDemoAnalysisAdapter.analyze(input),
  });
  const create = useCreateTicket();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const clarificationValue = selectedLocation === 'مكان آخر' ? otherLocation.trim() : selectedLocation;
  const clarifiedLocation = selectedLocation === 'مكان آخر' || lang === 'ar' ? clarificationValue
    : ({ 'المطبخ': 'Kitchen', 'صالة العملاء': 'Customer area', 'المستودع': 'Storage', 'دورات المياه': 'Restrooms' } as Record<string, string>)[clarificationValue] ?? clarificationValue;

  const effectiveBranchId = allowedBranches.find(branch => branch.id === selectedBranchId)?.id
    ?? allowedBranches.find(branch => branch.id === user.branchId)?.id
    ?? allowedBranches[0]?.id
    ?? '';
  const selectedBranch = allowedBranches.find(branch => branch.id === effectiveBranchId) || allowedBranches[0];
  const canUseBranch = Boolean(selectedBranch);

  const renderBranchChoice = () => {
    if (branchesLoading) return <p className="rw-branch-note" role="status" data-testid="status-branches-loading">
      <LoaderCircle size={15} className="animate-spin" />{text(lang, 'جارٍ تحميل الفروع المسموح بها...', 'Loading your authorized branches...')}
    </p>;
    if (branchesError) return <div className="rw-inline-error" role="alert" data-testid="status-branches-error">
      <span>{text(lang, 'تعذر تحميل الفروع المسموح بها. أعد المحاولة قبل متابعة البلاغ.', 'Could not load your authorized branches. Retry before continuing.')}</span>
      <button type="button" className="rw-text-button" onClick={() => void refetchBranches()} data-testid="button-retry-branches"><RotateCcw size={14}/>{text(lang, 'إعادة المحاولة', 'Try again')}</button>
    </div>;
    if (!allowedBranches.length) return <p className="rw-inline-error" role="alert" data-testid="status-no-authorized-branches">
      {text(lang, 'لا يوجد لديك فرع مسموح به حالياً. اطلب من مديرك إسناد فرع قبل إنشاء البلاغ.', 'You do not have an authorized branch yet. Ask your manager to assign one before creating a report.')}
    </p>;
    return <div className="rw-branch-note" data-testid="text-selected-branch">
      <Building2 size={15} className="text-[#307190]" />
      <span>{text(lang, 'الفرع المصرح', 'Authorized branch')}: <b>{selectedBranch?.name}</b>{selectedBranch?.city ? ` · ${selectedBranch.city}` : ''}</span>
      {allowedBranches.length > 1 && <small className="mr-auto">{text(lang, 'يمكن تغييره من الشريط الجانبي', 'Change in sidebar')}</small>}
    </div>;
  };

  const beginReview = (suggestion: TicketAnalysis, preferredLocation = '') => {
    const finalLocation = preferredLocation || suggestion.location || (lang === 'ar' ? 'داخل الفرع' : 'Inside branch');
    setAnalysis(suggestion);
    setTitle(suggestion.title);
    setReviewDescription(suggestion.description);
    setCategory(suggestion.category || 'general');
    setPriority((suggestion.priority as TicketPriority) || 'medium');
    setSpecialization(suggestion.specialization || 'general');
    setReviewLocation(finalLocation);
    setReviewEditing(false);
    setPreviewPreparedAt(new Date());
    setNeedsLocation(false);
  };

  const handleStartAnalysis = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawDescription = description.trim();
    const suppliedLocation = location.trim();

    if (!rawDescription) {
      descriptionInputRef.current?.focus();
      return;
    }

    if (!photo) {
      setPhotoError(text(lang, 'إرفاق صورة للمشكلة إلزامي لمتابعة البلاغ.', 'Attaching a photo of the issue is required to continue.'));
      const uploader = document.querySelector('[data-testid="panel-photo-uploader"]');
      uploader?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setPhotoError('');
    setIsAnalyzing(true);
    setAiStage(1);

    // Staged progressive AI animation:
    // Stage 1: فهم المشكلة (0-600ms)
    // Stage 2: تحديد نوع العطل (600-1200ms)
    // Stage 3: تجهيز التذكرة (1200-1800ms)
    const t1 = window.setTimeout(() => setAiStage(2), 600);
    const t2 = window.setTimeout(() => setAiStage(3), 1200);
    const t3 = window.setTimeout(() => {
      analyze.mutate({
        description: rawDescription,
        locale: lang,
        ...(suppliedLocation ? { location: suppliedLocation } : {})
      }, {
        onSuccess: suggestion => {
          setIsAnalyzing(false);
          setAiStage(0);
          if ((suggestion.needsClarification || !suggestion.location) && !suppliedLocation) {
            setSelectedLocation('');
            setOtherLocation('');
            setNeedsLocation(true);
            setAnalysis(suggestion);
            return;
          }
          beginReview(suggestion, suppliedLocation || suggestion.location);
        },
        onError: () => {
          setIsAnalyzing(false);
          setAiStage(0);
        }
      });
    }, 1800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  };

  const handleClarify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clarificationValue) return;
    const finalClarified = clarifiedLocation;
    setLocation(finalClarified);
    analyze.mutate({ description: description.trim(), location: finalClarified, locale: lang }, {
      onSuccess: suggestion => beginReview(suggestion, finalClarified)
    });
  };

  const setPhotoFromFile = async (file?: File) => {
    if (!file) return;
    setPhotoError('');
    try { setPhoto(await fileToPreview(file, lang)); }
    catch (error) { setPhotoError(error instanceof Error ? error.message : text(lang, 'تعذر تجهيز الصورة.', 'Could not prepare the image.')); }
  };

  const appendTranscript = (transcript: string) => {
    setDescription(current => current ? `${current.trimEnd()} ${transcript}` : transcript);
  };

  const backToCompose = () => {
    setAnalysis(null);
    setNeedsLocation(false);
    setReviewEditing(false);
    setIsAnalyzing(false);
    if (reviewLocation) setLocation(reviewLocation);
  };

  const returnToPreview = () => setReviewEditing(false);

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!photo) {
      setPhotoError(text(lang, 'إرفاق صورة للمشكلة إلزامي لإرسال البلاغ.', 'Attaching a photo is required to submit the report.'));
      return;
    }
    const payload: TicketInput = {
      title: title.trim(),
      description: reviewDescription.trim(),
      category: category.trim(),
      priority,
      specialization: specialization.trim(),
      location: reviewLocation.trim(),
      branchId: effectiveBranchId,
      imageUrl: null
    };
    create.mutate({ data: payload }, {
      onSuccess: ticket => {
        if (photo) {
          try {
            localStorage.setItem(`tadaruk-photo:${ticket.id}`, photo);
          }
          catch {
            setPhotoError(text(lang, 'أُرسل البلاغ، لكن تعذر حفظ الصورة على هذا الجهاز.', 'The report was sent, but this device could not keep the photo.'));
            setPhotoSaveFailed(true);
          }
        }
        void queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() });
        setSubmittedTicket({ id: ticket.id, number: ticket.number });
      }
    });
  };

  useEffect(() => {
    if (!submittedTicket || photoSaveFailed) return;
    const timer = window.setTimeout(() => navigate(`/workspace/tickets/${submittedTicket.id}`), 2200);
    return () => window.clearTimeout(timer);
  }, [submittedTicket, photoSaveFailed, navigate]);

  // Three-step workflow mapping:
  // Step 1: وصف المشكلة
  // Step 2: تحليل وتجهيز البلاغ (while analyzing or needing location clarification)
  // Step 3: مراجعة وتأكيد البلاغ
  // Step 4: تم الإرسال بنجاح
  const step = submittedTicket ? 4 : analysis && !needsLocation ? 3 : (isAnalyzing || needsLocation) ? 2 : 1;
  const nextIcon = lang === 'ar' ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>;

  return (
    <div className="reporter-view" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <ReporterHeading
        title={text(lang, 'تسجيل بلاغ جديد', 'Submit a new report')}
        description={text(lang, 'صف المشكلة وسنجهّز بلاغك للمراجعة.', 'Describe the issue and review the prepared report.')}
        lang={lang}
      />

      <Stepper
        className="rw-new-report-stepper"
        step={step}
        showFooter={false}
        width="100%"
        radius={18}
        accentColor="#1f3363"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        onStepChange={target => {
          if (target === 1) backToCompose();
        }}
        completedContent={
          submittedTicket ? (
            <div className="rw-submission-success-card" role="status" data-testid="state-report-sent">
              <div className="rw-success-icon-wrap">
                <span className="rw-success-pulse-ring" />
                <span className="rw-success-icon">
                  <CheckCircle2 size={40} strokeWidth={2.4} />
                </span>
              </div>
              <h2>{text(lang, 'تم إرسال البلاغ بنجاح', 'Report sent successfully')}</h2>
              <div className="rw-ticket-num-badge">
                {text(lang, 'رقم البلاغ:', 'Ticket number:')} <strong>{submittedTicket.number}</strong>
              </div>
              <p className="rw-success-sub">
                {photoSaveFailed
                  ? photoError
                  : text(
                      lang,
                      'تم إسناد البلاغ وتوجيهه إلى فريق الصيانة المختص. جارٍ فتح تفاصيل البلاغ تلقائياً.',
                      'The report has been created and directed to the maintenance team. Opening details now.',
                    )}
              </p>
              <button
                type="button"
                className="rw-button rw-button-primary"
                onClick={() => navigate(`/workspace/tickets/${submittedTicket.id}`)}
                data-testid="button-open-created-report"
              >
                {text(lang, 'عرض تفاصيل البلاغ', 'Open ticket details')}
                {nextIcon}
              </button>
            </div>
          ) : null
        }
      >
        <Step
          title={text(lang, 'وصف المشكلة', 'Describe issue')}
          description={text(lang, 'كتابة أو تسجيل صوتي', 'Text or voice note')}
        >
          <form
            onSubmit={handleStartAnalysis}
            data-testid="form-report-description"
          >
            <div className="rw-report-intro">
              <div className="rw-report-intro-text">
                <h2>{text(lang, 'صف ما لاحظته في الفرع', 'Describe what you noticed')}</h2>
              </div>
            </div>

            {renderBranchChoice()}

            {/* Quick Preset Demo Scenarios */}
            <div className="rw-preset-bar">
              <span className="rw-preset-hint">
                <Sparkles size={14} />
                {text(lang, 'أمثلة جاهزة للتجربة السريعة:', 'Quick demo presets:')}
              </span>
              <div className="rw-preset-chips">
                {PRESET_DEMO_SCENARIOS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    className="rw-preset-chip"
                    onClick={() => {
                      setDescription(preset.description[lang]);
                      setLocation(preset.location[lang]);
                      setPhoto(preset.photoUrl);
                      setPhotoError('');
                    }}
                    data-testid={`preset-scenario-${preset.id}`}
                  >
                    <span>{preset.emoji}</span>
                    <span>{preset.label[lang]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description Textarea */}
            <label className="rw-field">
              <span className="font-semibold text-sm">
                {text(lang, 'وصف المشكلة', 'Describe the issue')}
              </span>
              <textarea
                ref={descriptionInputRef}
                value={description}
                onChange={event => setDescription(event.currentTarget.value)}
                placeholder={text(lang, 'مثال: يوجد تسريب ماء أسفل حوض التحضير في المطبخ...', 'Example: There is a water leak beneath the prep sink in the kitchen...')}
                className="text-base"
                data-testid="input-report-description"
              />
            </label>

            {/* Voice Input Section */}
            <div className="rw-input-options rw-voice-inline" aria-label={text(lang, 'تسجيل صوتي للمشكلة', 'Record an issue voice note')}>
              <AiVoiceInput
                lang={lang}
                onTranscript={appendTranscript}
              />
              <span className="rw-voice-helper">{text(lang, 'سجّل صوتك وسنضيف الكلام إلى وصف المشكلة تلقائيًا', 'Record your voice to add the words to the description automatically')}</span>
            </div>

            {/* Photo Attachment Section */}
            <div className="rw-field">
              <div className="rw-photo-header">
                <span className="font-semibold text-sm flex items-center">
                  {text(lang, 'صورة للمشكلة', 'Issue photo')}
                </span>
                {photo && (
                  <span className="rw-photo-attached-badge">
                    <Check size={12} strokeWidth={2.6} />
                    {text(lang, 'تم إرفاق صورة', 'Photo attached')}
                  </span>
                )}
              </div>

              {!photo ? (
                /* Upload & Capture panel when NO photo is selected */
                <div className={`rw-photo-uploader ${photoError ? 'has-error' : ''}`} data-testid="panel-photo-uploader">
                  <div className="rw-photo-uploader-content">
                    <div className="rw-photo-uploader-icon">
                      <ImagePlus size={22} className={photoError ? 'text-red-500' : 'text-[#307190] dark:text-[#93c5fd]'} />
                    </div>
                    <div className="rw-photo-uploader-text">
                      <b>{text(lang, 'أرفق صورة للمشكلة', 'Attach an issue photo')}</b>
                      <p>{text(lang, 'PNG، JPG، JPEG — حتى 12 ميغابايت', 'PNG, JPG, JPEG — up to 12 MB')}</p>
                    </div>
                  </div>
                  <div className="rw-photo-uploader-buttons">
                    <label className="rw-photo-action-btn rw-photo-btn-upload" data-testid="button-upload-photo" title={text(lang, 'رفع صورة من الجهاز', 'Upload from device')}>
                      <ImagePlus size={16} />
                      <span>{text(lang, 'رفع صورة', 'Upload')}</span>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        aria-label={text(lang, 'اختيار صورة من الجهاز', 'Choose a photo from your device')}
                        data-testid="input-upload-photo"
                        onChange={event => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = '';
                          void setPhotoFromFile(file);
                        }}
                      />
                    </label>
                    <label className="rw-photo-action-btn rw-photo-btn-camera" data-testid="button-capture-photo" title={text(lang, 'التقاط صورة بالكاميرا', 'Take photo with camera')}>
                      <Camera size={16} />
                      <span>{text(lang, 'التقاط بالكاميرا', 'Camera')}</span>
                      <input
                        type="file"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        capture="environment"
                        aria-label={text(lang, 'التقاط صورة بالكاميرا', 'Take a photo with camera')}
                        data-testid="input-capture-photo"
                        onChange={event => {
                          const file = event.currentTarget.files?.[0];
                          event.currentTarget.value = '';
                          void setPhotoFromFile(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                /* Sleek preview: Uploader disappears, hover reveals ONLY icons with proper colors */
                <div className="rw-photo-preview-centered">
                  <div className="rw-photo-hover-card" data-testid="preview-report-photo">
                    <img
                      src={photo}
                      alt={text(lang, 'معاينة صورة المشكلة', 'Issue photo preview')}
                      className="rw-photo-img"
                    />
                    <div className="rw-photo-overlay" aria-label={text(lang, 'خيارات الصورة', 'Photo options')}>
                      <div className="rw-photo-overlay-actions">
                        <label
                          className="rw-photo-icon-btn rw-photo-icon-replace"
                          title={text(lang, 'تبديل الصورة', 'Replace photo')}
                          aria-label={text(lang, 'تبديل الصورة', 'Replace photo')}
                          data-testid="button-replace-photo"
                        >
                          <RefreshCw size={17} strokeWidth={2.2} />
                          <input
                            type="file"
                            accept="image/*"
                            aria-label={text(lang, 'تبديل الصورة', 'Replace photo')}
                            onChange={event => {
                              const file = event.currentTarget.files?.[0];
                              event.currentTarget.value = '';
                              void setPhotoFromFile(file);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="rw-photo-icon-btn rw-photo-icon-delete"
                          title={text(lang, 'حذف الصورة', 'Delete photo')}
                          aria-label={text(lang, 'حذف الصورة', 'Delete photo')}
                          onClick={() => { setPhoto(''); setPhotoError(''); }}
                          data-testid="button-remove-photo"
                        >
                          <Trash2 size={17} strokeWidth={2.2} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {photoError && <p className="rw-inline-error" role="alert" data-testid="status-photo-error">{photoError}</p>}
            </div>

            {analyze.isError && (
              <p className="rw-inline-error" role="alert" data-testid="status-analyze-error">
                {text(lang, 'تعذر تجهيز الاقتراحات. راجع الوصف وحاول مجدداً.', 'Could not prepare suggestions. Check the description and try again.')}
              </p>
            )}

            {/* Action to proceed to AI analysis */}
            <div className="rw-form-actions rw-compose-actions">
              <button
                type="submit"
                className="rw-button rw-button-primary"
                disabled={!canUseBranch || isAnalyzing}
                data-testid="button-continue-report"
              >
                {isAnalyzing ? (
                  <span className="rw-busy">
                    <LoaderCircle size={16} className="animate-spin" />
                    {text(lang, 'جارٍ تحليل البلاغ...', 'Analyzing your report...')}
                  </span>
                ) : (
                  <>
                    <Sparkles size={16} className="text-white" />
                    {text(lang, 'تحليل البلاغ', 'Analyze report')}
                    {nextIcon}
                  </>
                )}
              </button>
            </div>
          </form>
        </Step>

        {/* STEP 2: Intelligent Analysis & Clarification */}
        <Step
          title={text(lang, 'تحليل وتجهيز', 'Analyze & prepare')}
          description={text(lang, 'تحديد التخصص والأولوية', 'Specialization & priority')}
        >
          {isAnalyzing ? (
            <div
              className="rw-analysis-stage"
              data-testid="status-ai-analyzing"
            >
              <div className="rw-ai-orb-wrap">
                <div className="rw-ai-orb-pulse" />
                <div className="rw-ai-orb">
                  <Sparkles className="h-8 w-8 text-[#307190] dark:text-[#93c5fd] animate-pulse" />
                </div>
              </div>
              <div className="rw-ai-heading">
                <h3>{text(lang, 'تدارك يجهّز بلاغك بالذكاء الاصطناعي...', 'TADARUK AI is preparing your report...')}</h3>
                <p>
                  {text(
                    lang,
                    'نقوم الآن بتحليل الوصف، تصنيف العطل، تحديد مستوى الأولوية واقتراح التخصص المناسب للفني.',
                    'Analyzing description, categorizing issue, setting priority and determining technician specialization.',
                  )}
                </p>
              </div>

              <div className="rw-ai-steps">
                {[
                  { step: 1, ar: 'فهم المشكلة وقراءة الملاحظات', en: 'Understanding the problem' },
                  { step: 2, ar: 'تحديد نوع العطل والتصنيف الفني', en: 'Identifying failure type' },
                  { step: 3, ar: 'تجهيز التذكرة وتحديد الأولوية', en: 'Preparing the ticket' },
                ].map(item => {
                  const isDone = aiStage > item.step;
                  const isActive = aiStage === item.step;
                  return (
                    <div key={item.step} className={`rw-ai-step ${isDone ? 'is-done' : ''} ${isActive ? 'is-active' : ''}`}>
                      <span className="rw-ai-step-indicator">
                        {isDone ? (
                          <Check size={14} className="text-white" />
                        ) : isActive ? (
                          <LoaderCircle size={14} className="animate-spin text-[#307190] dark:text-[#93c5fd]" />
                        ) : (
                          item.step
                        )}
                      </span>
                      <span className="rw-ai-step-text">{text(lang, item.ar, item.en)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : needsLocation ? (
            <form
              onSubmit={handleClarify}
              data-testid="form-report-location"
            >
              <div className="rw-clarify-card">
                <div className="rw-clarify-badge">
                  <MapPin size={15} />
                  <span>{text(lang, 'تحديد موقع العطل', 'SPECIFY LOCATION')}</span>
                </div>
                <h2>{text(lang, 'وين مكان العطل داخل الفرع؟', 'Where is the issue located in the branch?')}</h2>
                <p>
                  {text(
                    lang,
                    'هذه المعلومة فقط لتوجيه الفني مباشرة إلى المكان المناسب داخل الفرع.',
                    'One quick detail so the technician heads directly to the right location.',
                  )}
                </p>

                <div className="rw-choices">
                  {locationChoices.map(choice => (
                    <button
                      key={choice}
                      type="button"
                      className={`rw-chip ${selectedLocation === choice ? 'is-selected' : ''}`}
                      onClick={() => setSelectedLocation(choice)}
                      data-testid={`button-location-${choice === 'مكان آخر' ? 'other' : locationChoices.indexOf(choice)}`}
                    >
                      {text(lang, choice, ({ 'المطبخ': 'Kitchen', 'صالة العملاء': 'Customer area', 'المستودع': 'Storage', 'دورات المياه': 'Restrooms', 'مكان آخر': 'Somewhere else' } as Record<string, string>)[choice])}
                    </button>
                  ))}
                </div>

                {selectedLocation === 'مكان آخر' && (
                  <label className="rw-field mt-3">
                    <span>{text(lang, 'اكتب الموقع', 'Enter location')}</span>
                    <input
                      autoFocus
                      required
                      value={otherLocation}
                      onChange={event => setOtherLocation(event.currentTarget.value)}
                      placeholder={text(lang, 'مثال: غرفة الموظفين / خلف منطقة الكاشير', 'Example: Staff room / behind cashier')}
                      data-testid="input-custom-location"
                    />
                  </label>
                )}
              </div>

              {analyze.isError && (
                <p className="rw-inline-error" role="alert" data-testid="status-location-error">
                  {text(lang, 'تعذر تجهيز الاقتراحات. حاول مرة أخرى.', 'Could not prepare suggestions. Please try again.')}
                </p>
              )}

              <div className="rw-form-actions">
                <button
                  type="submit"
                  className="rw-button rw-button-primary"
                  disabled={!clarificationValue || analyze.isPending}
                  data-testid="button-confirm-location"
                >
                  {analyze.isPending ? (
                    <span className="rw-busy">
                      <LoaderCircle size={16} className="animate-spin" />
                      {text(lang, 'جارٍ التجهيز...', 'Preparing...')}
                    </span>
                  ) : (
                    <>
                      {text(lang, 'متابعة إلى مراجعة البلاغ', 'Continue to review')}
                      {nextIcon}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="rw-button rw-button-quiet"
                  onClick={backToCompose}
                  data-testid="button-back-description"
                >
                  {lang === 'ar' ? <ArrowUpRight size={15}/> : <ArrowUpLeft size={15}/>}
                  {text(lang, 'العودة للوصف', 'Back to description')}
                </button>
              </div>
            </form>
          ) : (
            <div className="rw-context text-center p-8">
              <p className="text-sm text-slate-500">
                {text(lang, 'جاهز للتحليل. ارجع للخطوة السابقة لبدء المعالجة الذكية.', 'Ready to analyze. Return to previous step to start AI processing.')}
              </p>
            </div>
          )}
        </Step>

        {/* STEP 3: Beautiful Generated Ticket Preview & Dispatch */}
        <Step
          title={text(lang, 'مراجعة وتأكيد', 'Review & confirm')}
          description={text(lang, 'اعتماد البلاغ والإرسال', 'Review details and dispatch')}
        >
          {analysis ? (
            <form
              onSubmit={submitReview}
              data-testid="form-report-review"
            >
              <div className="rw-ticket-preview-card" data-testid="card-review-ticket">
              <div className="rw-review-ready-head rw-review-ready-head--reference">
                <div>
                  <h2>{text(lang, 'مراجعة وتأكيد البلاغ', 'Review and confirm report')}</h2>
                  <p>{text(lang, 'تحقق من تفاصيل البلاغ قبل إرساله', 'Review the report details before submitting')}</p>
                </div>
              </div>

              {!reviewEditing ? (
                <>
                  <section className="rw-review-hero rw-review-hero--reference" aria-label={text(lang, 'ملخص البلاغ', 'Report summary')}>
                    <div className="rw-review-hero-top">
                      <span className="rw-review-ai-label"><Sparkles size={17}/>{text(lang, 'ملخص البلاغ بالذكاء الاصطناعي', 'AI prepared report')}</span>
                      <span className="rw-review-ready-badge"><Check size={15}/>{text(lang, 'جاهز للإرسال', 'Ready to send')}</span>
                    </div>
                    <h3 data-testid="text-generated-title">{title}</h3>
                    {previewPreparedAt && (
                      <div className="rw-review-created-row" data-testid="preview-prepared-at">
                        <span><CalendarDays size={15}/>{text(lang, 'تاريخ إعداد البلاغ', 'Draft date')}:
                          <time dateTime={previewPreparedAt.toISOString()}>
                            {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US',{day:'numeric',month:'long',year:'numeric'}).format(previewPreparedAt)}
                          </time>
                        </span>
                        <span><Clock3 size={15}/>{text(lang, 'الوقت', 'Time')}:
                          <time dateTime={previewPreparedAt.toISOString()}>
                            {new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US',{hour:'numeric',minute:'2-digit'}).format(previewPreparedAt)}
                          </time>
                        </span>
                      </div>
                    )}
                  </section>

                  <div className="rw-review-facts rw-review-facts--reference" aria-label={text(lang, 'بيانات البلاغ', 'Report information')}>
                    <div className="rw-review-fact"><span><Building2 size={16}/>{text(lang, 'الفرع', 'Branch')}</span><strong data-testid="text-preview-branch">{selectedBranch?.name || text(lang, 'غير محدد', 'Not specified')}</strong></div>
                    <div className="rw-review-fact"><span><MapPin size={16}/>{text(lang, 'الموقع داخل الفرع', 'Location')}</span><strong>{reviewLocation || text(lang, 'غير محدد', 'Not specified')}</strong></div>
                    <div className="rw-review-fact"><span><ClipboardList size={16}/>{text(lang, 'تصنيف العطل', 'Category')}</span><strong>{classificationLabel(category, lang)}</strong></div>
                    <div className="rw-review-fact"><span><Wrench size={16}/>{text(lang, 'التخصص المطلوب', 'Specialty')}</span><strong>{classificationLabel(specialization, lang)}</strong></div>
                    <div className="rw-review-fact rw-review-priority"><span><CircleAlert size={16}/>{text(lang, 'الأولوية', 'Priority')}</span><span className={`rw-priority-badge rw-priority-${priority}`} data-testid="badge-preview-priority">{priorityLabel(priority, lang)}</span></div>
                  </div>

                  <section className="rw-review-description-card" aria-label={text(lang, 'وصف البلاغ', 'Report description')}>
                    <h4><FileText size={17}/>{text(lang, 'وصف البلاغ', 'Report description')}</h4>
                    <p data-testid="text-generated-description">{reviewDescription}</p>
                  </section>
                </>
              ) : (
                /* Inline Edit Mode */
                <div className="rw-edit-container">
                  <div className="rw-editing-note">
                    <RotateCcw size={15} />
                    {text(lang, 'عدّل الاقتراحات بحرية، ثم ارجع للمعاينة قبل الإرسال.', 'Adjust suggestions freely, then return to preview.')}
                  </div>
                  <label className="rw-field">
                    <span>{text(lang, 'عنوان البلاغ', 'Report title')}</span>
                    <input
                      required
                      minLength={3}
                      value={title}
                      placeholder={text(lang, 'مثال: تسرب مياه أسفل حوض التحضير', 'Example: Water leak beneath prep sink')}
                      onChange={event => setTitle(event.currentTarget.value)}
                      data-testid="input-review-title"
                    />
                  </label>
                  <label className="rw-field rw-preview-description">
                    <span>{text(lang, 'وصف المشكلة المنظم', 'Structured issue description')}</span>
                    <textarea
                      required
                      minLength={4}
                      value={reviewDescription}
                      onChange={event => setReviewDescription(event.currentTarget.value)}
                      data-testid="input-review-description"
                    />
                  </label>
                  <div className="rw-review-grid">
                    <div className="rw-field">
                      <span>{text(lang, 'الفئة', 'Category')}</span>
                      <TadarukSelect
                        required
                        value={category}
                        onValueChange={setCategory}
                        ariaLabel={text(lang, 'الفئة', 'Category')}
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        placeholder={text(lang, 'اختر الفئة', 'Choose a category')}
                        testId="input-review-category"
                        options={[
                          ...(category && !classificationOptions.some(([value]) => value === category) ? [{ value: category, label: category }] : []),
                          ...classificationOptions.map(([value, ar, en]) => ({ value, label: text(lang, ar, en) })),
                        ]}
                      />
                    </div>
                    <div className="rw-field">
                      <span>{text(lang, 'الأولوية', 'Priority')}</span>
                      <TadarukSelect
                        value={priority}
                        onValueChange={value => setPriority(value as TicketPriority)}
                        ariaLabel={text(lang, 'الأولوية', 'Priority')}
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        testId="select-review-priority"
                        options={[
                          { value: 'urgent', label: priorityLabel('urgent', lang) },
                          { value: 'high', label: priorityLabel('high', lang) },
                          { value: 'medium', label: priorityLabel('medium', lang) },
                          { value: 'low', label: priorityLabel('low', lang) },
                        ]}
                      />
                    </div>
                    <div className="rw-field">
                      <span>{text(lang, 'التخصص المطلوب', 'Specialization')}</span>
                      <TadarukSelect
                        required
                        value={specialization}
                        onValueChange={setSpecialization}
                        ariaLabel={text(lang, 'التخصص', 'Specialization')}
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        placeholder={text(lang, 'اختر التخصص', 'Choose a specialization')}
                        testId="input-review-specialization"
                        options={[
                          ...(specialization && !classificationOptions.some(([value]) => value === specialization) ? [{ value: specialization, label: classificationLabel(specialization, lang) }] : []),
                          ...classificationOptions.map(([value, ar, en]) => ({ value, label: text(lang, ar, en) })),
                        ]}
                      />
                    </div>
                    <label className="rw-field">
                      <span>{text(lang, 'الموقع داخل الفرع', 'Location in branch')}</span>
                      <input
                        required
                        value={reviewLocation}
                        placeholder={text(lang, 'مثال: بجانب حوض التحضير', 'Example: beside the prep sink')}
                        onChange={event => setReviewLocation(event.currentTarget.value)}
                        data-testid="input-review-location"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Photo preview in review */}
              {photo ? (
                <div className="rw-review-photo-block rw-review-photo-block--reference" data-testid="preview-review-photo">
                  <span className="rw-preview-label rw-review-attachment-label">
                    <ImagePlus size={17}/>
                    {text(lang, 'المرفقات (1)', 'Attachments (1)')}
                  </span>
                  <div className="rw-photo-preview-centered">
                    <div className="rw-photo-hover-card" style={{ maxWidth: '440px', marginTop: '8px' }}>
                      <img
                        src={photo}
                        alt={text(lang, 'الصورة المرفقة بالبلاغ', 'Photo attached to report')}
                        className="rw-photo-img"
                      />
                      <div className="rw-photo-overlay" aria-label={text(lang, 'خيارات الصورة', 'Photo options')}>
                        <div className="rw-photo-overlay-actions">
                          <label
                            className="rw-photo-icon-btn rw-photo-icon-replace"
                            title={text(lang, 'تبديل الصورة', 'Replace photo')}
                            aria-label={text(lang, 'تبديل الصورة', 'Replace photo')}
                            data-testid="button-replace-review-photo"
                          >
                            <RefreshCw size={17} strokeWidth={2.2} />
                            <input
                              type="file"
                              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                              aria-label={text(lang, 'تبديل الصورة', 'Replace photo')}
                              onChange={event => {
                                const file = event.currentTarget.files?.[0];
                                event.currentTarget.value = '';
                                void setPhotoFromFile(file);
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className="rw-photo-icon-btn rw-photo-icon-delete"
                            title={text(lang, 'حذف الصورة', 'Delete photo')}
                            aria-label={text(lang, 'حذف الصورة', 'Delete photo')}
                            onClick={() => { setPhoto(''); setPhotoError(text(lang, 'الصورة إلزامية — يرجى إرفاق صورة بديلة قبل تأكيد البلاغ.', 'Photo is required — please attach an alternative photo before confirming.')); }}
                            data-testid="button-remove-review-photo"
                          >
                            <Trash2 size={17} strokeWidth={2.2} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rw-review-photo-block rw-review-photo-missing" data-testid="preview-review-photo-missing">
                  <span className="rw-preview-label flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold">
                    {text(lang, 'صورة المشكلة (إلزامية)', 'ISSUE PHOTO (REQUIRED)')}
                    <span className="rw-field-required-badge">{text(lang, 'مطلوبة', 'Required')}</span>
                  </span>
                  <div className="rw-photo-uploader has-error mt-2">
                    <div className="rw-photo-uploader-content">
                      <div className="rw-photo-uploader-icon">
                        <ImagePlus size={22} className="text-red-500" />
                      </div>
                      <div className="rw-photo-uploader-text">
                        <b>{text(lang, 'يرجى إرفاق صورة للمشكلة', 'Please attach an issue photo')}</b>
                        <p>{text(lang, 'الصورة إلزامية لتوثيق البلاغ وإرساله للفني.', 'A photo is required to document the issue for the technician.')}</p>
                      </div>
                    </div>
                    <div className="rw-photo-uploader-buttons">
                      <label className="rw-photo-action-btn rw-photo-btn-upload">
                        <ImagePlus size={16} />
                        <span>{text(lang, 'رفع صورة', 'Upload')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={event => {
                            const file = event.currentTarget.files?.[0];
                            event.currentTarget.value = '';
                            void setPhotoFromFile(file);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}
              {photoError && <p className="rw-inline-error" role="alert" data-testid="status-photo-storage-error">{photoError}</p>}
            </div>

            {create.isError && (
              <p className="rw-inline-error" role="alert" data-testid="status-create-error">
                {text(lang, 'لم يُرسل البلاغ. يمكنك المحاولة مرة أخرى.', 'The report was not sent. You can try again.')}
              </p>
            )}

            <div className="rw-form-actions">
              <button
                type="submit"
                className="rw-button rw-button-primary rw-review-send-btn"
                disabled={!canUseBranch || create.isPending || !title.trim() || !reviewLocation.trim()}
                data-testid="button-submit-report"
              >
                {create.isPending ? (
                  <span className="rw-busy">
                    <LoaderCircle size={16} className="animate-spin" />
                    {text(lang, 'جارٍ إرسال البلاغ...', 'Sending report...')}
                  </span>
                ) : (
                  <>
                    {text(lang, 'إرسال البلاغ', 'Send report')}
                    <Send size={16}/>
                  </>
                )}
              </button>
              {!reviewEditing ? (
                <button
                  type="button"
                  className="rw-button rw-button-secondary rw-review-edit-btn"
                  onClick={() => setReviewEditing(true)}
                  disabled={create.isPending}
                  data-testid="button-edit-report"
                >
                  {text(lang, 'تعديل', 'Edit')}
                </button>
              ) : (
                <button
                  type="button"
                  className="rw-button rw-button-quiet"
                  onClick={returnToPreview}
                  disabled={create.isPending}
                  data-testid="button-return-preview"
                >
                  {text(lang, 'العودة للمعاينة', 'Return to preview')}
                </button>
              )}
              <small>{text(lang, 'بالإرسال، سيصل البلاغ مباشرة للفني المختص.', 'Upon submission, the ticket will be assigned to the technician.')}</small>
            </div>
          </form>
          ) : (
            <div className="rw-context text-center p-8">
              <p className="text-sm text-slate-500">
                {text(lang, 'أكمل وصف المشكلة أولاً لمراجعة تفاصيل البلاغ هنا.', 'Complete the issue description first to review ticket details here.')}
              </p>
            </div>
          )}
        </Step>
      </Stepper>
    </div>
  );
}
