import React, { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, CartesianGrid, ResponsiveContainer, LabelList } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { getLibraryStats, LibraryStats } from '../../services/libraryService';
import { getGroupLabel } from '../../config/org-structure';

const ACCENT = '#7B1C3A';
const MONTHS_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
const MIN_YEAR = 2026;

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
);

function fmt(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export const AdminLibraryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear]     = useState(Math.max(MIN_YEAR, now.getFullYear()));
  const [stats, setStats]   = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLibraryStats(year)
      .then(setStats)
      .catch(e => setError(e instanceof Error ? e.message : 'Помилка'))
      .finally(() => setLoading(false));
  }, [year]);

  useEffect(() => { load(); }, [load]);

  const maxYear = now.getFullYear();
  const chartData = MONTHS_SHORT.map((label, i) => ({
    label,
    count: stats?.monthlyTurnover[i]?.count ?? 0,
  }));

  const maxDiv = stats?.divisionRanking[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      {/* Row 1: header + year picker */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Як читає команда</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYear(y => Math.max(MIN_YEAR, y - 1))}
            disabled={year <= MIN_YEAR}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-left text-slate-500 text-xs"></i>
          </button>
          <span className="text-base font-bold text-slate-700 min-w-[56px] text-center">{year}</span>
          <button
            onClick={() => setYear(y => Math.min(maxYear, y + 1))}
            disabled={year >= maxYear}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-right text-slate-500 text-xs"></i>
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <i className="fas fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      {/* Row 2: 4 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Обіг за період', icon: 'fa-book-open',        value: stats?.turnover,     sub: 'прочитаних книг' },
          { label: 'На руках зараз', icon: 'fa-hand-holding-heart', value: stats?.onHands,      sub: 'активних позик' },
          { label: 'Прострочено',    icon: 'fa-clock-rotate-left', value: stats?.overdueCount, sub: 'не повернуто вчасно' },
          { label: 'Нові читачі',    icon: 'fa-user-plus',         value: stats?.newReaders,   sub: 'вперше взяли книгу' },
        ].map(card => (
          <div key={card.label} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-wider leading-tight" style={{ color: ACCENT }}>{card.label}</p>
              <i className={`fas ${card.icon} text-slate-300 text-lg`}></i>
            </div>
            {loading ? (
              <Skeleton className="h-9 w-16" />
            ) : (
              <p className="text-4xl font-bold text-slate-800">{card.value ?? '—'}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Row 3: bar chart (75%) + division ranking (25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Bar chart */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: ACCENT }}>Обіг по місяцях</p>
          {loading ? (
            <Skeleton className="h-48" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 20, right: 8, left: 8, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} minPointSize={3}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    style={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                    formatter={(v: unknown) => (Number(v) > 0 ? String(v) : '')}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Division ranking */}
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: ACCENT }}>Відділи: прочитано книг</p>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !stats?.divisionRanking.length ? (
            <p className="text-slate-400 text-sm">Немає даних</p>
          ) : (
            <div className="space-y-3">
              {stats.divisionRanking.map((row, i) => (
                <div key={`${row.division}:${row.group}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="text-slate-300 font-semibold w-4 text-right">{i + 1}</span>
                      <span className="font-medium text-slate-700 truncate">
                        {getGroupLabel(row.division, row.group)}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-slate-700 ml-2 flex-shrink-0">{row.count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((row.count / maxDiv) * 100)}%`, backgroundColor: ACCENT }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: top 5 books + top 5 readers + recent reviews */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top 5 books */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: ACCENT }}>Топ 5 книг</p>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7" />)}</div>
          ) : !stats?.topBooks.length ? (
            <p className="text-slate-400 text-sm">Немає даних</p>
          ) : (
            <div className="space-y-2.5">
              {stats.topBooks.map((b, i) => (
                <div key={b._id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{b.title}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 flex-shrink-0">{b.count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top 5 readers */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: ACCENT }}>Топ 5 читачів</p>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-7" />)}</div>
          ) : !stats?.topReaders.length ? (
            <p className="text-slate-400 text-sm">Немає даних</p>
          ) : (
            <div className="space-y-2.5">
              {stats.topReaders.map((r, i) => (
                <div key={r._id} className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300 w-4 text-right flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{r.name}</p>
                    <p className="text-xs text-slate-400 truncate">{getGroupLabel(r.division, r.group)}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 flex-shrink-0">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent reviews */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: ACCENT }}>Свіжі відгуки</p>
          {loading ? (
            <div className="space-y-4">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : !stats?.recentReviews.length ? (
            <p className="text-slate-400 text-sm">Немає відгуків</p>
          ) : (
            <div className="space-y-3 flex-1">
              {stats.recentReviews.map(r => (
                <div key={r._id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-700 truncate leading-tight">{r.bookTitle}</p>
                    <span className="text-xs text-slate-400 flex-shrink-0 leading-tight">{r.rating}/10</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-1">{r.userName}</p>
                  <p className="text-xs text-slate-500 line-clamp-2">{r.review}</p>
                  <p className="text-[11px] text-slate-300 mt-1">{fmt(r.returnedAt)}</p>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate('/admin/library/loans')}
            className="mt-4 text-xs font-semibold text-kameya-burgundy hover:underline flex items-center gap-1"
          >
            Всі відгуки <i className="fas fa-arrow-right text-[10px]"></i>
          </button>
        </div>
      </div>

      {/* Row 5: overdue table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Прострочені повернення</p>
          {!loading && stats && (
            <p className="text-sm text-slate-500">
              Середній час читання —{' '}
              <span className="font-bold text-slate-700">
                {stats.turnover > 0 ? `${stats.avgReadingDays} дн.` : '—'}
              </span>
            </p>
          )}
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : !stats?.overdueLoans.length ? (
          <p className="p-5 text-slate-400 text-sm">Прострочених немає</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3 text-left">Читач</th>
                  <th className="px-5 py-3 text-left">Відділ</th>
                  <th className="px-5 py-3 text-left">Книга</th>
                  <th className="px-5 py-3 text-left">Взято</th>
                  <th className="px-5 py-3 text-right">На руках</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.overdueLoans.map(loan => (
                  <tr key={loan._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-slate-700">{loan.user?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {loan.user ? getGroupLabel(loan.user.division, loan.user.group) : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-700">{loan.book?.title ?? '—'}</td>
                    <td className="px-5 py-3 text-slate-500">{fmt(loan.deliveredAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-bold">
                        {loan.daysOnHands} дн.
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
