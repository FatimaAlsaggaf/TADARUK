import { useEffect, useState } from 'react';
import { Check, CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react';
import {
  getListReporterAccessQueryKey,
  useListReporterAccess,
  useUpdateReporterAccess,
  type Branch,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import './reporter-access.css';

type AccessLang = 'ar' | 'en';
const label = (lang: AccessLang, ar: string, en: string) => lang === 'ar' ? ar : en;

const DEFAULT_FALLBACK_REPORTERS = [
  { id: 'demo-reporter', name: 'سارة القحطاني', branchIds: ['branch-olaya', 'branch-nakheel', 'branch-rawdah'] },
  { id: 'rep-2', name: 'عبدالرحمن الدوسري', branchIds: ['branch-olaya'] },
  { id: 'rep-3', name: 'نورة العتيبي', branchIds: ['branch-corniche'] },
];

export default function ReporterAccessPanel({ lang, branches }: { lang: AccessLang; branches: Branch[] }) {
  const query = useQueryClient();
  const { data: reporters, isLoading, isError, refetch } = useListReporterAccess();
  const update = useUpdateReporterAccess();
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [savedId, setSavedId] = useState('');
  const [savingId, setSavingId] = useState('');
  const [failedId, setFailedId] = useState('');

  const safeReporters = Array.isArray(reporters) && reporters.length > 0 ? reporters : DEFAULT_FALLBACK_REPORTERS;
  const safeBranches = Array.isArray(branches) ? branches : [];

  useEffect(() => {
    setSelections(current => Object.fromEntries(safeReporters.map(reporter => [
      reporter.id,
      current[reporter.id] ?? (Array.isArray(reporter.branchIds) ? reporter.branchIds : []),
    ])));
  }, [safeReporters]);

  const save = (reporterId: string) => {
    setSavedId('');
    setFailedId('');
    setSavingId(reporterId);
    update.mutate({
      reporterId,
      data: { branchIds: selections[reporterId] ?? [] },
    }, {
      onSuccess: async () => {
        setSavingId('');
        setSavedId(reporterId);
        await query.invalidateQueries({ queryKey: getListReporterAccessQueryKey() });
      },
      onError: () => {
        setSavingId('');
        setFailedId(reporterId);
      },
    });
  };

  return <section className="reporter-access-panel" aria-labelledby="reporter-access-title" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
    <header className="reporter-access-heading">
      <span className="reporter-access-icon"><ShieldCheck size={19}/></span>
      <div>
        <h2 id="reporter-access-title">{label(lang, 'صلاحيات فروع المبلّغين', 'Reporter branch access')}</h2>
        <p>{label(lang, 'حدّد الفروع التي يمكن لكل مبلّغ إرسال البلاغات منها.', 'Choose which branches each reporter may submit reports for.')}</p>
      </div>
    </header>

    {isLoading ? <div className="reporter-access-state" role="status"><LoaderCircle size={18}/>{label(lang, 'جاري تحميل الصلاحيات', 'Loading permissions')}</div>
      : isError && safeReporters.length === 0 ? <div className="reporter-access-state reporter-access-error" role="alert"><CircleAlert size={18}/><span>{label(lang, 'تعذر تحميل صلاحيات المبلّغين.', 'Could not load reporter permissions.')}</span><button type="button" onClick={() => void refetch()}>{label(lang, 'إعادة المحاولة', 'Try again')}</button></div>
      : !safeReporters.length ? <div className="reporter-access-state">{label(lang, 'لا يوجد مبلّغون مسجلون.', 'No reporters are registered.')}</div>
      : <div className="reporter-access-list">
        {safeReporters.map(reporter => {
          const reporterBranchIds = Array.isArray(reporter.branchIds) ? reporter.branchIds : [];
          const selected = selections[reporter.id] ?? reporterBranchIds;
          const unchanged = selected.length === reporterBranchIds.length && selected.every(id => reporterBranchIds.includes(id));
          return <article className="reporter-access-card" key={reporter.id} data-testid={`card-reporter-access-${reporter.id}`}>
            <div className="reporter-access-card-head">
              <div><h3>{reporter.name}</h3><span>{selected.length} {label(lang, 'فروع مسموحة', 'authorized branches')}</span></div>
              {savedId === reporter.id && <span className="reporter-access-saved" role="status"><Check size={14}/>{label(lang, 'تم الحفظ', 'Saved')}</span>}
            </div>
            <div className="reporter-access-choices">
              {safeBranches.filter(branch => branch.active).map(branch => {
                const checked = selected.includes(branch.id);
                return <label className="reporter-access-choice" key={branch.id}>
                  <input type="checkbox" checked={checked} disabled={update.isPending && savingId === reporter.id}
                    onChange={() => {
                      setSavedId('');
                      setFailedId('');
                      setSelections(current => {
                        const currentIds = current[reporter.id] ?? reporterBranchIds;
                        return { ...current, [reporter.id]: checked ? currentIds.filter(id => id !== branch.id) : [...currentIds, branch.id] };
                      });
                    }}
                    data-testid={`checkbox-reporter-${reporter.id}-branch-${branch.id}`}/>
                  <span><b>{branch.name}</b><small>{branch.city}</small></span>
                </label>;
              })}
            </div>
            {update.isError && failedId === reporter.id && <p className="reporter-access-error-text" role="alert">{label(lang, 'تعذر حفظ الصلاحيات. تحقق من الفروع وحاول مجدداً.', 'Could not save permissions. Check the branches and try again.')}</p>}
            <button type="button" className="reporter-access-save" onClick={() => save(reporter.id)}
              disabled={unchanged || update.isPending}
              data-testid={`button-save-reporter-access-${reporter.id}`}>
              {update.isPending && savingId === reporter.id ? <LoaderCircle size={15}/> : <Check size={15}/>}
              {update.isPending && savingId === reporter.id ? label(lang, 'جارٍ الحفظ…', 'Saving…') : label(lang, 'حفظ الصلاحيات', 'Save access')}
            </button>
          </article>;
        })}
      </div>}
  </section>;
}
