import React, { useEffect, useState } from 'react';
import { getDashboardStats, DashboardStats } from '../../services/reportsService';
import { scoreTextClass } from '../../utils/scoreColor';

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
);

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setStats)
      .catch(err => setError(err instanceof Error ? err.message : 'Помилка'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Панель адміністратора</h2>
        <p className="text-slate-500 mt-1">Статистика мережі {stats?.year ?? new Date().getFullYear()}</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <i className="fas fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      {/* ── Рядок 1: два загальних показники ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Загальний бал по мережі */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Загальний бал по мережі
          </p>
          {loading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <p className={`text-4xl font-bold ${stats?.networkAvg != null ? scoreTextClass(stats.networkAvg) : 'text-slate-300'}`}>
              {stats?.networkAvg != null ? `${stats.networkAvg}%` : '—'}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-2">Всі перевірки {stats?.year ?? ''}</p>
        </div>

        {/* Бал по останньому кварталу */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Бал по {loading ? '...' : (stats?.latestQ ?? 'останньому Q')}
          </p>
          {loading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <p className={`text-4xl font-bold ${stats?.latestQAvg != null ? scoreTextClass(stats.latestQAvg) : 'text-slate-300'}`}>
              {stats?.latestQAvg != null ? `${stats.latestQAvg}%` : '—'}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-2">
            {stats?.latestQ ? `Останній квартал з даними` : 'Немає даних'}
          </p>
        </div>
      </div>

      {/* ── Рядок 2: два рейтинги ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Рейтинг по магазинах */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Рейтинг по відділах — {stats?.year ?? ''}
          </p>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !stats?.storeRanking.length ? (
            <p className="text-slate-400 text-sm">Немає даних</p>
          ) : (
            <div className="space-y-2">
              {stats.storeRanking.map((row, i) => (
                <div key={row.store} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{row.store}</span>
                      <span className={`text-sm font-bold ml-2 flex-shrink-0 ${scoreTextClass(row.avg)}`}>
                        {row.avg}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          row.avg >= 95 ? 'bg-green-500' : row.avg >= 85 ? 'bg-blue-500' : row.avg >= 75 ? 'bg-amber-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${row.avg}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 w-14 text-right">
                    {row.count} пер.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Рейтинг по консультантах */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
            Рейтинг по консультантах — {stats?.year ?? ''}
          </p>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !stats?.consultantRanking.length ? (
            <p className="text-slate-400 text-sm">Немає даних</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {stats.consultantRanking.map((row, i) => (
                <div key={row.name + i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{row.name}</span>
                      <span className={`text-sm font-bold ml-2 flex-shrink-0 ${scoreTextClass(row.avg)}`}>
                        {row.avg}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${
                          row.avg >= 95 ? 'bg-green-500' : row.avg >= 85 ? 'bg-blue-500' : row.avg >= 75 ? 'bg-amber-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${row.avg}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 w-14 text-right">
                    {row.count} пер.
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
