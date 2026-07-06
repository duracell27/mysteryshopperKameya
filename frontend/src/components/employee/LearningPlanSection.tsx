import React, { useState, useEffect } from 'react';
import { AuditResult, LearningTask } from '../../types';
import { toggleLearningTask } from '../../services/reportsService';

interface Props {
  lastAudit: AuditResult | undefined;
  loading: boolean;
  onPlanUpdated: (updated: AuditResult) => void;
  onNavigateToTraining: () => void;
}

const MIN_RESPONSE = 300;

function daysRemaining(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export const LearningPlanSection: React.FC<Props> = ({
  lastAudit,
  loading,
  onPlanUpdated,
  onNavigateToTraining,
}) => {
  const [togglingIndex, setTogglingIndex] = useState<number | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});

  const plan = lastAudit?.learningPlan;
  const reportId = lastAudit?._id ?? lastAudit?.id ?? '';

  // Pre-fill responses from saved data when plan loads
  useEffect(() => {
    if (!plan) return;
    setResponses(prev => {
      const next = { ...prev };
      plan.tasks.forEach((task, i) => {
        if (task.response && !next[i]) next[i] = task.response;
      });
      return next;
    });
  }, [plan?.generatedAt]);

  const handleToggle = async (taskIndex: number, currentlyCompleted: boolean) => {
    if (!lastAudit || togglingIndex !== null) return;
    const response = responses[taskIndex] ?? '';

    if (!currentlyCompleted && response.trim().length < MIN_RESPONSE) return;

    setTogglingIndex(taskIndex);
    setToggleError(null);

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
      const updated = await toggleLearningTask(reportId, taskIndex, currentlyCompleted ? undefined : response.trim());
      onPlanUpdated(updated);
    } catch (err) {
      onPlanUpdated(lastAudit);
      setToggleError(err instanceof Error ? err.message : 'Не вдалося оновити задачу');
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

    const deadlineDays = plan.deadline ? daysRemaining(plan.deadline) : null;

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
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg text-slate-800">Ваш план навчання</h3>
            {completed === total && (
              <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <i className="fas fa-circle-check"></i> Завершено
              </span>
            )}
          </div>
          <a
            href="https://study.kameya.com.ua/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-kameya-burgundy text-white text-xs font-bold rounded-lg hover:bg-red-900 transition-colors flex-shrink-0"
          >
            <i className="fas fa-graduation-cap text-[10px]"></i>
            Академія Камея
          </a>
        </div>

        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-400">{completed}/{total} виконано</p>
          {deadlineDays !== null && (
            <span className={`text-xs font-semibold flex items-center gap-1 ${
              deadlineDays < 0
                ? 'text-red-500'
                : deadlineDays <= 2
                ? 'text-amber-500'
                : 'text-slate-400'
            }`}>
              <i className="fas fa-clock text-[10px]"></i>
              {deadlineDays < 0
                ? `Прострочено на ${Math.abs(deadlineDays)} дн.`
                : deadlineDays === 0
                ? 'Сьогодні останній день'
                : `Залишилось ${deadlineDays} дн.`}
            </span>
          )}
        </div>

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
              <div className="space-y-3">
                {items.map(({ task, index }) => {
                  const response = responses[index] ?? '';
                  const responseLen = response.trim().length;
                  const canCheck = task.isCompleted || responseLen >= MIN_RESPONSE;

                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-xl border transition-colors ${
                        task.isCompleted
                          ? 'bg-green-50 border-green-200'
                          : 'bg-slate-50 border-slate-200'
                      } ${togglingIndex === index ? 'opacity-60' : ''}`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={task.isCompleted}
                          onChange={() => handleToggle(index, task.isCompleted)}
                          disabled={togglingIndex === index || !canCheck}
                          className="mt-0.5 flex-shrink-0 accent-kameya-burgundy w-4 h-4 disabled:cursor-not-allowed"
                        />
                        <span
                          className={`text-sm leading-relaxed ${
                            task.isCompleted ? 'text-slate-400 line-through' : 'text-slate-700'
                          }`}
                        >
                          {task.description}
                        </span>
                      </label>

                      {!task.isCompleted && (
                        <div className="mt-3 ml-7">
                          <textarea
                            value={response}
                            onChange={e => setResponses(prev => ({ ...prev, [index]: e.target.value }))}
                            rows={3}
                            placeholder="Напишіть розгорнуту відповідь по цьому завданню..."
                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy resize-none"
                          />
                          <p className={`text-xs mt-1 text-right ${
                            responseLen >= MIN_RESPONSE ? 'text-green-600 font-medium' : 'text-slate-400'
                          }`}>
                            {responseLen}/{MIN_RESPONSE} символів
                            {responseLen >= MIN_RESPONSE && ' ✓'}
                          </p>
                        </div>
                      )}

                      {task.isCompleted && task.response && (
                        <p className="text-xs text-slate-400 mt-2 ml-7 italic line-clamp-2">
                          "{task.response}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {toggleError && <p className="text-xs text-red-500 mt-3">{toggleError}</p>}
      </div>
    );
  }

  const isPerfect = lastAudit?.totalScore === 100;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg text-slate-800">Ваш план навчання</h3>
        <a
          href="https://study.kameya.com.ua/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-kameya-burgundy text-white text-xs font-bold rounded-lg hover:bg-red-900 transition-colors flex-shrink-0"
        >
          <i className="fas fa-graduation-cap text-[10px]"></i>
          Академія Камея
        </a>
      </div>
      <div className="flex flex-col items-center justify-center py-12 flex-1">
        {isPerfect ? (
          <>
            <i className="fas fa-star text-5xl text-amber-300 mb-4"></i>
            <p className="text-slate-700 font-semibold text-center">При ідеальній перевірці план навчання не потрібен</p>
            <p className="text-xs text-slate-400 mt-2 text-center">Ви отримали 100% — продовжуйте в тому ж дусі!</p>
          </>
        ) : (
          <>
            <i className="fas fa-book text-5xl text-slate-200 mb-4"></i>
            <p className="text-slate-500 font-medium">План навчання не обрано</p>
            <p className="text-xs text-slate-400 mt-2 text-center">Обберіть план навчання, щоб почати</p>
            <button
              disabled
              title="План навчання ще в розробці"
              className="mt-6 px-6 py-3 bg-slate-300 text-slate-500 rounded-xl font-bold cursor-not-allowed shadow-sm"
            >
              Генерувати план навчання
            </button>
            <p className="text-xs text-slate-400 mt-2 text-center">Функціонал ще в розробці</p>
          </>
        )}
      </div>
    </div>
  );
};
