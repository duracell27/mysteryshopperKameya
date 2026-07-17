import { AdminNotification, SystemLogEntry } from '../types';
import { apiFetch } from './apiFetch';

export const getNotifications = async (
  skip = 0,
  search = '',
): Promise<{ notifications: AdminNotification[]; hasMore: boolean; total: number }> => {
  const params = new URLSearchParams({ skip: String(skip), limit: '30' });
  if (search) params.set('search', search);
  const res = await apiFetch(`/api/notifications?${params}`);
  if (!res.ok) throw new Error('Помилка завантаження сповіщень');
  return res.json();
};

export const getUnreadCount = async (): Promise<number> => {
  const res = await apiFetch('/api/notifications/unread-count');
  if (!res.ok) return 0;
  const data: { count: number } = await res.json();
  return data.count;
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const res = await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
  if (!res.ok) throw new Error('Помилка масового оновлення сповіщень');
};

export const markNotificationRead = async (id: string): Promise<AdminNotification> => {
  const res = await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Помилка оновлення сповіщення');
  return res.json();
};

export const getSystemLogs = async (
  skip = 0,
  search = '',
): Promise<{ logs: SystemLogEntry[]; hasMore: boolean; total: number }> => {
  const params = new URLSearchParams({ skip: String(skip), limit: '20' });
  if (search) params.set('search', search);
  const res = await apiFetch(`/api/notifications/system?${params}`);
  if (!res.ok) throw new Error('Помилка завантаження логів');
  return res.json();
};

export const getSystemUnreadCount = async (): Promise<number> => {
  const res = await apiFetch('/api/notifications/system/unread-count');
  if (!res.ok) return 0;
  const data: { count: number } = await res.json();
  return data.count;
};

export const markSystemLogRead = async (id: string): Promise<SystemLogEntry> => {
  const res = await apiFetch(`/api/notifications/system/${id}/read`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Помилка оновлення логу');
  return res.json();
};

export const markAllSystemLogsRead = async (): Promise<void> => {
  const res = await apiFetch('/api/notifications/system/read-all', { method: 'PATCH' });
  if (!res.ok) throw new Error('Помилка масового оновлення логів');
};
