import { AuthUser } from '../types';

export const loginApi = async (
  phone: string,
  password: string
): Promise<{ token: string; user: AuthUser }> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Помилка входу');
  }

  return response.json();
};
