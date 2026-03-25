import React from 'react';
import { useAuth } from '../../context/AuthContext';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Панель адміністратора</h2>
        <p className="text-slate-500 mt-1">Вітаємо, {user?.name || user?.phone}</p>
      </header>

      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 flex flex-col items-center justify-center text-center">
        <i className="fas fa-gauge-high text-5xl text-slate-200 mb-4"></i>
        <p className="text-slate-400 font-medium">Дашборд в розробці</p>
        <p className="text-slate-300 text-sm mt-1">Тут з'являться загальна статистика та аналітика</p>
      </div>
    </div>
  );
};
