import { AdminNotification, SystemLogEntry } from '../types';

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('kameya_token') ?? ''}`,
});

export const getNotifications = async (): Promise<AdminNotification[]> => {
  const res = await fetch('/api/notifications', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження сповіщень');
  return res.json();
};

export const getUnreadCount = async (): Promise<number> => {
  const res = await fetch('/api/notifications/unread-count', { headers: getAuthHeaders() });
  if (!res.ok) return 0;
  const data: { count: number } = await res.json();
  return data.count;
};

export const markNotificationRead = async (id: string): Promise<AdminNotification> => {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Помилка оновлення сповіщення');
  return res.json();
};

export const getSystemLogs = async (): Promise<SystemLogEntry[]> => {
  const res = await fetch('/api/notifications/system', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження логів');
  return res.json();
};

export const getSystemUnreadCount = async (): Promise<number> => {
  const res = await fetch('/api/notifications/system/unread-count', { headers: getAuthHeaders() });
  if (!res.ok) return 0;
  const data: { count: number } = await res.json();
  return data.count;
};

export const markSystemLogRead = async (id: string): Promise<SystemLogEntry> => {
  const res = await fetch(`/api/notifications/system/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Помилка оновлення логу');
  return res.json();
};

export const markAllSystemLogsRead = async (): Promise<void> => {
  const res = await fetch('/api/notifications/system/read-all', {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Помилка масового оновлення логів');
};
