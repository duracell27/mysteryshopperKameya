import React, { useEffect, useState } from 'react';
import { OnboardingTrainee } from '../../types';
import { getMyTrainee, toggleTask, submitReflection, ReflectionPayload } from '../../services/onboardingService';
import { DayCard } from './DayCard';
import { TaskItem } from './TaskItem';
import { ReflectionForm } from './ReflectionForm';

interface OnboardingViewProps {
  track: '14' | '30' | '60';
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ track }) => {
  const [trainee, setTrainee] = useState<OnboardingTrainee | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showReflection, setShowReflection] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    getMyTrainee()
      .then((data) => {
        setTrainee(data);
        setSelectedDay(data.currentDay ?? (data.days[0]?.day ?? null));
      })
      .catch((err: any) => {
        if (err.status === 404) setNoProfile(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy" />
      </div>
    );
  }

  if (noProfile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-kameya-burgundy/10 flex items-center justify-center mb-4">
          <i className="fas fa-user-clock text-2xl text-kameya-burgundy" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Онбординг — 14 днів</h2>
        <p className="text-slate-400 text-sm">Ваш профіль стажера ще не створено. Зверніться до адміністратора.</p>
      </div>
    );
  }

  if (!trainee) return null;

  const activeDayData = trainee.days.find((d) => d.day === selectedDay);

  const handleToggle = async (taskId: string) => {
    setToggling(taskId);
    try {
      const updated = await toggleTask(taskId);
      setTrainee(updated);
    } finally {
      setToggling(null);
    }
  };

  const handleReflection = async (data: ReflectionPayload) => {
    if (selectedDay === null) return;
    const updated = await submitReflection(selectedDay, data);
    setTrainee(updated);
    setShowReflection(false);
  };

  const completedDays = trainee.days.filter(
    (d) => d.tasks.length > 0 && d.tasks.every((t) => t.completed),
  ).length;

  if (track !== '14') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-kameya-burgundy/10 flex items-center justify-center mb-4">
          <i className="fas fa-user-clock text-2xl text-kameya-burgundy" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Онбординг — {track} днів</h2>
        <p className="text-slate-400 text-sm">Розділ в розробці</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Заголовок */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Онбординг 14 днів</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {trainee.isCompleted
                ? 'Стажування завершено'
                : `День ${trainee.currentDay ?? '—'} з ${trainee.days.length}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-kameya-burgundy">{completedDays}</p>
            <p className="text-xs text-slate-400">днів виконано</p>
          </div>
        </div>
        {/* Прогрес-бар */}
        <div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-kameya-burgundy rounded-full transition-all"
            style={{ width: `${Math.round((completedDays / trainee.days.length) * 100)}%` }}
          />
        </div>
      </div>

      {/* Стрічка днів */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {trainee.days.map((d) => (
          <DayCard
            key={d.day}
            dayPlan={d}
            isActive={selectedDay === d.day}
            isToday={d.day === trainee.currentDay}
            onClick={() => {
              if (!d.isPreview) {
                setSelectedDay(d.day);
                setShowReflection(false);
              }
            }}
          />
        ))}
      </div>

      {/* Деталі дня */}
      {activeDayData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800">
              День {activeDayData.day}
              {activeDayData.isHoliday && (
                <span className="ml-2 text-xs font-normal text-slate-400">· Відпочинок</span>
              )}
            </h3>
          </div>

          {activeDayData.isPreview ? (
            <div className="bg-slate-50 rounded-xl p-4 text-center text-sm text-slate-400">
              <i className="fas fa-lock mr-2" />
              Цей день ще не настав
            </div>
          ) : activeDayData.isHoliday ? (
            <div className="bg-kameya-burgundy/5 rounded-xl p-6 text-center">
              <i className="fas fa-sun text-2xl text-kameya-burgundy mb-2 block" />
              <p className="text-sm font-medium text-slate-600">День відпочинку — нікого завдань</p>
            </div>
          ) : (
            <>
              {/* Задачі */}
              <div className="space-y-2">
                {activeDayData.tasks.map((task) => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    disabled={toggling === task.id}
                    onToggle={handleToggle}
                  />
                ))}
                {activeDayData.tasks.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Завдань для цього дня не додано</p>
                )}
              </div>

              {/* Рефлексія */}
              <div className="pt-2">
                {showReflection ? (
                  <ReflectionForm
                    existing={activeDayData.reflection}
                    onSubmit={handleReflection}
                    onCancel={() => setShowReflection(false)}
                  />
                ) : activeDayData.reflection ? (
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-slate-700">Рефлексія заповнена</span>
                      <button
                        onClick={() => setShowReflection(true)}
                        className="text-xs text-kameya-burgundy hover:underline"
                      >
                        Редагувати
                      </button>
                    </div>
                    <div className="grid grid-cols-4 gap-3 text-center">
                      {(['q1','q2','q3','q5'] as const).map((key) => (
                        <div key={key} className="bg-white rounded-lg p-2 border border-slate-100">
                          <p className="text-xl font-bold text-kameya-burgundy">
                            {activeDayData.reflection![key]}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">з 5</p>
                        </div>
                      ))}
                    </div>
                    {activeDayData.reflection.comments && (
                      <p className="text-xs text-slate-500 mt-3 italic">
                        "{activeDayData.reflection.comments}"
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReflection(true)}
                    className="w-full py-3 rounded-xl border-2 border-dashed border-kameya-burgundy/30 text-sm text-kameya-burgundy font-medium hover:bg-kameya-burgundy/5 transition-colors"
                  >
                    <i className="fas fa-pen-to-square mr-2" />
                    Заповнити рефлексію дня
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
