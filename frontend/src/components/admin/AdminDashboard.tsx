import React, { useEffect, useState, useCallback } from 'react';
import { getDashboardStats, DashboardStats } from '../../services/reportsService';
import { scoreTextClass, scoreBarBgClass, formatScore } from '../../utils/scoreColor';

type PeriodType = 'month' | 'quarter' | 'year';

const MONTHS_UK = ['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];

function getCurrentQuarter(): string {
  const m = new Date().getMonth();
  if (m < 3) return 'Q1';
  if (m < 6) return 'Q2';
  if (m < 9) return 'Q3';
  return 'Q4';
}

function quarterToNum(q: string): number {
  return Number(q[1]);
}

function numToQuarter(n: number): string {
  return `Q${n}`;
}

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-100 rounded-xl ${className}`} />
);

export const AdminDashboard: React.FC = () => {
  const now = new Date();
  const [periodType, setPeriodType] = useState<PeriodType>('quarter');
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(() => {
    setLoading(true);
    setError(null);
    getDashboardStats({ periodType, year, quarter, month })
      .then(setStats)
      .catch(err => setError(err instanceof Error ? err.message : 'Помилка'))
      .finally(() => setLoading(false));
  }, [periodType, year, quarter, month]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const periodLabel = periodType === 'year'
    ? String(year)
    : periodType === 'quarter'
    ? `${quarter} ${year}`
    : `${MONTHS_UK[month - 1]} ${year}`;

  const maxYear = now.getFullYear();
  const maxMonth = now.getMonth() + 1;
  const maxQuarter = getCurrentQuarter();

  const isAtMaxPeriod = (() => {
    if (periodType === 'year') return year >= maxYear;
    if (periodType === 'quarter') return year >= maxYear && quarterToNum(quarter) >= quarterToNum(maxQuarter);
    return year >= maxYear && month >= maxMonth;
  })();

  const goPrev = () => {
    if (periodType === 'year') { setYear(y => y - 1); return; }
    if (periodType === 'quarter') {
      const qn = quarterToNum(quarter);
      if (qn === 1) { setQuarter('Q4'); setYear(y => y - 1); }
      else setQuarter(numToQuarter(qn - 1));
      return;
    }
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goNext = () => {
    if (isAtMaxPeriod) return;
    if (periodType === 'year') { setYear(y => y + 1); return; }
    if (periodType === 'quarter') {
      const qn = quarterToNum(quarter);
      if (qn === 4) { setQuarter('Q1'); setYear(y => y + 1); }
      else setQuarter(numToQuarter(qn + 1));
      return;
    }
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Панель адміністратора</h2>
          <p className="text-slate-500 mt-1">Статистика мережі</p>
        </div>

        {/* Period type tabs */}
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(['month', 'quarter', 'year'] as PeriodType[]).map(pt => (
            <button
              key={pt}
              onClick={() => setPeriodType(pt)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                periodType === pt
                  ? 'bg-white text-kameya-burgundy shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {pt === 'month' ? 'Місяць' : pt === 'quarter' ? 'Квартал' : 'Рік'}
            </button>
          ))}
        </div>
      </header>

      {/* Period navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={goPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <i className="fas fa-chevron-left text-slate-500 text-xs"></i>
        </button>
        <span className="text-base font-bold text-slate-700 min-w-[140px] text-center">{periodLabel}</span>
        <button
          onClick={goNext}
          disabled={isAtMaxPeriod}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <i className="fas fa-chevron-right text-slate-500 text-xs"></i>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <i className="fas fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      {/* ── Рядок 1: два показники ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Середній бал
          </p>
          {loading ? (
            <Skeleton className="h-10 w-24" />
          ) : (
            <p className={`text-4xl font-bold ${stats?.periodAvg != null ? scoreTextClass(stats.periodAvg) : 'text-slate-300'}`}>
              {stats?.periodAvg != null ? formatScore(stats.periodAvg) : '—'}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-2">{periodLabel}</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Кількість перевірок
          </p>
          {loading ? (
            <Skeleton className="h-10 w-16" />
          ) : (
            <p className="text-4xl font-bold text-slate-700">
              {stats?.reportCount ?? '—'}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-2">{periodLabel}</p>
        </div>
      </div>

      {/* ── Рядок 2: три рейтинги ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Рейтинг по магазинах */}
        <div className="bg-white py-4 px-3 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Рейтинг по відділах
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
                        {formatScore(row.avg)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${scoreBarBgClass(row.avg)}`}
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
        <div className="bg-white py-4 px-3 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Рейтинг по консультантах
          </p>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !stats?.consultantRanking.length ? (
            <p className="text-slate-400 text-sm">Немає даних</p>
          ) : (
            <div className="space-y-2">
              {stats.consultantRanking.map((row, i) => (
                <div key={row.name + i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-5 text-right flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 truncate">{row.name}</span>
                      <span className={`text-sm font-bold ml-2 flex-shrink-0 ${scoreTextClass(row.avg)}`}>
                        {formatScore(row.avg)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-500 ${scoreBarBgClass(row.avg)}`}
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

        {/* Рейтинг по балах */}
        <div className="bg-white py-4 px-3 rounded-2xl shadow-sm border border-slate-100">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Рейтинг по балах загальний
          </p>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
            </div>
          ) : !stats?.pointsRanking.length ? (
            <p className="text-slate-400 text-sm">Немає даних</p>
          ) : (
            <div className="space-y-2">
              {stats.pointsRanking.map((row, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                  <div key={row._id} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400 w-5 text-right flex-shrink-0">
                      {medal ?? i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{row.name}</p>
                      {row.store && (
                        <p className="text-xs text-slate-400 truncate">{row.store}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-kameya-burgundy flex-shrink-0 flex items-center gap-1">
                      <i className="fas fa-gem text-xs" />
                      {row.points}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
