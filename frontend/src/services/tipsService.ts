import { apiFetch } from './apiFetch';

export interface TipOfDay {
  date: string;
  content: string;
}

export const getTodayTip = async (): Promise<TipOfDay> => {
  const res = await apiFetch('/api/tips/today');
  if (!res.ok) throw new Error('Помилка завантаження поради дня');
  return res.json();
};
