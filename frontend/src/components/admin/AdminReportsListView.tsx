import React, { useState, useEffect } from 'react';
import { AuditResult, AuditSection, STORES } from '../../types';
import { getAllReports, deleteReport } from '../../services/reportsService';
import { formatDate } from '../../utils/dateFormatter';

interface ReportWithUser extends AuditResult {
  userId: { _id: string; name: string; phone: string } | string;
}

const toDisplay = (phone: string) => {
  const p = phone.slice(2);
  return `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6, 8)} ${p.slice(8, 10)}`;
};

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

export const AdminReportsListView: React.FC = () => {
  const [reports, setReports] = useState<ReportWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReportWithUser | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>('');

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
            <div>
              <h1 className="text-xl font-bold text-slate-800">{name}</h1>
              <p className="text-xs text-slate-400">{phone} · {formatDate(selected.date)}{getStoreFromReport(selected) ? ` · ${getStoreFromReport(selected)}` : ''}</p>
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

        <div className={`rounded-2xl border p-6 flex flex-col items-center ${scoreBg(selected.totalScore)}`}>
          <p className="text-sm text-slate-500 mb-1">Загальний результат</p>
          <p className={`text-5xl font-bold ${scoreColor(selected.totalScore)}`}>{Math.round(selected.totalScore)}%</p>
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
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Всі звіти</h1>
          <p className="text-sm text-slate-500 mt-1">Збережено звітів: {reports.length}</p>
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

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <i className="fas fa-folder-open text-2xl text-slate-300"></i>
            </div>
            <p className="text-slate-500 font-medium">{reports.length === 0 ? 'Звітів ще немає' : 'Нічого не знайдено'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((report) => {
              const id = report._id ?? report.id ?? '';
              return (
                <button
                  key={id}
                  onClick={() => { setSelected(report); setExpandedSection(null); }}
                  className="w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all text-left flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-14 rounded-xl flex items-center justify-center border flex-shrink-0 ${scoreBg(report.totalScore)}`}>
                      <span className={`text-sm font-bold ${scoreColor(report.totalScore)}`}>{Math.round(report.totalScore)}%</span>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{getUserName(report)}</p>
                      <p className="text-xs text-slate-500">{getUserPhone(report)}</p>
                      <p className="text-xs text-slate-400">{formatDate(report.date)}{getStoreFromReport(report) ? ` · ${getStoreFromReport(report)}` : ''}</p>
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
