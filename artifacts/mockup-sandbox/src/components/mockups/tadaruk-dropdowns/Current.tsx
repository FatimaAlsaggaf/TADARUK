import { Filter } from 'lucide-react';
import './_group.css';

export function Current() {
  return (
    <main className="dropdown-extract" dir="rtl">
      <section className="dropdown-extract-card">
        <span className="dropdown-extract-kicker">TADARUK · CURRENT</span>
        <h2>تصفية البلاغات</h2>
        <p>هذا هو حقل القائمة الحالي في سجل البلاغات.</p>
        <label className="dropdown-extract-filter">
          <Filter size={16} aria-hidden="true" />
          <select defaultValue="all" aria-label="تصفية البلاغات حسب الحالة">
            <option value="all">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="review">قيد المراجعة</option>
            <option value="progress">جاري العمل</option>
            <option value="closed">مغلق</option>
          </select>
        </label>
      </section>
    </main>
  );
}
