import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, Camera, Check, CheckCircle2,
  ChevronLeft, ChevronRight, CircleAlert, ClipboardList, Clock3, ImagePlus,
  LoaderCircle, MapPin, Plus, RotateCcw, Search, Send, ShieldCheck, Sparkles,
  Trash2, UserRound, Wrench, X
} from 'lucide-react';
import {
  getGetOverviewQueryKey, getListTicketsQueryKey, useCreateTicket, useListReporterBranches,
  useGetOverview, useListTickets,
  type DemoUser, type ReporterBranch, type Ticket, type TicketAnalysis, type TicketInput, type TicketPriority
} from '@workspace/api-client-react';
import { AiVoiceInput } from '@/components/ui/ai-voice-input';
import { TicketCancellationAction } from '@/components/TicketCancellationAction';
import { ticketAnalysisAdapter, type TicketAnalysisRequest } from '@/services/ticket-analysis';
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
    urgent: ['طارئ', 'Urgent'], high: ['عالٍ', 'High'],
    medium: ['متوسط', 'Medium'], low: ['منخفض', 'Low']
  };
  return labels[priority]?.[lang === 'ar' ? 0 : 1] ?? priority;
};
const priorityClass = (priority: string) => `rw-priority rw-priority-${priority}`;
const missingLocation = 'يحدد داخل الفرع';
const locationChoices = ['المطبخ', 'صالة العملاء', 'المستودع', 'دورات المياه', 'مكان آخر'];
const classificationOptions: Array<[string, string, string]> = [
  ['cooling', 'تكييف وتبريد', 'Cooling'],
  ['electrical', 'كهرباء وإنارة', 'Electrical'],
  ['plumbing', 'سباكة ومياه', 'Plumbing'],
  ['general', 'صيانة عامة', 'General maintenance'],
];
const classificationLabel = (value: string, lang: ReporterLang) =>
  classificationOptions.find(([key]) => key === value)?.[lang === 'ar' ? 1 : 2] ?? value;

function ReporterHeading({ eyebrow, title, description, action, lang }: {
  eyebrow: string; title: string; description: string; action?: ReactNode; lang: ReporterLang;
}) {
  return <div className="rw-heading">
    <div>
      <div className="rw-kicker">{eyebrow}</div>
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
      return <div className="rw-ticket-entry" key={ticket.id}>
        <Link
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
        {ticket.status === 'new' && <TicketCancellationAction ticketId={ticket.id} ticketNumber={ticket.number} lang={lang}/>}
      </div>;
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
  const rows = tickets ?? [];
  const openCount = rows.filter(ticket => ticket.status !== 'closed').length;
  const waitingCount = rows.filter(ticket => ticket.status === 'awaiting_confirmation').length;
  const resolvedCount = overview?.resolvedThisMonth ?? rows.filter(ticket => ticket.status === 'closed').length;
  const loading = isLoading || overviewLoading;
  const failed = isError || overviewError;
  const retry = () => { void refetch(); void refetchOverview(); };

  return <div className="reporter-view" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <ReporterHeading
      eyebrow={text(lang, 'مساحة العمل · المبلّغ', 'YOUR WORKSPACE · REPORTER')}
      title={text(lang, `أهلاً ${user.name.split(' ')[0]}`, `Hello, ${user.name.split(' ')[0]}`)}
      description={text(lang, 'أرسل ما يحتاج إلى إصلاح، وتابع كل خطوة حتى يعود المكان للعمل.', 'Tell us what needs fixing, then follow each step until it is resolved.')}
      lang={lang}
      action={<Link href="/workspace/tickets/new" className="rw-button" data-testid="link-create-report"><Plus size={17}/>{text(lang, 'بلاغ جديد', 'New report')}</Link>}
    />
    <section className="rw-home-intro" aria-label={text(lang, 'بدء بلاغ صيانة', 'Start a maintenance report')}>
      <div className="rw-home-copy">
        <div className="rw-kicker">{text(lang, 'صيانة أوضح، بخطوة بسيطة', 'A clearer repair, one simple step')}</div>
        <h2>{text(lang, 'ما الذي يحتاج إلى عناية في فرعك؟', 'What needs attention at your branch?')}</h2>
        <p>{text(lang, 'اكتب ما لاحظته بلغتك. سنرتب البلاغ ونبقيك على اطلاع بحالته.', 'Describe what you noticed in your own words. We will organize the report and keep you updated.')}</p>
        <Link href="/workspace/tickets/new" className="rw-button" data-testid="link-start-report">
          {text(lang, 'أخبرنا بالمشكلة', 'Tell us about it')}
          {lang === 'ar' ? <ArrowLeft size={16}/> : <ArrowRight size={16}/>}
        </Link>
      </div>
      <div className="rw-home-symbol" aria-hidden="true"><Wrench size={34}/></div>
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
          <div><div className="rw-kicker">{text(lang, 'متابعتك', 'YOUR FOLLOW-UP')}</div><h2>{text(lang, 'آخر بلاغاتك', 'Your recent reports')}</h2></div>
          <Link href="/workspace/tickets" className="rw-link" data-testid="link-all-reports">{text(lang, 'عرض الكل', 'View all')}{lang === 'ar' ? <ArrowLeft size={15}/> : <ArrowRight size={15}/>}</Link>
        </div>
        <ReporterTicketRows tickets={rows.slice(0, 5)} lang={lang}
          emptyTitle={text(lang, 'لم ترسل بلاغاً بعد', 'No reports yet')}
          emptyDescription={text(lang, 'عندما تلاحظ شيئاً يحتاج إلى إصلاح، ابدأ ببلاغك الأول هنا.', 'When you notice something that needs fixing, start your first report here.')}/>
      </section>
    </>}
  </div>;
}

export function ReporterTicketsPage({ lang }: ReporterPageProps) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const params = useMemo(() => ({ search: search.trim() || undefined, status: status || undefined }), [search, status]);
  const { data: tickets, isLoading, isError, refetch } = useListTickets(params);
  const shown = tickets ?? [];
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
      <label className="rw-filter" aria-label={text(lang, 'تصفية حسب الحالة', 'Filter by status')}>
        <select value={status} onChange={event => setStatus(event.currentTarget.value)} data-testid="select-ticket-status">
          <option value="">{text(lang, 'كل الحالات', 'All statuses')}</option>
          <option value="new">{statusLabel('new', lang)}</option>
          <option value="review">{statusLabel('review', lang)}</option>
          <option value="in_progress">{statusLabel('in_progress', lang)}</option>
          <option value="awaiting_confirmation">{statusLabel('awaiting_confirmation', lang)}</option>
          <option value="closed">{statusLabel('closed', lang)}</option>
        </select>
      </label>
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
  if (!file.type.startsWith('image/')) {
    throw new Error(text(lang, 'اختر ملف صورة صالحاً.', 'Choose a valid image file.'));
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error(text(lang, 'حجم الصورة أكبر من ١٢ ميغابايت.', 'The image is larger than 12 MB.'));
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(text(lang, 'تعذر قراءة هذا النوع من الصور. جرّب صورة JPG أو PNG.', 'This image format could not be read. Try a JPG or PNG image.'));
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
  const allowedBranches = useMemo(() => reporterBranches ?? [], [reporterBranches]);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [otherLocation, setOtherLocation] = useState('');
  const [needsLocation, setNeedsLocation] = useState(false);
  const [locationWasClarified, setLocationWasClarified] = useState(false);
  const [photo, setPhoto] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [needsDescription, setNeedsDescription] = useState(false);
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
  const reduced = useReducedMotion() === true;
  const analyze = useMutation({
    mutationFn: (input: TicketAnalysisRequest) => ticketAnalysisAdapter.analyze(input),
  });
  const create = useCreateTicket();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const clarificationValue = selectedLocation === 'مكان آخر' ? otherLocation.trim() : selectedLocation;
  const effectiveBranchId = allowedBranches.find(branch => branch.id === selectedBranchId)?.id
    ?? allowedBranches.find(branch => branch.id === user.branchId)?.id
    ?? allowedBranches[0]?.id
    ?? '';
  const selectedBranch = allowedBranches.find(branch => branch.id === effectiveBranchId);
  const canUseBranch = !branchesLoading && !branchesError && Boolean(selectedBranch);

  const renderBranchChoice = () => {
    if (branchesLoading) return <p className="rw-branch-note" role="status" data-testid="status-branches-loading">
      <LoaderCircle size={15}/>{text(lang, 'جارٍ تحميل الفروع المسموح بها...', 'Loading your authorized branches...')}
    </p>;
    if (branchesError) return <div className="rw-inline-error" role="alert" data-testid="status-branches-error">
      <span>{text(lang, 'تعذر تحميل الفروع المسموح بها. أعد المحاولة قبل متابعة البلاغ.', 'Could not load your authorized branches. Retry before continuing.')}</span>
      <button type="button" className="rw-text-button" onClick={() => void refetchBranches()} data-testid="button-retry-branches"><RotateCcw size={14}/>{text(lang, 'إعادة المحاولة', 'Try again')}</button>
    </div>;
    if (!allowedBranches.length) return <p className="rw-inline-error" role="alert" data-testid="status-no-authorized-branches">
      {text(lang, 'لا يوجد لديك فرع مسموح به حالياً. اطلب من مديرك إسناد فرع قبل إنشاء البلاغ.', 'You do not have an authorized branch yet. Ask your manager to assign one before creating a report.')}
    </p>;
    return <div className="rw-branch-note" data-testid="text-selected-branch">
      <MapPin size={15}/>{text(lang, 'الفرع المحدد', 'Selected branch')}: {selectedBranch?.name}
      {selectedBranch?.city ? ` · ${selectedBranch.city}` : ''}
      {allowedBranches.length > 1 && <small>{text(lang, 'يمكن تغييره من الشريط الجانبي', 'Change it in the sidebar')}</small>}
    </div>;
  };

  const beginReview = (suggestion: TicketAnalysis, preferredLocation = '') => {
    const proposedLocation = suggestion.location === missingLocation ? '' : suggestion.location;
    const finalLocation = preferredLocation || proposedLocation;
    setAnalysis(suggestion);
    setTitle(suggestion.title);
    setReviewDescription(suggestion.description);
    setCategory(suggestion.category);
    setPriority(suggestion.priority as TicketPriority);
    setSpecialization(suggestion.specialization);
    setReviewLocation(finalLocation);
    setNeedsLocation(false);
  };
  const handleAnalyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const rawDescription = description.trim();
    if (rawDescription.length < 4) {
      if (!rawDescription && photo) setNeedsDescription(true);
      else setDescriptionError(text(lang, 'اكتب وصفاً من أربع كلمات على الأقل أو سجّل وصفاً صوتياً.', 'Enter at least four characters or record a voice description.'));
      return;
    }
    setNeedsDescription(false);
    setDescriptionError('');
    const suppliedLocation = location.trim();
    analyze.mutate({ description: rawDescription, locale: lang, ...(suppliedLocation ? { location: suppliedLocation } : {}) }, {
      onSuccess: suggestion => {
        if ((suggestion.needsClarification || !suggestion.location || suggestion.location === missingLocation) && !suppliedLocation) {
          setSelectedLocation('');
          setOtherLocation('');
          setLocationWasClarified(true);
          setNeedsLocation(true);
          setAnalysis(suggestion);
          return;
        }
        beginReview(suggestion, suppliedLocation || suggestion.location);
      }
    });
  };
  const handleClarify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!clarificationValue) return;
    setLocation(clarificationValue);
    analyze.mutate({ description: description.trim(), location: clarificationValue, locale: lang }, {
      onSuccess: suggestion => beginReview(suggestion, clarificationValue)
    });
  };
  const setPhotoFromFile = async (file?: File) => {
    if (!file) return;
    setPhotoError('');
    try { setPhoto(await fileToPreview(file, lang)); }
    catch (error) { setPhotoError(error instanceof Error ? error.message : text(lang, 'تعذر تجهيز الصورة.', 'Could not prepare the image.')); }
  };
  const appendTranscript = (transcript: string) => {
    setNeedsDescription(false);
    setDescriptionError('');
    setDescription(current => current ? `${current.trimEnd()} ${transcript}` : transcript);
  };
  const backToCompose = () => {
    setAnalysis(null);
    setNeedsLocation(false);
    setLocationWasClarified(false);
    if (reviewLocation) setLocation(reviewLocation);
  };
  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          try { localStorage.setItem(`tadaruk-photo:${ticket.id}`, photo); }
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
    const timer = window.setTimeout(() => navigate(`/workspace/tickets/${submittedTicket.id}`), 1700);
    return () => window.clearTimeout(timer);
  }, [submittedTicket, photoSaveFailed, navigate]);
  const totalSteps = locationWasClarified ? 3 : 2;
  const step = analysis ? totalSteps : needsLocation ? 2 : 1;
  const nextIcon = lang === 'ar' ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>;

  return <div className="reporter-view" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <ReporterHeading
      eyebrow={text(lang, 'بلاغ صيانة جديد', 'NEW MAINTENANCE REPORT')}
      title={text(lang, 'خلّنا نعرف ما الذي حدث', 'Tell us what happened')}
      description={text(lang, 'خطوات قليلة، ومراجعة منك قبل إرسال البلاغ.', 'A few simple steps, with your review before anything is sent.')}
      lang={lang}
    />
    <div className="rw-report">
      <div className="rw-progress" aria-label={text(lang, `الخطوة ${step} من ${totalSteps}`, `Step ${step} of ${totalSteps}`)} data-testid="status-report-progress">
        {[1, 2, 3].map(index => <span key={index} className={`rw-progress-dot ${step >= index ? 'is-active' : ''}`} aria-hidden="true"/> )}
        <span>{text(lang, `الخطوة ${step}`, `Step ${step}`)}</span>
      </div>

      {!analysis && !needsLocation && <motion.form
        key="compose"
        initial={reduced ? false : { opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : .2 }}
        onSubmit={handleAnalyze}
        data-testid="form-report-description"
      >
        <div className="rw-report-intro">
          <span className="rw-report-icon"><ClipboardList size={21}/></span>
          <div><h2>{text(lang, 'ما المشكلة التي لاحظتها؟', 'What issue did you notice?')}</h2>
            <p>{text(lang, 'اكتب وصفاً قصيراً كما رأيته. لا حاجة لتحديد الأولوية أو الفني.', 'A short description is enough. No need to choose a priority or technician.')}</p>
          </div>
        </div>
        {renderBranchChoice()}
        <label className="rw-field">
          <span>{text(lang, 'وصف المشكلة', 'Describe the issue')} <span className="rw-field-hint">{text(lang, 'مطلوب', 'Required')}</span></span>
          <textarea ref={descriptionInputRef} minLength={4} value={description} onChange={event => {
            setDescription(event.currentTarget.value);
            setNeedsDescription(false);
            setDescriptionError('');
          }}
            placeholder={text(lang, 'مثال: يوجد تسريب ماء بجانب حوض التحضير...', 'Example: There is a water leak beside the prep sink...')}
            data-testid="input-report-description"/>
        </label>
        <div className="rw-voice"><AiVoiceInput lang={lang} onTranscript={appendTranscript} onManualEntry={() => descriptionInputRef.current?.focus()}/></div>
        {descriptionError && <p className="rw-inline-error" role="alert" data-testid="status-description-error">{descriptionError}</p>}
        {needsDescription && <p className="rw-inline-error" role="alert" data-testid="status-photo-needs-description">
          {text(lang, 'في العرض التجريبي لا يتم تحليل الصور تلقائياً. أضف وصفاً قصيراً للمشكلة أو سجّل وصفاً صوتياً.', 'In this demo, photos are not analyzed automatically. Add a short description of the issue or record a voice description.')}
        </p>}
        <div className="rw-field">
          <span>{text(lang, 'صورة للمشكلة', 'A photo of the issue')} <span className="rw-field-hint">{text(lang, 'اختياري', 'Optional')}</span></span>
          <div className="rw-photo-panel">
            <div className="rw-photo-panel-copy">
              <span><ImagePlus size={20}/></span>
              <div><b>{text(lang, 'أرفق صورة للمشكلة', 'Attach an issue photo')}</b>
                <small>{text(lang, 'اختر صورة أو التقطها بالكاميرا. تبقى في هذا المتصفح.', 'Choose a photo or take one. It stays in this browser.')}</small>
              </div>
            </div>
            <div className="rw-photo-actions">
              <label className="rw-button rw-button-secondary rw-upload" data-testid="button-upload-photo">
                {photo ? <RotateCcw size={16}/> : <ImagePlus size={17}/>}
                {text(lang, photo ? 'استبدال الصورة' : 'رفع صورة', photo ? 'Replace photo' : 'Upload photo')}
                <input type="file" accept="image/*" aria-label={text(lang, 'اختيار صورة من الجهاز', 'Choose a photo from your device')}
                  data-testid="input-upload-photo" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void setPhotoFromFile(file); }}/>
              </label>
              <label className="rw-button rw-button-quiet rw-upload" data-testid="button-capture-photo">
                <Camera size={17}/>{text(lang, 'التقاط صورة', 'Take a photo')}
                <input type="file" accept="image/*" capture="environment" aria-label={text(lang, 'التقاط صورة بالكاميرا', 'Take a photo with camera')}
                  data-testid="input-capture-photo" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void setPhotoFromFile(file); }}/>
              </label>
            </div>
          </div>
          {photo && <div className="rw-photo-preview" data-testid="preview-report-photo">
            <img src={photo} alt={text(lang, 'معاينة صورة المشكلة', 'Issue photo preview')}/>
            <div className="rw-photo-preview-bar"><span>{text(lang, 'معاينة على هذا الجهاز فقط', 'Preview kept on this device only')}</span>
              <button type="button" className="rw-text-button" onClick={() => { setPhoto(''); setPhotoError(''); }} data-testid="button-remove-photo"><Trash2 size={14}/>{text(lang, 'إزالة', 'Remove')}</button>
            </div>
          </div>}
          {photoError && <p className="rw-inline-error" role="alert" data-testid="status-photo-error">{photoError}</p>}
        </div>
        <div className="rw-demo-note"><Sparkles size={15}/><span><b>{text(lang, 'تحليل تجريبي', 'Demo analysis')}</b> — {text(lang, 'اقتراحات ثابتة للتجربة فقط؛ لا يوجد مزود ذكاء اصطناعي متصل. راجع كل التفاصيل قبل الإرسال.', 'Deterministic test suggestions only; no AI provider is connected. Review every detail before sending.')}</span></div>
        {analyze.isError && <p className="rw-inline-error" role="alert" data-testid="status-analyze-error">{text(lang, 'تعذر تجهيز الاقتراحات. راجع الوصف وحاول مجدداً.', 'Could not prepare suggestions. Check the description and try again.')}</p>}
        <div className="rw-form-actions">
          <button type="submit" className="rw-button" disabled={!canUseBranch || (!description.trim() && !photo) || analyze.isPending} data-testid="button-continue-report">
            {analyze.isPending ? <span className="rw-busy"><LoaderCircle size={16}/>{text(lang, 'جارٍ تحليل البلاغ…', 'Analyzing the report…')}</span> : <>{text(lang, 'تحليل البلاغ', 'Analyze report')}{nextIcon}</>}
          </button>
          <small>{text(lang, 'لن يُرسل البلاغ إلا بعد مراجعتك وتأكيدك.', 'Nothing is sent until you review and confirm.')}</small>
        </div>
      </motion.form>}

      {!analysis && needsLocation && <motion.form
        key="clarify"
        initial={reduced ? false : { opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : .2 }}
        onSubmit={handleClarify}
        data-testid="form-report-location"
      >
        <div className="rw-report-intro">
          <span className="rw-report-icon"><MapPin size={21}/></span>
          <div><h2>{text(lang, 'أين داخل الفرع؟', 'Where in the branch?')}</h2>
            <p>{text(lang, 'يساعدنا تحديد المكان على توجيه البلاغ للفريق المناسب.', 'A location helps us direct the report to the right team.')}</p>
          </div>
        </div>
        <div className="rw-context">
          <h3>{text(lang, 'اختر أقرب موقع', 'Choose the closest location')}</h3>
          <p>{text(lang, 'هذه المعلومة فقط هي الناقصة قبل أن نجهز مراجعة البلاغ.', 'This is the only detail missing before we prepare your review.')}</p>
          <div className="rw-choices">
            {locationChoices.map(choice => <button key={choice} type="button" className="rw-chip"
              aria-pressed={selectedLocation === choice} onClick={() => setSelectedLocation(choice)}
              data-testid={`button-location-${choice === 'مكان آخر' ? 'other' : locationChoices.indexOf(choice)}`}>
              {text(lang, choice, ({ 'المطبخ': 'Kitchen', 'صالة العملاء': 'Customer area', 'المستودع': 'Storage', 'دورات المياه': 'Restrooms', 'مكان آخر': 'Somewhere else' } as Record<string, string>)[choice])}
            </button>)}
          </div>
        </div>
        {selectedLocation === 'مكان آخر' && <label className="rw-field">
          <span>{text(lang, 'اكتب الموقع', 'Enter the location')}</span>
          <input autoFocus required value={otherLocation} onChange={event => setOtherLocation(event.currentTarget.value)}
            placeholder={text(lang, 'مثال: غرفة الموظفين', 'Example: staff room')} data-testid="input-custom-location"/>
        </label>}
        {analyze.isError && <p className="rw-inline-error" role="alert" data-testid="status-location-error">{text(lang, 'تعذر تجهيز الاقتراحات. حاول مرة أخرى.', 'Could not prepare suggestions. Please try again.')}</p>}
        <div className="rw-form-actions">
          <button type="submit" className="rw-button" disabled={!clarificationValue || analyze.isPending} data-testid="button-confirm-location">
            {analyze.isPending ? <span className="rw-busy"><LoaderCircle size={16}/>{text(lang, 'جارٍ تجهيز المراجعة', 'Preparing review')}</span> : <>{text(lang, 'متابعة إلى المراجعة', 'Continue to review')}{nextIcon}</>}
          </button>
          <button type="button" className="rw-button rw-button-quiet" onClick={backToCompose} data-testid="button-back-description">
            {lang === 'ar' ? <ArrowUpRight size={15}/> : <ArrowUpLeft size={15}/>}
            {text(lang, 'العودة للوصف', 'Back to description')}
          </button>
        </div>
      </motion.form>}

      {submittedTicket && <div className="rw-submission-result" role="status" data-testid="state-report-sent">
        <span className="rw-report-icon"><CheckCircle2 size={22}/></span>
        <div><h2>{text(lang, 'تم إرسال البلاغ', 'Report sent')}</h2>
          <p>{photoSaveFailed ? photoError : text(lang, `تم تسجيل البلاغ ${submittedTicket.number}. جارٍ فتح تفاصيله.`, `Report ${submittedTicket.number} is saved. Opening its details now.`)}</p>
          <button type="button" className="rw-button" onClick={() => navigate(`/workspace/tickets/${submittedTicket.id}`)} data-testid="button-open-created-report">{text(lang, 'عرض البلاغ', 'Open report')}<ArrowRight size={16}/></button>
        </div>
      </div>}
      {analysis && !submittedTicket && <motion.form
        key="review"
        initial={reduced ? false : { opacity: 0, y: 7 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : .2 }}
        onSubmit={submitReview}
        data-testid="form-report-review"
      >
        <div className="rw-report-intro">
          <span className="rw-report-icon"><CheckCircle2 size={22}/></span>
          <div><h2>{text(lang, 'راجع البلاغ قبل إرساله', 'Review before sending')}</h2>
            <p>{text(lang, 'عدّل ما يلزم. لن يصل البلاغ إلى الفريق حتى تضغط تأكيد وإرسال.', 'Edit anything you need. The team will not receive it until you confirm and send.')}</p>
          </div>
        </div>
        <div className="rw-demo-note"><Sparkles size={15}/><span><b>{text(lang, 'تحليل تجريبي', 'Demo analysis')}</b> — {text(lang, 'اقتراحات ثابتة للتجربة فقط. تحقق من كل حقل وعدّله قبل الإرسال.', 'Deterministic test suggestions only. Review and edit every field before sending.')}</span></div>
        <div className="rw-ticket-preview-card" data-testid="card-review-ticket">
          <header className="rw-ticket-preview-head">
            <div><span>{text(lang, 'معاينة البلاغ', 'REPORT PREVIEW')}</span><b>{text(lang, 'طلب صيانة', 'Maintenance request')}</b></div>
            <span className="rw-preview-status">{text(lang, 'مسودة', 'Draft')}</span>
          </header>
          {renderBranchChoice()}
          <label className="rw-field"><span>{text(lang, 'عنوان البلاغ', 'Report title')}</span>
          <input required minLength={3} value={title} onChange={event => setTitle(event.currentTarget.value)} data-testid="input-review-title"/>
          </label>
          <label className="rw-field rw-preview-description"><span>{text(lang, 'وصف المشكلة', 'Issue description')}</span>
          <textarea required minLength={4} value={reviewDescription} onChange={event => setReviewDescription(event.currentTarget.value)} data-testid="input-review-description"/>
          </label>
          <div className="rw-review-grid">
            <label className="rw-field"><span>{text(lang, 'الفئة', 'Category')}</span>
              <select required value={category} onChange={event => setCategory(event.currentTarget.value)} data-testid="input-review-category">
                {category && !classificationOptions.some(([value]) => value === category) && <option value={category}>{category}</option>}
                {classificationOptions.map(([value, ar, en]) => <option key={value} value={value}>{text(lang, ar, en)}</option>)}
              </select>
            </label>
            <label className="rw-field"><span>{text(lang, 'الأولوية', 'Priority')}</span>
              <select value={priority} onChange={event => setPriority(event.currentTarget.value as TicketPriority)} data-testid="select-review-priority">
                <option value="urgent">{priorityLabel('urgent', lang)}</option>
                <option value="high">{priorityLabel('high', lang)}</option>
                <option value="medium">{priorityLabel('medium', lang)}</option>
                <option value="low">{priorityLabel('low', lang)}</option>
              </select>
            </label>
            <label className="rw-field"><span>{text(lang, 'التخصص', 'Specialization')}</span>
              <select required value={specialization} onChange={event => setSpecialization(event.currentTarget.value)} data-testid="input-review-specialization">
                {specialization && !classificationOptions.some(([value]) => value === specialization) && <option value={specialization}>{classificationLabel(specialization, lang)}</option>}
                {classificationOptions.map(([value, ar, en]) => <option key={value} value={value}>{text(lang, ar, en)}</option>)}
              </select>
            </label>
            <label className="rw-field"><span>{text(lang, 'الموقع داخل الفرع', 'Location in the branch')}</span>
              <input required value={reviewLocation} onChange={event => setReviewLocation(event.currentTarget.value)} data-testid="input-review-location"/>
            </label>
          </div>
          {photo && <div className="rw-photo-preview" data-testid="preview-review-photo">
            <img src={photo} alt={text(lang, 'الصورة المرفقة بالبلاغ', 'Photo attached to the report')}/>
            <div className="rw-photo-preview-bar"><span>{text(lang, 'الصورة ستبقى في هذا المتصفح فقط.', 'This photo stays in this browser only.')}</span>
              <button type="button" className="rw-text-button" onClick={() => setPhoto('')} data-testid="button-remove-review-photo"><X size={14}/>{text(lang, 'إزالة الصورة', 'Remove photo')}</button>
            </div>
          </div>}
          {photoError && <p className="rw-inline-error" role="alert" data-testid="status-photo-storage-error">{photoError}</p>}
        </div>
        {create.isError && <p className="rw-inline-error" role="alert" data-testid="status-create-error">{text(lang, 'لم يُرسل البلاغ. يمكنك المحاولة مرة أخرى.', 'The report was not sent. You can try again.')}</p>}
        <div className="rw-form-actions">
          <button type="submit" className="rw-button" disabled={!canUseBranch || create.isPending || !title.trim() || !reviewLocation.trim()} data-testid="button-submit-report">
            {create.isPending ? <span className="rw-busy"><LoaderCircle size={16}/>{text(lang, 'جارٍ إرسال البلاغ', 'Sending report')}</span> : <>{text(lang, 'إرسال البلاغ', 'Submit report')}<Send size={16}/></>}
          </button>
          <button type="button" className="rw-button rw-button-quiet" onClick={backToCompose} disabled={create.isPending} data-testid="button-edit-report">
            {text(lang, 'تعديل', 'Edit')}
          </button>
          <small>{text(lang, 'بالإرسال، سيظهر البلاغ ضمن بلاغاتك.', 'After sending, this report will appear in My reports.')}</small>
        </div>
      </motion.form>}
    </div>
  </div>;
}
