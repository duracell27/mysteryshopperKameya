import { apiFetch } from './apiFetch';
import { OnboardingTrainee, AdminDayPlan } from '../types';

// ── Стажер ───────────────────────────────────────────────────────────────────

export const getMyTrainee = async (): Promise<OnboardingTrainee> => {
  const res = await apiFetch('/api/trainees/me');
  if (res.status === 404) throw Object.assign(new Error('no-profile'), { status: 404 });
  if (!res.ok) throw new Error('Помилка завантаження профілю стажера');
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

export const toggleTask = async (taskId: string): Promise<OnboardingTrainee> => {
  const res = await apiFetch(`/api/trainees/me/tasks/${taskId}`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Помилка оновлення задачі');
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

export interface ReflectionPayload {
  q1: number; q2: number; q3: number;
  q4: string; q5: number; comments: string;
}

export const submitReflection = async (day: number, payload: ReflectionPayload): Promise<OnboardingTrainee> => {
  const res = await apiFetch(`/api/trainees/me/days/${day}/reflection`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Помилка збереження рефлексії');
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

// ── Адмін — стажери ──────────────────────────────────────────────────────────

export const getAllTrainees = async (): Promise<OnboardingTrainee[]> => {
  const res = await apiFetch('/api/trainees');
  if (!res.ok) throw new Error('Помилка завантаження стажерів');
  const data = await res.json();
  return data.trainees as OnboardingTrainee[];
};

export const createTrainee = async (userId: string, startDate: string): Promise<OnboardingTrainee> => {
  const res = await apiFetch(`/api/trainees/${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Помилка створення стажера');
  }
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

export const updateTraineeStartDate = async (id: string, startDate: string): Promise<OnboardingTrainee> => {
  const res = await apiFetch(`/api/trainees/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate }),
  });
  if (!res.ok) throw new Error('Помилка оновлення');
  const data = await res.json();
  return data.trainee as OnboardingTrainee;
};

export const deleteTrainee = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/trainees/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення');
};

// ── Адмін — плани ────────────────────────────────────────────────────────────

export const getDayPlans = async (): Promise<AdminDayPlan[]> => {
  const res = await apiFetch('/api/dayplans');
  if (!res.ok) throw new Error('Помилка завантаження планів');
  const data = await res.json();
  return data.dayPlans as AdminDayPlan[];
};

export const createDay = async (day: number, isHoliday = false): Promise<AdminDayPlan> => {
  const res = await apiFetch('/api/dayplans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, isHoliday }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Помилка створення дня');
  }
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

export const deleteDay = async (day: number): Promise<void> => {
  const res = await apiFetch(`/api/dayplans/${day}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення дня');
};

export const addTask = async (
  day: number,
  task: { title: string; description: string; type: string },
): Promise<AdminDayPlan> => {
  const res = await apiFetch(`/api/dayplans/${day}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Помилка додавання задачі');
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

export const updateTask = async (
  day: number,
  taskId: string,
  patch: { title?: string; description?: string; type?: string },
): Promise<AdminDayPlan> => {
  const res = await apiFetch(`/api/dayplans/${day}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Помилка оновлення задачі');
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

export const deleteTask = async (day: number, taskId: string): Promise<AdminDayPlan> => {
  const res = await apiFetch(`/api/dayplans/${day}/tasks/${taskId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення задачі');
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

export const setDayHoliday = async (day: number, isHoliday: boolean): Promise<AdminDayPlan> => {
  const res = await apiFetch(`/api/dayplans/${day}/holiday`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isHoliday }),
  });
  if (!res.ok) throw new Error('Помилка оновлення');
  const data = await res.json();
  return data.dayPlan as AdminDayPlan;
};

// ── AI ───────────────────────────────────────────────────────────────────────

export const analyzeTrainee = async (
  traineeId: string,
  traineeName: string,
  days: OnboardingTrainee['days'],
): Promise<string> => {
  const res = await apiFetch('/api/onboarding-ai/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ traineeId, traineeName, days }),
  });
  if (!res.ok) throw new Error('Помилка AI аналізу');
  const data = await res.json();
  return data.analysis as string;
};
