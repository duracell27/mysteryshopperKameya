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

export const requestResetCode = (): Promise<void> =>
  apiPost('/api/auth/request-reset-code', {});

export const verifyResetCode = (code: string): Promise<void> =>
  apiPost('/api/auth/verify-reset-code', { code });

export const confirmReset = (code: string, newPassword: string): Promise<void> =>
  apiPost('/api/auth/confirm-reset', { code, newPassword });
