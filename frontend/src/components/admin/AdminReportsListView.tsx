import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AuditResult, AuditSection, LearningTask, STORES } from '../../types';
import { getAllReports, deleteReport, generateAiRecommendations, updateReportPeriod, deleteLearningPlan, updateLearningPlanTasks, generateLearningPlan } from '../../services/reportsService';
import { formatDate } from '../../utils/dateFormatter';
import { scoreTextClass, scoreBgBorderClass, formatScore, getScoreStyle } from '../../utils/scoreColor';

const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

interface ReportWithUser extends Omit<AuditResult, 'userId'> {
  userId: { _id: string; name: string; phone: string; store?: string } | string;
  quarter?: string;
  year?: number;
  month?: number;
}

const toDisplay = (phone: string) => {
  const p = phone.slice(2);
  return `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8, 10)}`;
};


interface AdminReportsListViewProps {
  initialReportId?: string | null;
  initialAction?: string | null;
}

export const AdminReportsListView: React.FC<AdminReportsListViewProps> = ({ initialReportId, initialAction }) => {
  const [reports, setReports] = useState<ReportWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReportWithUser | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [reflectionReport, setReflectionReport] = useState<ReportWithUser | null>(null);
  const [generatingAi, setGeneratingAi] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showPeriodEdit, setShowPeriodEdit] = useState(false);
  const [periodForm, setPeriodForm] = useState({ quarter: 'Q1', year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
  const [periodSaving, setPeriodSaving] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editTasks, setEditTasks] = useState<LearningTask[]>([]);
  const [planActionLoading, setPlanActionLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<'quarter' | 'month'>('quarter');

  useEffect(() => {
    if (!initialReportId || !reports.length) return;
    const target = reports.find(r => (r._id ?? r.id) === initialReportId);
    if (target) {
      setSelected(target as ReportWithUser);
      if (initialAction === 'reflection' && target.reflection) {
        setReflectionReport(target as ReportWithUser);
      }
    }
  }, [initialReportId, initialAction, reports]);

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getReflectionStatus = (report: ReportWithUser): 'on-time' | 'late' | 'missed' | 'pending' => {
    if (!report.createdAt) return 'pending';
    const hoursElapsed = (Date.now() - new Date(report.createdAt).getTime()) / (1000 * 3600);
    if (report.reflection) {
      return report.reflection.isOnTime ? 'on-time' : 'late';
    }
    return hoursElapsed >= 72 ? 'missed' : 'pending';
  };

  useEffect(() => {
    getAllReports()
      .then((data) => setReports(data as ReportWithUser[]))
      .catch(() => setError('Не вдалося завантажити звіти'))
      .finally(() => setLoading(false));
  }, []);

  const getUserName = (r: ReportWithUser) => {
    if (typeof r.userId === 'object') return r.userId.name;
    return '—';
  };

  const getUserPhone = (r: ReportWithUser) => {
    if (typeof r.userId === 'object') return toDisplay(r.userId.phone);
    return '';
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await deleteReport(id);
      setReports((prev) => prev.filter((r) => r._id !== id && r.id !== id));
      setDeleteConfirm(null);
      if (selected && (selected._id === id || selected.id === id)) {
        setSelected(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка видалення');
    } finally {
      setDeleting(false);
    }
  };

  const handleGenerateAi = async (report: ReportWithUser) => {
    const id = report._id ?? report.id ?? '';
    setGeneratingAi(id);
    setAiError(null);
    try {
      const updated = await generateAiRecommendations(id);
      setReports(prev => prev.map(r => (r._id ?? r.id) === id ? { ...r, ...updated } as ReportWithUser : r));
      setSelected(prev => prev && (prev._id ?? prev.id) === id ? { ...prev, ...updated } as ReportWithUser : prev);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Помилка генерації');
    } finally {
      setGeneratingAi(null);
    }
  };

  const getStoreFromReport = (r: ReportWithUser): string => {
    // Спочатку перевіряємо поле store самого звіту (нові звіти)
    if (r.store) return r.store;
    // Потім перевіряємо магазин з userId (старі звіти)
    if (typeof r.userId === 'object' && r.userId.store) {
      return r.userId.store;
    }
    return '';
  };

  const filtered = reports
    .filter((r) => {
      const name = getUserName(r).toLowerCase();
      const phone = getUserPhone(r);
      const store = getStoreFromReport(r);
      const q = search.toLowerCase();

      const matchesSearch = name.includes(q) || phone.includes(q) || r.date.toLowerCase().includes(q);
      const matchesStore = !selectedStore || store === selectedStore;

      return matchesSearch && matchesStore;
    })
    .sort((a, b) => {
      // Сортування по даті (новіші зверху)
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const quarterOrder: Record<string, number> = { Q4: 0, Q3: 1, Q2: 2, Q1: 3 };

  const groupedReports = groupMode === 'month'
    ? filtered.reduce<Record<string, ReportWithUser[]>>((acc, report) => {
        const m = report.month;
        const year = report.year ?? new Date().getFullYear();
        const key = m ? `${MONTHS_UK[m - 1]} ${year}` : 'Без місяця';
        if (!acc[key]) acc[key] = [];
        acc[key].push(report);
        return acc;
      }, {})
    : filtered.reduce<Record<string, ReportWithUser[]>>((acc, report) => {
        const quarter = report.quarter ?? 'Q1';
        const year = report.year ?? new Date().getFullYear();
        const key = `${quarter} ${year}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(report);
        return acc;
      }, {});

  const sortedGroupKeys = groupMode === 'month'
    ? Object.keys(groupedReports).sort((a, b) => {
        if (a === 'Без місяця') return 1;
        if (b === 'Без місяця') return -1;
        const parseMonthKey = (k: string) => {
          const parts = k.split(' ');
          const year = Number(parts[parts.length - 1]);
          const monthName = parts.slice(0, -1).join(' ');
          const month = MONTHS_UK.indexOf(monthName);
          return { year, month };
        };
        const pa = parseMonthKey(a);
        const pb = parseMonthKey(b);
        if (pb.year !== pa.year) return pb.year - pa.year;
        return pb.month - pa.month;
      })
    : Object.keys(groupedReports).sort((a, b) => {
        const [qa, ya] = a.split(' ');
        const [qb, yb] = b.split(' ');
        if (Number(yb) !== Number(ya)) return Number(yb) - Number(ya);
        return (quarterOrder[qa] ?? 99) - (quarterOrder[qb] ?? 99);
      });

  const applyPlanUpdate = (updated: AuditResult) => {
    const merged = { ...selected!, ...updated, userId: selected!.userId } as ReportWithUser;
    setSelected(merged);
    setReports(prev => prev.map(r => (r._id ?? r.id) === (merged._id ?? merged.id) ? merged : r));
  };

  const handleDeletePlan = async () => {
    if (!selected) return;
    if (!confirm('Видалити план навчання? Цю дію не можна скасувати.')) return;
    setPlanError(null);
    setPlanActionLoading(true);
    try {
      const updated = await deleteLearningPlan(selected._id ?? selected.id ?? '');
      applyPlanUpdate(updated);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Помилка видалення');
    } finally {
      setPlanActionLoading(false);
    }
  };

  const handleRecreatePlan = async () => {
    if (!selected) return;
    if (!confirm('Перестворити план навчання? Поточний план і прогрес будуть втрачені.')) return;
    setPlanError(null);
    setPlanActionLoading(true);
    try {
      const updated = await generateLearningPlan(selected._id ?? selected.id ?? '');
      applyPlanUpdate(updated);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Помилка генерації');
    } finally {
      setPlanActionLoading(false);
    }
  };

  const handleGeneratePlan = async () => {
    if (!selected) return;
    setPlanError(null);
    setPlanActionLoading(true);
    try {
      const updated = await generateLearningPlan(selected._id ?? selected.id ?? '');
      applyPlanUpdate(updated);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Помилка генерації');
    } finally {
      setPlanActionLoading(false);
    }
  };

  const handleSavePlanEdit = async () => {
    if (!selected) return;
    setPlanError(null);
    setPlanActionLoading(true);
    try {
      const updated = await updateLearningPlanTasks(selected._id ?? selected.id ?? '', editTasks);
      applyPlanUpdate(updated);
      setEditingPlan(false);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Помилка збереження');
    } finally {
      setPlanActionLoading(false);
    }
  };

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

  // ── Delete confirmation modal ── (доступна скрізь)
  if (deleteConfirm) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-6 max-w-sm shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <i className="fas fa-exclamation text-red-600"></i>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Видалити звіт?</h2>
          </div>
          <p className="text-sm text-slate-600 mb-6">Ця дія необоротна. Звіт буде видалено назавжди.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirm(null)}
              disabled={deleting}
              className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              Скасувати
            </button>
            <button
              onClick={() => handleDelete(deleteConfirm)}
              disabled={deleting}
              className="flex-1 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {deleting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Видалення...
                </>
              ) : (
                <>
                  <i className="fas fa-trash-can"></i>
                  Видалити
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Detail view ──
  if (selected) {
    const name = getUserName(selected);
    const phone = getUserPhone(selected);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelected(null); setExpandedSection(null); setDeleteConfirm(null); }}
              className="w-9 h-9 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <i className="fas fa-arrow-left text-slate-500 text-sm"></i>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-slate-800">{name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-slate-400">
                  {selected.quarter && selected.year ? `${selected.quarter} ${selected.year}` : ''}
                  {selected.month ? ` · ${MONTHS_UK[selected.month - 1]}` : ''}
                  {` · ${phone} · ${formatDate(selected.date)}`}
                  {getStoreFromReport(selected) ? ` · ${getStoreFromReport(selected)}` : ''}
                </p>
                <button
                  onClick={() => {
                    setPeriodForm({
                      quarter: selected.quarter ?? 'Q1',
                      year: selected.year ?? new Date().getFullYear(),
                      month: selected.month ?? new Date().getMonth() + 1,
                    });
                    setPeriodError(null);
                    setShowPeriodEdit(true);
                  }}
                  className="text-xs text-kameya-burgundy font-semibold hover:opacity-75 flex items-center gap-1"
                >
                  <i className="fas fa-pen text-[10px]"></i> Редагувати
                </button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setDeleteConfirm(selected._id ?? selected.id ?? '')}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-red-500"
            title="Видалити звіт"
          >
            <i className="fas fa-trash-can text-sm"></i>
          </button>
        </div>

        <div className={`rounded-2xl border p-6 flex flex-col items-center ${scoreBgBorderClass(selected.totalScore)}`}>
          <p className="text-sm text-slate-500 mb-1">Загальний результат</p>
          <p className={`text-5xl font-bold ${scoreTextClass(selected.totalScore)}`}>{formatScore(selected.totalScore)}</p>
          <div className="w-full mt-4 bg-slate-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${selected.totalScore >= 80 ? 'bg-green-500' : selected.totalScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.round(selected.totalScore)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-slate-500 mb-1">Дата</p>
            <p className="font-semibold text-slate-700">{formatDate(selected.date)}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-slate-500 mb-1">Магазин</p>
            <p className="font-semibold text-slate-700">{getStoreFromReport(selected) || '—'}</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-slate-500 mb-1">Файл</p>
            <p className="font-semibold text-slate-700 truncate" title={selected.fileName}>{selected.fileName || '—'}</p>
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
                    <span className={`text-sm font-bold ${scoreTextClass(pct)}`}>{section.score}/{section.maxScore}</span>
                    <span className="text-xs text-slate-400">({pct}%)</span>
                  </div>
                </button>
                {expandedSection === idx && (
                  <div className="px-4 pb-4 space-y-2">
                    {section.feedback && (
                      <p className="text-xs text-slate-500 italic border-l-2 border-slate-200 pl-3 py-1">{section.feedback}</p>
                    )}
                    <div className="space-y-1">
                      {section.questions.map((q, qi) => {
                        const showScore = q.isImportant !== false;
                        const scoreVal = !isNaN(Number(q.answer)) && q.answer !== '' ? q.answer : '';
                        return (
                          <div key={qi} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                            <i className={`fas ${q.isCorrect ? 'fa-circle-check text-green-500' : 'fa-circle-xmark text-orange-400'} text-sm flex-shrink-0`}></i>
                            <p className="text-xs text-slate-700 flex-1">{q.question}</p>
                            {showScore ? (
                              <span className={`shrink-0 text-xs font-bold px-2 py-0.5 min-w-[1.5rem] text-center rounded-full border ${
                                q.isCorrect
                                  ? 'text-green-700 bg-green-50 border-green-200'
                                  : 'text-orange-700 bg-orange-50 border-orange-200'
                              }`}>
                                {scoreVal || '0'}
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs text-slate-400">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Reflection panel */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700 mb-3">Рефлексія</p>
          {(() => {
            const status = getReflectionStatus(selected);
            const hoursElapsed = selected.createdAt
              ? (Date.now() - new Date(selected.createdAt).getTime()) / (1000 * 3600)
              : 999;
            const hoursLeft = Math.max(0, Math.floor(72 - hoursElapsed));

            if (status === 'on-time') return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fas fa-circle-check text-green-500"></i>
                  <span className="text-sm text-green-700 font-semibold">Отримана вчасно</span>
                </div>
                <button
                  onClick={() => setReflectionReport(selected)}
                  className="text-xs text-kameya-burgundy font-semibold hover:opacity-75"
                >
                  Переглянути відповіді
                </button>
              </div>
            );

            if (status === 'late') return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <i className="fas fa-circle-xmark text-orange-500"></i>
                  <span className="text-sm text-orange-700 font-semibold">Отримана не вчасно</span>
                </div>
                <button
                  onClick={() => setReflectionReport(selected)}
                  className="text-xs text-kameya-burgundy font-semibold hover:opacity-75"
                >
                  Переглянути відповіді
                </button>
              </div>
            );

            if (status === 'missed') return (
              <div className="flex items-center gap-2">
                <i className="fas fa-circle-xmark text-red-500"></i>
                <span className="text-sm text-red-600 font-semibold">Не подана</span>
                <span className="text-xs text-slate-400">· Термін минув</span>
              </div>
            );

            return (
              <div className="flex items-center gap-2">
                <i className="fas fa-clock text-slate-400"></i>
                <span className="text-sm text-slate-600">Очікується</span>
                <span className="text-xs text-slate-400">· залишилось {hoursLeft} год</span>
              </div>
            );
          })()}
        </div>

        {/* AI Recommendations panel — hidden for 100% score */}
        {selected.totalScore !== 100 && (
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700 mb-3">AI Рекомендації</p>
          {selected.aiRecommendations ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{selected.aiRecommendations.mainMessage}</p>
              {selected.aiRecommendations.weakPoints.length > 0 && (
                <ul className="space-y-1">
                  {selected.aiRecommendations.weakPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                      <i className="fas fa-circle-arrow-right text-kameya-burgundy mt-0.5 flex-shrink-0 text-xs"></i>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
              {selected.scoreInsight && (
                <div className="border-t border-slate-100 pt-3 space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Відповідь консультанта</p>
                  {selected.scoreInsight.goalText && (
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selected.scoreInsight.goalText}</p>
                  )}
                  {selected.scoreInsight.confirmedAt && (
                    <p className="text-sm text-green-700 flex items-center gap-2">
                      <i className="fas fa-circle-check text-green-500"></i>
                      Підтвердив розуміння
                    </p>
                  )}
                  {selected.scoreInsight.whatHelpedText && (
                    <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{selected.scoreInsight.whatHelpedText}</p>
                  )}
                </div>
              )}
              {!selected.scoreInsight && (
                <p className="text-xs text-slate-400">Консультант ще не відповів</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Консультант ще не відкривав дашборд</p>
              <button
                onClick={() => handleGenerateAi(selected)}
                disabled={generatingAi === (selected._id ?? selected.id ?? '')}
                className="text-xs text-kameya-burgundy font-semibold hover:opacity-75 flex items-center gap-1 disabled:opacity-40"
              >
                {generatingAi === (selected._id ?? selected.id ?? '') ? (
                  <><i className="fas fa-spinner fa-spin"></i> Генеруємо...</>
                ) : (
                  <><i className="fas fa-wand-magic-sparkles"></i> Згенерувати</>
                )}
              </button>
            </div>
          )}
          {aiError && <p className="text-xs text-red-500 mt-2">{aiError}</p>}
        </div>
        )}

        {/* Learning Plan panel */}
        <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-slate-700">План навчання</p>
            {selected.learningPlan && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setPlanError(null); setEditTasks([...selected.learningPlan!.tasks]); setEditingPlan(true); }}
                  disabled={planActionLoading}
                  className="text-slate-400 hover:text-kameya-burgundy transition-colors disabled:opacity-40"
                  title="Редагувати задачі"
                >
                  <i className="fas fa-pen text-xs"></i>
                </button>
                <button
                  onClick={handleRecreatePlan}
                  disabled={planActionLoading}
                  className="text-slate-400 hover:text-blue-500 transition-colors disabled:opacity-40"
                  title="Перестворити план"
                >
                  <i className="fas fa-rotate text-xs"></i>
                </button>
                <button
                  onClick={handleDeletePlan}
                  disabled={planActionLoading}
                  className="text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  title="Видалити план"
                >
                  <i className="fas fa-trash-can text-xs"></i>
                </button>
              </div>
            )}
          </div>

          {selected.learningPlan ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Згенеровано: {formatDate(selected.learningPlan.generatedAt)}
                {' · '}
                {selected.learningPlan.tasks.filter(t => t.isCompleted).length}/{selected.learningPlan.tasks.length} виконано
              </p>
              {(() => {
                type LPTask = NonNullable<typeof selected.learningPlan>['tasks'][number];
                const groups: { topic: string; tasks: LPTask[] }[] = [];
                const seen = new Map<string, number>();
                selected.learningPlan.tasks.forEach(t => {
                  const idx = seen.get(t.topicTitle);
                  if (idx !== undefined) {
                    groups[idx].tasks.push(t);
                  } else {
                    seen.set(t.topicTitle, groups.length);
                    groups.push({ topic: t.topicTitle, tasks: [t] });
                  }
                });
                return groups.map(({ topic, tasks }) => (
                  <div key={topic}>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{topic}</p>
                    <div className="space-y-1">
                      {tasks.map((task, i) => (
                        <div
                          key={i}
                          className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                            task.isCompleted ? 'bg-green-50' : 'bg-slate-50'
                          }`}
                        >
                          <i className={`fas ${task.isCompleted ? 'fa-circle-check text-green-500' : 'fa-circle text-slate-300'} flex-shrink-0 mt-0.5 text-xs`}></i>
                          <div className="flex-1">
                            <span className={task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'}>
                              {task.description}
                            </span>
                            {task.completedAt && (
                              <span className="ml-2 text-xs text-green-600">
                                {formatDate(task.completedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">План ще не згенеровано</p>
              {selected.aiRecommendations &&
                (selected.aiRecommendations.tier === 'below85' || selected.aiRecommendations.tier === 'range85to94') && (
                <button
                  onClick={handleGeneratePlan}
                  disabled={planActionLoading}
                  className="text-xs text-kameya-burgundy font-semibold hover:opacity-75 flex items-center gap-1 disabled:opacity-40"
                >
                  {planActionLoading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Генерація...</>
                  ) : (
                    <><i className="fas fa-wand-magic-sparkles"></i> Згенерувати</>
                  )}
                </button>
              )}
            </div>
          )}

          {planError && <p className="text-xs text-red-500 mt-2">{planError}</p>}
        </div>

        {/* Period edit modal */}
        {showPeriodEdit && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Редагувати період</h3>
                <button onClick={() => setShowPeriodEdit(false)} className="text-slate-400 hover:text-slate-600">
                  <i className="fas fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Рік</label>
                    <select
                      value={periodForm.year}
                      onChange={e => setPeriodForm(f => ({ ...f, year: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30"
                    >
                      {[new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Квартал</label>
                    <select
                      value={periodForm.quarter}
                      onChange={e => setPeriodForm(f => ({ ...f, quarter: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30"
                    >
                      {['Q1','Q2','Q3','Q4'].map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Місяць</label>
                    <select
                      value={periodForm.month}
                      onChange={e => setPeriodForm(f => ({ ...f, month: Number(e.target.value) }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30"
                    >
                      {MONTHS_UK.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                    </select>
                  </div>
                </div>
                {periodError && (
                  <p className="text-sm text-red-600 flex items-center gap-2">
                    <i className="fas fa-triangle-exclamation"></i>{periodError}
                  </p>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowPeriodEdit(false)}
                    className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                  >
                    Скасувати
                  </button>
                  <button
                    onClick={async () => {
                      if (!selected) return;
                      setPeriodSaving(true);
                      setPeriodError(null);
                      try {
                        const updated = await updateReportPeriod(selected._id ?? selected.id ?? '', periodForm);
                        const merged = { ...selected, ...updated } as ReportWithUser;
                        setSelected(merged);
                        setReports(prev => prev.map(r => (r._id ?? r.id) === (merged._id ?? merged.id) ? merged : r));
                        setShowPeriodEdit(false);
                      } catch (err) {
                        setPeriodError(err instanceof Error ? err.message : 'Помилка');
                      } finally {
                        setPeriodSaving(false);
                      }
                    }}
                    disabled={periodSaving}
                    className="flex-1 py-3 rounded-xl bg-kameya-burgundy text-white font-bold hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {periodSaving ? <><i className="fas fa-spinner fa-spin"></i> Збереження...</> : <><i className="fas fa-floppy-disk"></i> Зберегти</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Learning Plan modal */}
        {editingPlan && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Редагувати задачі</h3>
                  <p className="text-sm text-slate-500">{getUserName(selected)} · {editTasks.length} задач</p>
                </div>
                <button onClick={() => setEditingPlan(false)} className="text-slate-400 hover:text-slate-600">
                  <i className="fas fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {editTasks.map((task, i) => (
                  <div key={i} className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Тема</label>
                      <input
                        type="text"
                        value={task.topicTitle}
                        onChange={e => setEditTasks(prev => prev.map((t, j) => j === i ? { ...t, topicTitle: e.target.value } : t))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Завдання</label>
                      <textarea
                        value={task.description}
                        onChange={e => setEditTasks(prev => prev.map((t, j) => j === i ? { ...t, description: e.target.value } : t))}
                        rows={3}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => { setPlanError(null); setEditingPlan(false); }}
                  className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all"
                >
                  Скасувати
                </button>
                <button
                  onClick={handleSavePlanEdit}
                  disabled={planActionLoading}
                  className="flex-1 py-3 rounded-xl bg-kameya-burgundy text-white font-bold hover:opacity-90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {planActionLoading ? (
                    <><i className="fas fa-spinner fa-spin"></i> Збереження...</>
                  ) : (
                    <><i className="fas fa-floppy-disk"></i> Зберегти</>
                  )}
                </button>
              </div>
              {planError && <p className="text-xs text-red-500 px-6 pb-4">{planError}</p>}
            </div>
          </div>
        )}

        {/* Reflection answers modal */}
        {reflectionReport?.reflection && createPortal(
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Відповіді рефлексії</h3>
                  <p className="text-sm text-slate-500">
                    {getUserName(reflectionReport)} · {reflectionReport.quarter} {reflectionReport.year}
                  </p>
                </div>
                <button onClick={() => setReflectionReport(null)} className="text-slate-400 hover:text-slate-600">
                  <i className="fas fa-xmark text-xl"></i>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                    reflectionReport.reflection.isOnTime
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {reflectionReport.reflection.isOnTime ? '✅ Вчасно' : '⚠️ Не вчасно'}
                  </span>
                  <span className="text-sm text-slate-500">
                    {(() => { const d = new Date(reflectionReport.reflection.submittedAt); return `${formatDate(d.toISOString())} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })()}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Що я зроблю інакше наступного разу?
                  </p>
                  <p className="text-sm text-slate-800 bg-slate-50 rounded-xl p-4 leading-relaxed">
                    {reflectionReport.reflection.answer1}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Який пункт був для мене несподіванкою?
                  </p>
                  <p className="text-sm text-slate-800 bg-slate-50 rounded-xl p-4 leading-relaxed">
                    {reflectionReport.reflection.answer2}
                  </p>
                </div>
              </div>
            </div>
          </div>
        , document.body)}
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Всі звіти</h1>
            <p className="text-sm text-slate-500 mt-1">Збережено звітів: {reports.length}</p>
          </div>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
            {(['quarter', 'month'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setGroupMode(mode)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  groupMode === mode
                    ? 'bg-white text-kameya-burgundy shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode === 'quarter' ? 'По кварталах' : 'По місяцях'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Магазин</label>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy"
            >
              <option value="">— Усі магазини —</option>
              {STORES.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Пошук</label>
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                placeholder="Ім'я, телефон, дата..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy"
              />
            </div>
          </div>
        </div>

        {sortedGroupKeys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <i className="fas fa-folder-open text-2xl text-slate-300"></i>
            </div>
            <p className="text-slate-500 font-medium">{reports.length === 0 ? 'Звітів ще немає' : 'Нічого не знайдено'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedGroupKeys.map((groupKey) => {
              const groupReports = groupedReports[groupKey];
              const isOpen = openGroups.has(groupKey);
              return (
                <div key={groupKey} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleGroup(groupKey)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-slate-800 text-lg">{groupKey}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {groupReports.length} {groupReports.length === 1 ? 'звіт' : 'звітів'}
                      </span>
                    </div>
                    <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'} text-slate-400 text-sm`}></i>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {groupReports.map((report) => {
                        const id = report._id ?? report.id ?? '';
                        const style = getScoreStyle(report.totalScore);
                        return (
                          <button
                            key={id}
                            onClick={() => { setSelected(report); setExpandedSection(null); }}
                            className="w-full px-5 py-3 hover:bg-slate-50 transition-colors text-left flex items-center justify-between"
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-14 h-12 rounded-xl flex items-center justify-center border flex-shrink-0 ${style.bgClass} ${style.borderClass}`}>
                                <span className={`text-sm font-bold ${style.textClass}`}>
                                  {style.icon ?? `${Math.round(report.totalScore)}%`}
                                </span>
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{getUserName(report)}</p>
                                <p className="text-xs text-slate-500">{getUserPhone(report)}</p>
                                <p className="text-xs text-slate-400">{formatDate(report.date)}{getStoreFromReport(report) ? ` · ${getStoreFromReport(report)}` : ''}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {report.aiRecommendations && !report.scoreInsight && (
                                <span className="text-xs text-amber-500 flex items-center gap-1">
                                  <i className="fas fa-wand-magic-sparkles"></i> Без відповіді
                                </span>
                              )}
                              {report.aiRecommendations && report.scoreInsight && (
                                <span className="text-xs text-green-600 flex items-center gap-1">
                                  <i className="fas fa-circle-check"></i> Відповів
                                </span>
                              )}
                              {(() => {
                                const rs = getReflectionStatus(report);
                                if (rs === 'on-time') return <span className="text-xs text-green-600 flex items-center gap-1"><i className="fas fa-circle-check"></i> Заповнено · вчасно</span>;
                                if (rs === 'late') return <span className="text-xs text-orange-500 flex items-center gap-1"><i className="fas fa-circle-xmark"></i> Заповнено · не вчасно</span>;
                                if (rs === 'missed') return <span className="text-xs text-red-400 flex items-center gap-1"><i className="fas fa-circle-xmark"></i> Не заповнено</span>;
                                return <span className="text-xs text-slate-400 flex items-center gap-1"><i className="fas fa-clock"></i> Не заповнено</span>;
                              })()}
                              <i className="fas fa-chevron-right text-slate-300 text-sm"></i>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
};
