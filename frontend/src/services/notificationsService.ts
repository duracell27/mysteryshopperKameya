import { AdminNotification, SystemLogEntry } from '../types';
import { apiFetch } from './apiFetch';

export const getNotifications = async (): Promise<AdminNotification[]> => {
  const res = await apiFetch('/api/notifications');
  if (!res.ok) throw new Error('Помилка завантаження сповіщень');
  return res.json();
};

export const getUnreadCount = async (): Promise<number> => {
  const res = await apiFetch('/api/notifications/unread-count');
  if (!res.ok) return 0;
  const data: { count: number } = await res.json();
  return data.count;
};

export const markNotificationRead = async (id: string): Promise<AdminNotification> => {
  const res = await apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
  if (!res.ok) throw new Error('Помилка оновлення сповіщення');
  return res.json();
};

export const getSystemLogs = async (): Promise<SystemLogEntry[]> => {
  const res = await apiFetch('/api/notifications/system');
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
