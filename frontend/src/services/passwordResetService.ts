const apiPost = async (path: string, body: object): Promise<void> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message || 'Помилка сервера');
  }
};

export const requestResetCode = (phone: string): Promise<void> =>
  apiPost('/api/auth/request-reset-code', { phone });

export const confirmReset = (
  phone: string,
  code: string,
  newPassword: string,
): Promise<void> => apiPost('/api/auth/confirm-reset', { phone, code, newPassword });
