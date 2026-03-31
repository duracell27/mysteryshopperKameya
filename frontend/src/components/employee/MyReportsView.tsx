import React, { useState, useEffect } from 'react';
import { AuditResult, AuditSection } from '../../types';
import { getMyReports } from '../../services/reportsService';
import { formatDate } from '../../utils/dateFormatter';
import { useAuth } from '../../context/AuthContext';

const scoreColor = (score: number) => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const scoreBg = (score: number) => {
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 60) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
};

export const MyReportsView: React.FC = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditResult | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [showDetailedView, setShowDetailedView] = useState(false);

  useEffect(() => {
    getMyReports()
      .then(setReports)
      .catch(() => setError('Не вдалося завантажити звіти'))
      .finally(() => setLoading(false));
  }, []);

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
    // Детальний вид з усіма деталями (як в AuditView)
    if (showDetailedView) {
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setShowDetailedView(false); }}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <i className="fas fa-arrow-left text-slate-500 text-sm"></i>
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Звіт перевірки</h1>
              <p className="text-xs text-slate-400">
                {formatDate(selected.date)}
                {selected.store && ` · ${selected.store}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {selected.sections.map((section, idx) => (
              <div key={idx} className="bg-white border rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                  <h3 className="font-bold text-slate-700">{section.title}</h3>
                  <span className={`text-sm font-semibold ${section.score < section.maxScore * 0.7 ? 'text-red-600' : 'text-green-600'}`}>
                    {section.score} / {section.maxScore}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {section.feedback && <p className="text-sm italic text-slate-600">"{section.feedback}"</p>}
                  <div className="divide-y divide-slate-100">
                    {section.questions.map((q, qIdx) => (
                      <div key={qIdx} className="py-3 flex items-start space-x-3">
                        <i className={`fas ${q.isCorrect ? 'fa-check text-green-500' : 'fa-xmark text-red-500'} mt-0.5`}></i>
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
            ))}
          </div>
        </div>
      );
    }

    // Коротка версія з кнопкою "Детальний звіт"
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelected(null); setExpandedSection(null); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <i className="fas fa-arrow-left text-slate-500 text-sm"></i>
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Звіт перевірки</h1>
            <p className="text-xs text-slate-400">
              {formatDate(selected.date)}
              {selected.store && ` · ${selected.store}`}
            </p>
          </div>
        </div>

        <div className={`rounded-2xl border p-6 flex flex-col items-center ${scoreBg(selected.totalScore)}`}>
          <p className="text-sm text-slate-500 mb-1">Загальний результат</p>
          <p className={`text-5xl font-bold ${scoreColor(selected.totalScore)}`}>{Math.round(selected.totalScore)}%</p>
          <div className="w-full mt-4 bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${selected.totalScore >= 80 ? 'bg-green-500' : selected.totalScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${selected.totalScore}%` }}
            />
          </div>
        </div>

        <div className="space-y-2">
          {selected.sections.map((section: AuditSection, idx: number) => {
            const pct = Math.round((section.score / section.maxScore) * 100);
            return (
              <div key={idx} className="bg-white border border-slate-100 rounded-xl overflow-hidden shadow-sm">
                <button
                  onClick={() => setExpandedSection(expandedSection === idx ? null : idx)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <i className={`fas fa-chevron-${expandedSection === idx ? 'up' : 'down'} text-xs text-slate-400`}></i>
                    <span className="text-sm font-medium text-slate-700">{section.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${scoreColor(pct)}`}>{section.score}/{section.maxScore}</span>
                    <span className="text-xs text-slate-400">({pct}%)</span>
                  </div>
                </button>

                {expandedSection === idx && (
                  <div className="px-4 pb-4 space-y-2">
                    {section.feedback && (
                      <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3 py-1">{section.feedback}</p>
                    )}
                    <div className="space-y-1">
                      {section.questions.map((q, qi) => (
                        <div key={qi} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                          <i className={`fas ${q.isCorrect ? 'fa-circle-check text-green-500' : 'fa-circle-xmark text-orange-400'} text-sm flex-shrink-0`}></i>
                          <p className="text-xs text-slate-700 flex-1">{q.question}</p>
                          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 min-w-[1.5rem] text-center rounded-full border ${
                            q.isCorrect
                              ? 'text-green-700 bg-green-50 border-green-200'
                              : 'text-orange-700 bg-orange-50 border-orange-200'
                          }`}>
                            {!isNaN(Number(q.answer)) && q.answer !== '' ? q.answer : q.isCorrect ? '1' : '0'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setShowDetailedView(true)}
          className="w-full py-3 bg-kameya-burgundy text-white rounded-xl font-semibold hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2"
        >
          <i className="fas fa-eye"></i>
          Детальний звіт
        </button>
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
            return (
              <button
                key={id}
                onClick={() => { setSelected(report); setExpandedSection(null); }}
                className="w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-14 rounded-xl flex items-center justify-center border ${scoreBg(report.totalScore)}`}>
                    <span className={`text-sm font-bold ${scoreColor(report.totalScore)}`}>{Math.round(report.totalScore)}%</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{user?.name}</p>
                    <p className="text-xs text-slate-400">{formatDate(report.date)}</p>
                    {report.store && <p className="text-xs text-slate-400">{report.store}</p>}
                  </div>
                </div>
                <i className="fas fa-chevron-right text-slate-300 text-sm"></i>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
