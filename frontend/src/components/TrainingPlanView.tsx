import React, { useState } from 'react';
import { AIAnalysisResult, DailyTask } from '../types';

interface TrainingPlanViewProps {
  analysis: AIAnalysisResult | null;
  onNavigateToQuiz: (weakness: string) => void;
}

export const TrainingPlanView: React.FC<TrainingPlanViewProps> = ({ analysis, onNavigateToQuiz }) => {
  const [tasks, setTasks] = useState<DailyTask[]>(analysis?.fifteenDayPlan || []);

  const toggleTask = (day: number) => {
    setTasks((prev) => prev.map((t) => (t.day === day ? { ...t, isCompleted: !t.isCompleted } : t)));
  };

  const handleReflectionChange = (day: number, text: string) => {
    setTasks((prev) => prev.map((t) => (t.day === day ? { ...t, reflection: text } : t)));
  };

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border-2 border-dashed border-slate-200">
        <i className="fas fa-chart-line text-4xl text-slate-300 mb-4"></i>
        <p className="text-slate-400 text-lg text-center px-4">
          Спочатку запустіть AI аналіз результатів перевірки, щоб побудувати план 5+10 днів
        </p>
      </div>
    );
  }

  const lessons = tasks.filter((t) => t.day <= 5);
  const coaching = tasks.filter((t) => t.day > 5);

  return (
    <div className="space-y-8 pb-10">
      <header className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-kameya-burgundy mb-3">
          Ваша 15-денна програма «Шлях до досконалості»
        </h2>
        <p className="text-slate-600 leading-relaxed text-sm md:text-base">{analysis.summary}</p>
      </header>

      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <span className="bg-kameya-burgundy text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm">01</span>
          <h3 className="font-bold text-lg text-slate-800">Етап 1: Теоретична база (Дні 1-5)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {lessons.map((task) => (
            <div key={task.day} className={`bg-white p-5 rounded-xl border-2 transition-all ${task.isCompleted ? 'border-green-100 bg-green-50/20' : 'border-slate-100'}`}>
              <div className="flex justify-between items-start mb-3">
                <span className="text-[10px] font-bold uppercase text-slate-400">День {task.day}</span>
                <input type="checkbox" checked={task.isCompleted} onChange={() => toggleTask(task.day)} className="w-5 h-5 accent-kameya-burgundy" />
              </div>
              <h4 className="text-xs font-bold text-slate-800 line-clamp-2 mb-2">{task.title}</h4>
              <p className="text-[10px] text-slate-500 line-clamp-3">{task.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center space-x-2">
          <span className="bg-kameya-burgundy text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm">02</span>
          <h3 className="font-bold text-lg text-slate-800">Етап 2: Практика та рефлексія (Дні 6-15)</h3>
        </div>
        <div className="space-y-4">
          {coaching.map((task) => (
            <div key={task.day} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:border-kameya-burgundy transition-all">
              <div className="flex flex-col md:flex-row md:items-start md:space-x-6">
                <div className="md:w-1/3 mb-4 md:mb-0">
                  <span className="text-xs font-bold text-kameya-burgundy uppercase tracking-wider">День {task.day}: Фокус дня</span>
                  <h4 className="font-bold text-slate-800 mt-1">{task.title}</h4>
                  <p className="text-sm text-slate-500 mt-2 italic">"{task.focusPoint}"</p>
                  <button
                    onClick={() => onNavigateToQuiz(task.title)}
                    className="mt-4 text-xs font-bold text-kameya-burgundy flex items-center space-x-1 hover:underline"
                  >
                    <i className="fas fa-pen-to-square"></i>
                    <span>Перевірити знання (Тест)</span>
                  </button>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Блок рефлексії: Ваші результати за день</label>
                  <textarea
                    placeholder="Як ви сьогодні застосували цю пораду? Що вдалося, а над чим ще варто попрацювати?"
                    className="w-full h-24 p-4 rounded-xl bg-slate-50 border-none text-sm text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-kameya-burgundy/20 outline-none resize-none"
                    value={task.reflection}
                    onChange={(e) => handleReflectionChange(task.day, e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
