import React, { useState, useEffect } from 'react';
import { AuditResult } from '../types';
import { getMyReports, getMyRank, UserRank } from '../services/reportsService';

interface ProgressViewProps {
  audit?: AuditResult;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ audit }) => {
  const [reports, setReports] = useState<AuditResult[]>([]);
  const [rank, setRank] = useState<UserRank | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getMyReports(),
      getMyRank(),
    ])
      .then(([reportsData, rankData]) => {
        setReports(reportsData);
        setRank(rankData);
      })
      .catch(() => console.error('Помилка завантаження даних'))
      .finally(() => setLoading(false));
  }, []);

  // Обчислюємо загальні баали
  const totalPoints = reports.reduce((sum, r) => sum + (r.totalScore || 0), 0);
  const totalReports = reports.length;
  const hasFirstAudit = totalReports > 0;


  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Досягнення та Бали</h2>
        <p className="text-slate-500">Ваш шлях професійного зростання в Kameya Academy.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-3xl shadow-lg border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="w-24 h-24 bg-kameya-burgundy/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
            <i className="fas fa-gem text-kameya-burgundy text-4xl"></i>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Накопичено балів</p>
          <h3 className="text-6xl font-bold text-kameya-burgundy tracking-tighter">
            {loading ? '...' : Math.round(totalPoints)}
          </h3>
          <p className="mt-4 text-slate-500 text-sm max-w-[200px]">
            З {totalReports} перевірок · {(totalPoints / Math.max(totalReports, 1)).toFixed(0)}% в середньому
          </p>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl"></div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <i className="fas fa-medal text-amber-500"></i>
            Ваші значки
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {hasFirstAudit ? (
              <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center border-2 border-kameya-burgundy transition-all hover:bg-white hover:border-kameya-burgundy">
                <i className="fas fa-star text-3xl mb-2 text-amber-400"></i>
                <p className="text-[10px] font-bold text-slate-800 uppercase">Перша перевірка</p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center transition-all hover:bg-slate-100">
                <i className="fas fa-star text-3xl mb-2 text-slate-300"></i>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Перша перевірка</p>
              </div>
            )}
            <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center transition-all hover:bg-slate-100">
              <i className="fas fa-medal text-3xl mb-2 text-slate-300"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Срібний Гід</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center transition-all hover:bg-slate-100">
              <i className="fas fa-book text-3xl mb-2 text-slate-300"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Студент Року</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center transition-all hover:bg-slate-100">
              <i className="fas fa-crown text-3xl mb-2 text-slate-300"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Експерт Сервісу</p>
            </div>
          </div>
        </div>
      </div>

      {totalReports > 0 && rank && (
        <div className="bg-slate-800 p-8 rounded-3xl text-white shadow-xl">
          <div className="mb-4">
            <h4 className="text-xl font-bold italic text-amber-400">Ви в {rank.tier} мережі!</h4>
            <p className="text-slate-400 text-sm mt-1">
              Ваше місце: <span className="font-semibold text-white">#{rank.rank}</span> з {rank.totalUsers} · Продовжуйте розвиватися та підвищуйте свої результати
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
