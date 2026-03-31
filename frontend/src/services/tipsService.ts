const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('kameya_token') ?? ''}`,
});

export interface TipOfDay {
  date: string;
  content: string;
}

export const getTodayTip = async (): Promise<TipOfDay> => {
  const res = await fetch('/api/tips/today', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження поради дня');
  return res.json();
};
