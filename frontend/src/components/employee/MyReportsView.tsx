import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { AuditResult, AuditSection, Reflection } from '../../types';
import { getMyReports, submitReflection } from '../../services/reportsService';
import { formatDate } from '../../utils/dateFormatter';
import { useAuth } from '../../context/AuthContext';
import { scoreTextClass, scoreBgBorderClass, formatScore } from '../../utils/scoreColor';
import confetti from 'canvas-confetti';

interface MyReportsViewProps {
  initialSelected?: AuditResult | null;
}

export const MyReportsView: React.FC<MyReportsViewProps> = ({ initialSelected }) => {
  const { user } = useAuth();
  const [reports, setReports] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditResult | null>(initialSelected ?? null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [reflAnswer1, setReflAnswer1] = useState('');
  const [reflAnswer2, setReflAnswer2] = useState('');
  const [reflSubmitting, setReflSubmitting] = useState(false);
  const [reflError, setReflError] = useState('');
  const [reflections, setReflections] = useState<Record<string, Reflection>>({});

  const periodLabel = (report: AuditResult) =>
    report.quarter && report.year ? `${report.quarter} ${report.year}` : formatDate(report.date);

  const getReflection = (report: AuditResult): Reflection | undefined =>
    reflections[report._id ?? report.id ?? ''] ?? report.reflection;

  const hoursElapsed = (report: AuditResult): number => {
    if (!report.createdAt) return 999;
    return (Date.now() - new Date(report.createdAt).getTime()) / (1000 * 3600);
  };

  const handleSubmitReflection = async () => {
    if (!selected) return;
    if (reflAnswer1.trim().length < 10 || reflAnswer2.trim().length < 10) {
      setReflError('Будь ласка, дайте розгорнуту відповідь (мін. 10 символів)');
      return;
    }
    setReflSubmitting(true);
    setReflError('');
    try {
      const updated = await submitReflection(selected._id ?? selected.id ?? '', reflAnswer1, reflAnswer2);
      setSelected(updated);
      setReflections((prev) => ({ ...prev, [updated._id ?? updated.id ?? '']: updated.reflection! }));
      setShowReflection(false);
      setReflAnswer1('');
      setReflAnswer2('');
    } catch (err) {
      setReflError(err instanceof Error ? err.message : 'Помилка');
    } finally {
      setReflSubmitting(false);
    }
  };

  useEffect(() => {
    getMyReports()
      .then(data => {
        setReports(data);
        if (initialSelected) {
          const initId = initialSelected._id ?? initialSelected.id;
          const fresh = data.find(r => (r._id ?? r.id) === initId);
          if (fresh) setSelected(fresh);
        }
      })
      .catch(() => setError('Не вдалося завантажити звіти'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected || selected.totalScore < 100) return;
    const timer = setTimeout(() => {
      confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } });
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
    }, 300);
    return () => clearTimeout(timer);
  }, [selected]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy"></i>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
        <i className="fas fa-circle-exclamation"></i>
        <span>{error}</span>
      </div>
    );
  }

  // ── Detail view ──
  if (selected) {
    const reflection = getReflection(selected);
    const elapsed = hoursElapsed(selected);
    const deadlinePassed = elapsed > 72;

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelected(null); setExpandedSection(null); setShowReflection(false); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <i className="fas fa-arrow-left text-slate-500 text-sm"></i>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Звіт перевірки</h1>
            <p className="text-xs text-slate-400">
              {periodLabel(selected)}
              {selected.store && ` · ${selected.store}`}
            </p>
          </div>
        </div>

        {/* Q-period badge */}
        {selected.quarter && selected.year && (
          <div className="flex">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-kameya-burgundy/10 text-kameya-burgundy rounded-full text-sm font-semibold">
              <i className="fas fa-calendar-check text-xs"></i>
              {selected.quarter} {selected.year}
            </div>
          </div>
        )}

        {/* Score card */}
        <div className={`rounded-2xl border p-6 flex flex-col items-center ${scoreBgBorderClass(selected.totalScore)}`}>
          <p className="text-sm text-slate-500 mb-1">Загальний результат</p>
          <p className={`text-5xl font-bold ${scoreTextClass(selected.totalScore)}`}>{formatScore(selected.totalScore)}</p>
          <div className="w-full mt-4 bg-slate-200 rounded-full h-2">
            {(() => {
              const barColor = Math.floor(selected.totalScore) >= 95
                ? 'bg-green-500'
                : Math.floor(selected.totalScore) >= 80
                ? 'bg-yellow-500'
                : 'bg-red-500';
              return <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${selected.totalScore}%` }} />;
            })()}
          </div>
        </div>

        {selected.totalScore >= 100 && selected.affirmation && (
          <div className="relative overflow-hidden bg-kameya-burgundy rounded-2xl px-6 py-6 text-center">
            {[
              { icon: '🏆', left: '5%',  delay: '0s'    },
              { icon: '💎', left: '15%', delay: '0.6s'  },
              { icon: '🏆', left: '28%', delay: '1.2s'  },
              { icon: '💎', left: '40%', delay: '0.3s'  },
              { icon: '🏆', left: '52%', delay: '1.8s'  },
              { icon: '💎', left: '63%', delay: '0.9s'  },
              { icon: '🏆', left: '74%', delay: '2.4s'  },
              { icon: '💎', left: '83%', delay: '1.5s'  },
              { icon: '🏆', left: '90%', delay: '0.5s'  },
              { icon: '💎', left: '96%', delay: '2.1s'  },
            ].map((item, i) => (
              <span
                key={i}
                className="float-icon"
                style={{ left: item.left, animationDelay: item.delay }}
              >
                {item.icon}
              </span>
            ))}
            <p className="relative z-10 text-white text-lg font-semibold italic leading-relaxed">
              {selected.affirmation}
            </p>
          </div>
        )}

        {/* Sections — full detail, failed sections highlighted */}
        <div className="grid grid-cols-1 gap-4">
          {selected.sections.map((section, idx) => {
            const failed = section.score < section.maxScore;
            return (
              <div
                key={idx}
                className={`rounded-xl overflow-hidden shadow-sm border ${failed ? 'border-red-300 bg-red-50' : 'bg-white border-slate-100'}`}
              >
                <div className={`p-4 border-b flex justify-between items-center ${failed ? 'bg-red-100 border-red-300' : 'bg-slate-50 border-slate-100'}`}>
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    {failed && <i className="fas fa-circle-exclamation text-red-500 text-sm"></i>}
                    {section.title}
                  </h3>
                  <span className={`text-sm font-semibold ${failed ? 'text-red-600' : 'text-green-600'}`}>
                    {section.score} / {section.maxScore}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {section.feedback && <p className="text-sm italic text-slate-600">"{section.feedback}"</p>}
                  <div className="divide-y divide-slate-100">
                    {section.questions.map((q, qIdx) => (
                      <div key={qIdx} className="py-3 flex items-start space-x-3">
                        <i className={`fas ${q.isCorrect ? 'fa-check text-green-500' : 'fa-xmark text-red-500'} mt-0.5 flex-shrink-0`}></i>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-800">{q.question}</p>
                          <p className="text-xs text-slate-500">Відповідь: {q.answer}</p>
                          {q.comment && (
                            <p className="text-xs text-kameya-burgundy mt-1 font-medium italic">— {q.comment}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reflection section */}
        {reflection ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <i className="fas fa-circle-check text-green-500"></i>
            <div>
              <p className="text-sm font-semibold text-green-700">Рефлексію подано</p>
              <p className="text-xs text-green-600">
                {new Date(reflection.submittedAt).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {reflection.bonusPointsAwarded && ' · +10 балів нараховано'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setShowReflection(true)}
              className="w-full py-3 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2"
            >
              <i className="fas fa-pen-to-square"></i>
              Ознайомився
            </button>
          </div>
        )}

        {/* Reflection modal */}
        {showReflection && ReactDOM.createPortal(
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Рефлексія</h3>
                <button onClick={() => { setShowReflection(false); setReflError(''); }} className="text-slate-400 hover:text-slate-600">
                  <i className="fas fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Що я зроблю інакше наступного разу?
                  </label>
                  <textarea
                    value={reflAnswer1}
                    onChange={(e) => setReflAnswer1(e.target.value)}
                    rows={3}
                    placeholder="Ваша відповідь..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Який пункт був для мене несподіванкою?
                  </label>
                  <textarea
                    value={reflAnswer2}
                    onChange={(e) => setReflAnswer2(e.target.value)}
                    rows={3}
                    placeholder="Ваша відповідь..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
                  />
                </div>
                {reflError && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 flex items-center gap-2">
                    <i className="fas fa-triangle-exclamation"></i>
                    <span>{reflError}</span>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setShowReflection(false); setReflError(''); }}
                    className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={handleSubmitReflection}
                    disabled={reflSubmitting}
                    className="flex-1 py-3 rounded-xl bg-kameya-burgundy text-white font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {reflSubmitting ? (
                      <><i className="fas fa-spinner fa-spin"></i> Надсилання...</>
                    ) : (
                      <><i className="fas fa-paper-plane"></i> Надіслати</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Результати перевірок</h1>
        <p className="text-sm text-slate-500 mt-1">Ваші звіти таємного покупця</p>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <i className="fas fa-magnifying-glass text-2xl text-slate-300"></i>
          </div>
          <p className="text-slate-500 font-medium">Звітів поки немає</p>
          <p className="text-slate-400 text-sm mt-1">Результати перевірок з'являться тут після їх завантаження адміністратором</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => {
            const id = report._id ?? report.id ?? '';
            const refl = getReflection(report);
            return (
              <button
                key={id}
                onClick={() => { setSelected(report); setExpandedSection(null); }}
                className="w-full bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all text-left overflow-hidden"
              >
                {report.quarter && report.year && (
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-base font-bold text-kameya-burgundy">{periodLabel(report)}</span>
                  </div>
                )}
                <div className="px-4 pb-4 pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-14 rounded-xl flex items-center justify-center border flex-shrink-0 ${scoreBgBorderClass(report.totalScore)}`}>
                      <span className={`text-sm font-bold ${scoreTextClass(report.totalScore)}`}>{Math.round(report.totalScore)}%</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{user?.name}</p>
                      <p className="text-xs text-slate-400">{formatDate(report.date)}</p>
                      {report.store && <p className="text-xs text-slate-400">{report.store}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {refl ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <i className="fas fa-circle-check"></i> Ознайомлено
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <i className="fas fa-circle"></i> Не ознайомлено
                      </span>
                    )}
                    <i className="fas fa-chevron-right text-slate-300 text-sm"></i>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
