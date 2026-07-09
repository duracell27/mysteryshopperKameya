import { UserListItem, PointsTransaction, BadgeAward } from '../types';
import { apiFetch } from './apiFetch';

export const fetchUsers = async (): Promise<UserListItem[]> => {
  const res = await apiFetch('/api/users');
  if (!res.ok) throw new Error('Помилка завантаження користувачів');
  return res.json();
};

export interface CreateUserPayload {
  phone: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'EMPLOYEE';
  position?: string;
  store?: string;
}

export const createUser = async (data: CreateUserPayload): Promise<UserListItem> => {
  const res = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка створення користувача');
  }
  return res.json();
};

export interface UpdateUserPayload {
  name?: string;
  role?: 'ADMIN' | 'EMPLOYEE';
  position?: string;
  store?: string;
  password?: string;
}

export const updateUser = async (id: string, data: UpdateUserPayload): Promise<UserListItem> => {
  const res = await apiFetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка оновлення');
  }
  return res.json();
};

export const deleteUser = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення');
};

export const getUserPointsHistory = async (userId: string): Promise<PointsTransaction[]> => {
  const res = await apiFetch(`/api/users/${userId}/points`);
  if (!res.ok) throw new Error('Помилка завантаження історії балів');
  return res.json();
};

export const syncUserPoints = async (userId: string): Promise<UserListItem> => {
  const res = await apiFetch(`/api/users/${userId}/sync-points`, { method: 'POST' });
  if (!res.ok) throw new Error('Помилка синхронізації');
  return res.json();
};

export const getUserBadges = async (userId: string): Promise<BadgeAward[]> => {
  const res = await apiFetch(`/api/users/${userId}/badges`);
  if (!res.ok) throw new Error('Помилка завантаження нагород');
  return res.json();
};

export interface AssignBadgePayload {
  badgeId: string;
  earnedAt?: string;
  year?: number;
}

export const assignBadge = async (userId: string, payload: AssignBadgePayload): Promise<BadgeAward[]> => {
  const res = await apiFetch(`/api/users/${userId}/badges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, manual: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || 'Помилка призначення нагороди');
  }
  return res.json();
};

export const deleteBadge = async (userId: string, awardId: string): Promise<void> => {
  const res = await apiFetch(`/api/users/${userId}/badges/${awardId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення нагороди');
};
