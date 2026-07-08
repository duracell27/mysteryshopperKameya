import React from 'react';

export const DevelopmentPlanView: React.FC = () => {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">План розвитку</h2>
        <p className="text-slate-500 mt-1">Твій план росту та завдання для навчання</p>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center py-16 gap-4">
        <i className="fas fa-tools text-5xl text-slate-200"></i>
        <p className="text-slate-700 font-semibold">План навчання ще в розробці</p>
        <p className="text-xs text-slate-400 text-center max-w-xs">
          Незабаром тут з'явиться ваш персональний план навчання
        </p>
      </div>
    </div>
  );
};
