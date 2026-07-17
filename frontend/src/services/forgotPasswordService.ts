import { apiFetch } from './apiFetch';

const apiPost = async (path: string, body: object): Promise<void> => {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || 'Помилка сервера');
  }
};

export const requestForgotCode = (phone: string): Promise<void> =>
  apiPost('/api/auth/forgot/request', { phone });

export const verifyForgotCode = (phone: string, code: string): Promise<void> =>
  apiPost('/api/auth/forgot/verify', { phone, code });

export const confirmForgotPassword = (phone: string, code: string, newPassword: string): Promise<void> =>
  apiPost('/api/auth/forgot/confirm', { phone, code, newPassword });
