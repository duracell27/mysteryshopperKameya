import { UserListItem } from '../types';

const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('kameya_token') ?? ''}`,
});

export const fetchUsers = async (): Promise<UserListItem[]> => {
  const res = await fetch('/api/users', { headers: getAuthHeaders() });
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
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: getAuthHeaders(),
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
  const res = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка оновлення');
  }
  return res.json();
};

export const deleteUser = async (id: string): Promise<void> => {
  const res = await fetch(`/api/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Помилка видалення');
};
