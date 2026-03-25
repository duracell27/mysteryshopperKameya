import React from 'react';
import { AuditResult } from '../types';

interface ProgressViewProps {
  audit: AuditResult;
  onShare: () => void;
}

export const ProgressView: React.FC<ProgressViewProps> = ({ audit, onShare }) => {
  const points = audit.totalScore;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Досягнення та Бали</h2>
          <p className="text-slate-500">Ваш шлях професійного зростання в Kameya Academy.</p>
        </div>
        <button
          onClick={onShare}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 active:translate-y-0"
        >
          <i className="fas fa-trophy"></i>
          <span>Поділитися успіхами</span>
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-10 rounded-3xl shadow-lg border border-slate-100 flex flex-col items-center justify-center text-center relative overflow-hidden group">
          <div className="w-24 h-24 bg-kameya-burgundy/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
            <i className="fas fa-gem text-kameya-burgundy text-4xl"></i>
          </div>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-2">Накопичено балів</p>
          <h3 className="text-6xl font-bold text-kameya-burgundy tracking-tighter">{points}</h3>
          <p className="mt-4 text-slate-500 text-sm max-w-[200px]">
            Бали нараховуються за результати перевірок та проходження тестів.
          </p>
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl"></div>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-lg border border-slate-100">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <i className="fas fa-medal text-amber-500"></i>
            Ваші значки
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center transition-all hover:bg-slate-100">
              <i className="fas fa-medal text-3xl mb-2 text-slate-300"></i>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Срібний Гід</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 flex flex-col items-center text-center border-2 border-kameya-burgundy/10 transition-all hover:bg-white hover:border-kameya-burgundy">
              <i className="fas fa-star text-3xl mb-2 text-amber-400"></i>
              <p className="text-[10px] font-bold text-slate-800 uppercase">Перша перевірка</p>
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

      <div className="bg-slate-800 p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row items-center justify-between">
        <div className="mb-4 md:mb-0">
          <h4 className="text-xl font-bold italic text-amber-400">Ви в Топ-10 мережі!</h4>
          <p className="text-slate-400 text-sm mt-1">Ви випереджаєте 85% колег за цим показником.</p>
        </div>
        <div className="flex -space-x-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-10 h-10 rounded-full border-2 border-slate-800 bg-slate-600 flex items-center justify-center text-xs font-bold">
              {String.fromCharCode(64 + i)}
            </div>
          ))}
          <div className="w-10 h-10 rounded-full border-2 border-slate-800 bg-kameya-burgundy flex items-center justify-center text-xs font-bold">
            Ви
          </div>
        </div>
      </div>
    </div>
  );
};
