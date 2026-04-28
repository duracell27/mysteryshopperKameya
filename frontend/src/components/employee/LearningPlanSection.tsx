import React, { useState } from 'react';
import { AuditResult, LearningTask } from '../../types';
import { toggleLearningTask } from '../../services/reportsService';

interface Props {
  lastAudit: AuditResult | undefined;
  loading: boolean;
  onPlanUpdated: (updated: AuditResult) => void;
  onNavigateToTraining: () => void;
}

export const LearningPlanSection: React.FC<Props> = ({
  lastAudit,
  loading,
  onPlanUpdated,
  onNavigateToTraining,
}) => {
  const [togglingIndex, setTogglingIndex] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const plan = lastAudit?.learningPlan;
  const reportId = lastAudit?._id ?? lastAudit?.id ?? '';

  const handleToggle = async (taskIndex: number) => {
    if (!lastAudit || togglingIndex !== null) return;
    setTogglingIndex(taskIndex);
    setToggleError(null);

    // Optimistic update
    const optimistic: AuditResult = {
      ...lastAudit,
      learningPlan: lastAudit.learningPlan
        ? {
            ...lastAudit.learningPlan,
            tasks: lastAudit.learningPlan.tasks.map((t, i) =>
              i === taskIndex ? { ...t, isCompleted: !t.isCompleted } : t
            ),
          }
        : undefined,
    };
    onPlanUpdated(optimistic);

    try {
      const updated = await toggleLearningTask(reportId, taskIndex);
      onPlanUpdated(updated);
    } catch {
      onPlanUpdated(lastAudit); // revert
      setToggleError('Не вдалося оновити задачу');
    } finally {
      setTogglingIndex(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[160px]">
        <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy mb-3"></i>
        <p className="text-slate-500 font-medium text-sm">Складаємо ваш план навчання...</p>
        <p className="text-xs text-slate-400 mt-1">Це займе кілька секунд</p>
      </div>
    );
  }

  if (plan && plan.tasks.length > 0) {
    const completed = plan.tasks.filter(t => t.isCompleted).length;
    const total = plan.tasks.length;

    // Group by topicTitle preserving insertion order
    const groups: { topic: string; items: { task: LearningTask; index: number }[] }[] = [];
    const seen = new Map<string, number>();
    plan.tasks.forEach((task, index) => {
      const existing = seen.get(task.topicTitle);
      if (existing !== undefined) {
        groups[existing].items.push({ task, index });
      } else {
        seen.set(task.topicTitle, groups.length);
        groups.push({ topic: task.topicTitle, items: [{ task, index }] });
      }
    });

    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-lg text-slate-800">Ваш план навчання</h3>
          {completed === total && (
            <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
              <i className="fas fa-circle-check"></i> Завершено
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mb-4">{completed}/{total} виконано</p>

        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-6">
          <div
            className="h-1.5 rounded-full bg-kameya-burgundy transition-all duration-500"
            style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%` }}
          />
        </div>

        <div className="space-y-5">
          {groups.map(({ topic, items }) => (
            <div key={topic}>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{topic}</p>
              <div className="space-y-2">
                {items.map(({ task, index }) => (
                  <label
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors select-none ${
                      task.isCompleted
                        ? 'bg-green-50 border-green-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    } ${togglingIndex === index ? 'opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={task.isCompleted}
                      onChange={() => handleToggle(index)}
                      disabled={togglingIndex === index}
                      className="mt-0.5 flex-shrink-0 accent-kameya-burgundy w-4 h-4"
                    />
                    <span
                      className={`text-sm leading-relaxed ${
                        task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'
                      }`}
                    >
                      {task.description}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {toggleError && <p className="text-xs text-red-500 mt-3">{toggleError}</p>}
      </div>
    );
  }

  // Default placeholder
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
      <h3 className="font-bold text-lg text-slate-800 mb-6">Ваш план навчання</h3>
      <div className="flex flex-col items-center justify-center py-12 flex-1">
        <i className="fas fa-book text-5xl text-slate-200 mb-4"></i>
        <p className="text-slate-500 font-medium">План навчання не обрано</p>
        <p className="text-xs text-slate-400 mt-2 text-center">Обберіть план навчання, щоб почати</p>
        <button
          onClick={onNavigateToTraining}
          className="mt-6 px-6 py-3 bg-kameya-burgundy text-white rounded-xl font-bold hover:bg-red-900 shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
        >
          Обрати план навчання
        </button>
      </div>
    </div>
  );
};
