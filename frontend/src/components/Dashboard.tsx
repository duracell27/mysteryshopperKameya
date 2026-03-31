import React, { useState, useEffect } from 'react';
import { Screen, AuditResult } from '../types';
import { useAuth } from '../context/AuthContext';
import { getMyReports } from '../services/reportsService';
import { getTodayTip, TipOfDay } from '../services/tipsService';
import { formatDate } from '../utils/dateFormatter';

interface DashboardProps {
  onNavigate: (screen: Screen) => void;
  onNavigateToAuditDetails?: (audit: AuditResult) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onNavigateToAuditDetails }) => {
  const { user } = useAuth();
  const fullName = user?.name ?? 'Вітаємо';
  const [lastAudit, setLastAudit] = useState<AuditResult | undefined>();
  const [tip, setTip] = useState<TipOfDay | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMyReports(),
      getTodayTip(),
    ])
      .then(([reports, tipData]) => {
        if (reports.length > 0) {
          setLastAudit(reports[0]);
        }
        setTip(tipData);
      })
      .catch(() => console.error('Помилка завантаження даних'))
      .finally(() => setLoading(false));
  }, []);

  const radius = 54;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = lastAudit
    ? circumference - (lastAudit.totalScore / 100) * circumference
    : circumference;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Вітаємо, {fullName}!</h2>
        <p className="text-slate-500 mt-1">Ось огляд ваших останніх результатів та завдань на сьогодні.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Остання оцінка</p>

          {lastAudit ? (
            <>
              <div className="relative inline-flex items-center justify-center">
                <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
                  <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} className="text-slate-100" r={normalizedRadius} cx={radius} cy={radius} />
                  <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} strokeDasharray={`${circumference} ${circumference}`} style={{ strokeDashoffset }} strokeLinecap="round" className="text-kameya-burgundy transition-all duration-1000 ease-out" r={normalizedRadius} cx={radius} cy={radius} />
                </svg>
                <span className="absolute text-3xl font-bold text-slate-800 tracking-tight">{Math.round(lastAudit.totalScore)}%</span>
              </div>

              <p className="mt-6 text-sm text-slate-500 font-medium">Дата перевірки: {formatDate(lastAudit.date)}</p>
              {lastAudit.store && (
                <p className="text-sm text-slate-500 font-medium">Магазин: {lastAudit.store}</p>
              )}
              <button
                onClick={() => lastAudit && onNavigateToAuditDetails?.(lastAudit)}
                className="mt-4 text-kameya-burgundy font-bold text-sm hover:text-red-900 transition-colors flex items-center space-x-1"
              >
                <span>Детальний звіт</span>
                <i className="fas fa-arrow-right text-xs"></i>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <i className="fas fa-clipboard text-5xl text-slate-200 mb-4"></i>
              <p className="text-slate-500 font-medium">Перевірок ще немає</p>
              <p className="text-xs text-slate-400 mt-2">Ваша перша перевірка з'явиться тут</p>
            </div>
          )}
        </div>

        {/* Training Progress */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 col-span-1 md:col-span-2 flex flex-col">
          <h3 className="font-bold text-lg text-slate-800 mb-6">Ваш план навчання</h3>
          <div className="flex flex-col items-center justify-center py-12 flex-1">
            <i className="fas fa-book text-5xl text-slate-200 mb-4"></i>
            <p className="text-slate-500 font-medium">План навчання не обрано</p>
            <p className="text-xs text-slate-400 mt-2 text-center">Обберіть план навчання, щоб почати</p>
            <button
              onClick={() => onNavigate(Screen.TRAINING_PLAN)}
              className="mt-6 px-6 py-3 bg-kameya-burgundy text-white rounded-xl font-bold hover:bg-red-900 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
            >
              Обрати план навчання
            </button>
          </div>
        </div>
      </div>

      {/* Daily Tip */}
      <div className="bg-kameya-burgundy p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <i className="fas fa-lightbulb"></i>
            Порада дня
          </h3>
          <p className="opacity-90 leading-relaxed text-sm md:text-base font-medium">
            {tip?.content || 'Завантажуємо пораду дня для вас...'}
          </p>
        </div>
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};
