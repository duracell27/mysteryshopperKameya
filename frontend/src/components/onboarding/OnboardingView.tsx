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

  const daysUntilStart = Math.ceil((new Date(trainee.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysUntilStart > 0) {
    const startFormatted = new Date(trainee.startDate).toLocaleDateString('uk-UA', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
    return (
      <div className="max-w-lg mx-auto px-4 py-12 flex flex-col items-center text-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-kameya-burgundy/10 flex items-center justify-center">
          <i className="fas fa-gem text-3xl text-kameya-burgundy" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            Привіт, {trainee.name}!
          </h2>
          <p className="text-slate-500 text-sm leading-relaxed">
            Вітаємо в <span className="font-semibold text-kameya-burgundy">Камея</span>.<br />
            Твоє стажування скоро розпочнеться — ми раді бачити тебе серед нас.
          </p>
        </div>

        <div className="w-full bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Початок стажування</span>
            <span className="text-sm font-semibold text-slate-800">{startFormatted}</span>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Залишилось</span>
            <span className="text-sm font-bold text-kameya-burgundy">
              {daysUntilStart} {daysUntilStart === 1 ? 'день' : daysUntilStart < 5 ? 'дні' : 'днів'}
            </span>
          </div>
          <div className="border-t border-slate-100" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Тривалість</span>
            <span className="text-sm font-semibold text-slate-800">14 днів</span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
          Ти отримаєш завдання та план на кожен день. Заходь сюди з першого дня стажування.
        </p>
      </div>
    );
  }

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
  };

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
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
      {/* Стрічка днів — по центру */}
      <div className="flex justify-center">
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
          {trainee.days.map((d) => (
            <DayCard
              key={d.day}
              dayPlan={d}
              isActive={selectedDay === d.day}
              isToday={d.day === trainee.currentDay}
              onClick={() => {
                if (!d.isPreview) setSelectedDay(d.day);
              }}
            />
          ))}
        </div>
      </div>

      {/* Двоколонковий layout */}
      {activeDayData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">

          {/* Ліво: задачі */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-700">
              День {activeDayData.day}
              {activeDayData.isHoliday && <span className="ml-2 text-xs font-normal text-slate-400">· Відпочинок</span>}
            </h3>

            {activeDayData.isPreview ? (
              <div className="py-8 text-center text-sm text-slate-400">
                <i className="fas fa-lock mr-2" />
                Цей день ще не настав
              </div>
            ) : activeDayData.isHoliday ? (
              <div className="py-8 text-center">
                <i className="fas fa-sun text-2xl text-kameya-burgundy mb-2 block" />
                <p className="text-sm font-medium text-slate-600">День відпочинку — ніяких завдань</p>
              </div>
            ) : (
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
                  <p className="text-sm text-slate-400 text-center py-6">Завдань для цього дня не додано</p>
                )}
              </div>
            )}
          </div>

          {/* Право: рефлексія — завжди відкрита */}
          {!activeDayData.isPreview && (
            <ReflectionForm
              key={activeDayData.day}
              existing={activeDayData.reflection}
              onSubmit={handleReflection}
            />
          )}
        </div>
      )}
    </div>
  );
};
