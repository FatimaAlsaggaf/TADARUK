import { motion, useReducedMotion } from "framer-motion";
import { Activity, CheckCircle2, ClipboardList, Wrench } from "lucide-react";
import "./_group.css";

type Variant = "current" | "refined";

export function WorkflowDiagram({ variant }: { variant: Variant }) {
  const reduced = useReducedMotion() === true;
  const progress = 3;
  const refined = variant === "refined";
  const labels = ["بلاغ جديد", "تحليل ذكي", "إسناد للفني", "تم الإصلاح"];
  const icons = [ClipboardList, Activity, Wrench, CheckCircle2];
  const desktopPath = refined
    ? "M55 126 C185 126 176 42 315 45 S445 178 575 132 S748 82 810 104 S870 112 905 106"
    : "M55 126 C185 126 176 42 315 45 S445 178 575 132 S748 82 810 104 S850 112 885 106";
  const mobilePath = refined
    ? "M37 33 C37 80 14 121 37 172 S60 258 37 310 S14 376 37 449"
    : "M33 33 C33 82 9 124 33 172 S57 258 33 310 S9 376 33 449";
  return (
    <main className={`workflow-preview landing workflow-${variant}`} dir="rtl">
      <section className="workflow-reveal wrap" aria-label="مسار البلاغ">
        <motion.div
          className="workflow-heading"
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.48 }}
        >
          <span className="eyebrow">كيف يعمل</span>
          <h2>من البلاغ إلى الإصلاح</h2>
        </motion.div>
        <div className="roadmap">
          <svg className="roadmap-path roadmap-path-desktop" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`roadmap-gradient-${variant}`} x1="0" x2="1">
                <stop offset="0" stopColor="#1e3263" />
                <stop offset=".52" stopColor="#4d9aa8" />
                <stop offset="1" stopColor="#56c9c4" />
              </linearGradient>
            </defs>
            <motion.path
              className="roadmap-track"
              d={desktopPath}
              pathLength="1"
              initial={{ pathLength: 1 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0 }}
              style={{ stroke: `url(#roadmap-gradient-${variant})` }}
            />
            <motion.path
              className="roadmap-glint"
              d={desktopPath}
              pathLength="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 0 }}
            />
          </svg>
          <svg className="roadmap-path roadmap-path-mobile" viewBox="0 0 80 520" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`roadmap-gradient-mobile-${variant}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#1e3263" />
                <stop offset=".52" stopColor="#4d9aa8" />
                <stop offset="1" stopColor="#56c9c4" />
              </linearGradient>
            </defs>
            <motion.path
              className="roadmap-track"
              d={mobilePath}
              pathLength="1"
              initial={{ pathLength: 1 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0 }}
              style={{ stroke: `url(#roadmap-gradient-mobile-${variant})` }}
            />
            <motion.path
              className="roadmap-glint"
              d={mobilePath}
              pathLength="1"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 0 }}
            />
          </svg>
          <div className="workflow-steps">
            {labels.map((label, index) => {
              const StepIcon = icons[index];
              return (
                <motion.div
                  className={`workflow-step ${progress >= index ? "is-reached" : ""} ${progress === index ? "is-current" : ""}`}
                  key={label}
                  initial={false}
                  animate={progress >= 0 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                  transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : index * 0.13 }}
                >
                  <span className="workflow-node"><StepIcon /></span>
                  <span className="workflow-index">0{index + 1}</span>
                  <span className="workflow-label">{label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
