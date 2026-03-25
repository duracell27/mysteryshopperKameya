import React from 'react';
import { Screen, AuditResult } from '../types';
import { useAuth } from '../context/AuthContext';

interface DashboardProps {
  lastAudit: AuditResult;
  onNavigate: (screen: Screen) => void;
  onShare: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ lastAudit, onNavigate, onShare }) => {
  const { user } = useAuth();
  const firstName = user?.name.split(' ')[0] ?? 'Вітаємо';

  const radius = 54;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (lastAudit.totalScore / 100) * circumference;

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Вітаємо, {firstName}!</h2>
          <p className="text-slate-500 mt-1">Ось огляд ваших останніх результатів та завдань на сьогодні.</p>
        </div>
        <button
          onClick={onShare}
          className="p-3 bg-white border border-slate-200 rounded-full shadow-sm hover:bg-slate-50 transition-colors"
          title="Поділитися успіхами"
        >
          <i className="fas fa-share-nodes text-slate-500"></i>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Score Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Остання оцінка</p>

          <div className="relative inline-flex items-center justify-center">
            <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
              <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} className="text-slate-100" r={normalizedRadius} cx={radius} cy={radius} />
              <circle stroke="currentColor" fill="transparent" strokeWidth={stroke} strokeDasharray={`${circumference} ${circumference}`} style={{ strokeDashoffset }} strokeLinecap="round" className="text-kameya-burgundy transition-all duration-1000 ease-out" r={normalizedRadius} cx={radius} cy={radius} />
            </svg>
            <span className="absolute text-3xl font-bold text-slate-800 tracking-tight">{lastAudit.totalScore}%</span>
          </div>

          <p className="mt-6 text-sm text-slate-500 font-medium">Дата перевірки: {lastAudit.date}</p>
          <button
            onClick={() => onNavigate(Screen.AUDIT_DETAILS)}
            className="mt-4 text-kameya-burgundy font-bold text-sm hover:text-red-900 transition-colors flex items-center space-x-1"
          >
            <span>Детальний звіт</span>
            <i className="fas fa-arrow-right text-xs"></i>
          </button>
        </div>

        {/* Training Progress */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 col-span-1 md:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-slate-800">Ваш план навчання</h3>
            <span className="text-[10px] bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold uppercase tracking-wider">АКТИВНИЙ</span>
          </div>
          <div className="space-y-6 flex-1">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shadow-inner">
                <i className="fas fa-gem text-kameya-burgundy text-lg"></i>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-slate-800 text-sm">Характеристики дорогоцінного каміння</p>
                  <span className="text-xs font-bold text-slate-400">65%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-kameya-burgundy h-full w-[65%] rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shadow-inner">
                <i className="fas fa-handshake text-blue-500 text-lg"></i>
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-slate-800 text-sm">Техніки виявлення потреб</p>
                  <span className="text-xs font-bold text-slate-400">20%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-kameya-burgundy h-full w-[20%] rounded-full"></div>
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate(Screen.TRAINING_PLAN)}
              className="w-full mt-2 py-4 bg-kameya-burgundy text-white rounded-xl font-bold hover:bg-red-900 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
            >
              Продовжити навчання
            </button>
          </div>
        </div>
      </div>

      {/* Daily Motivation */}
      <div className="bg-kameya-burgundy p-8 rounded-2xl text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
            <i className="fas fa-lightbulb"></i>
            Порада дня: Робота з запереченнями
          </h3>
          <p className="opacity-90 leading-relaxed max-w-2xl text-sm md:text-base font-medium">
            "Заперечення — це не відмова, а запит клієнта на додаткову інформацію. Використовуйте метод 'Приєднання' для встановлення довіри перед аргументацією."
          </p>
        </div>
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};
