import React from 'react';
import { OnboardingDay } from '../../types';

interface DayCardProps {
  dayPlan: OnboardingDay;
  isActive: boolean;
  isToday: boolean;
  onClick: () => void;
}

export const DayCard: React.FC<DayCardProps> = ({ dayPlan, isActive, isToday, onClick }) => {
  const { day, isHoliday, isPreview, tasks } = dayPlan;
  const allDone = tasks.length > 0 && tasks.every((t) => t.completed);

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center min-w-[76px] h-[96px] rounded-xl border-2 transition-all duration-200 shrink-0
        ${isActive
          ? 'border-kameya-burgundy bg-kameya-burgundy text-white scale-105 shadow-lg'
          : isPreview
          ? 'border-slate-200 bg-slate-50 text-slate-300 opacity-60 cursor-default'
          : allDone
          ? 'border-green-300 bg-green-50 text-green-700 hover:border-green-400'
          : 'border-slate-200 bg-white text-slate-500 hover:border-kameya-burgundy/40'}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide mb-0.5">День</span>
      <span className="text-2xl font-bold leading-none">{day}</span>

      {isToday && !isActive && (
        <span className="absolute bottom-1.5 text-[8px] font-bold text-kameya-burgundy uppercase tracking-wide">
          Сьогодні
        </span>
      )}
      {isToday && isActive && (
        <span className="absolute bottom-1.5 text-[8px] font-bold text-white/80 uppercase tracking-wide">
          Сьогодні
        </span>
      )}
      {isHoliday && !isActive && (
        <span className="absolute bottom-1.5 text-[8px] text-slate-400 font-medium">Відпочинок</span>
      )}
      {!isPreview && allDone && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center">
          <i className="fas fa-check text-white text-[8px]" />
        </div>
      )}
    </button>
  );
};
