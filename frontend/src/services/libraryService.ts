import { apiFetch } from './apiFetch';
import { BookGenre, Book, BookLoan } from '../types';

// Genres
export const getGenres = async (): Promise<BookGenre[]> => {
  const res = await apiFetch('/api/library/genres');
  if (!res.ok) throw new Error('Помилка завантаження жанрів');
  return res.json();
};

export const createGenre = async (name: string): Promise<BookGenre> => {
  const res = await apiFetch('/api/library/genres', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка створення жанру');
  }
  return res.json();
};

export const updateGenre = async (id: string, name: string): Promise<BookGenre> => {
  const res = await apiFetch(`/api/library/genres/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка оновлення жанру');
  }
  return res.json();
};

export const deleteGenre = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/library/genres/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка видалення жанру');
  }
};

// Books
export const getBooks = async (params?: {
  genre?: string; status?: 'available' | 'borrowed'; search?: string; page?: number; includeInactive?: boolean;
}): Promise<(Book & { isBorrowed: boolean })[]> => {
  const q = new URLSearchParams();
  if (params?.genre)            q.set('genre',           params.genre);
  if (params?.status)           q.set('status',          params.status);
  if (params?.search)           q.set('search',          params.search);
  if (params?.page)             q.set('page',            String(params.page));
  if (params?.includeInactive)  q.set('includeInactive', 'true');
  const res = await apiFetch(`/api/library/books?${q}`);
  if (!res.ok) throw new Error('Помилка завантаження книг');
  return res.json();
};

export const createBook = async (formData: FormData): Promise<Book> => {
  const res = await apiFetch('/api/library/books', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка створення книги');
  }
  return res.json();
};

export const updateBook = async (id: string, data: FormData | Record<string, unknown>): Promise<Book> => {
  let body: FormData;
  if (data instanceof FormData) {
    body = data;
  } else {
    body = new FormData();
    for (const [k, v] of Object.entries(data)) {
      body.append(k, String(v));
    }
  }
  const res = await apiFetch(`/api/library/books/${id}`, { method: 'PUT', body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка оновлення книги');
  }
  return res.json();
};

export const deactivateBook = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/library/books/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка деактивації книги');
  }
};

// Loans
export const requestLoan = async (bookId: string): Promise<BookLoan> => {
  const res = await apiFetch('/api/library/loans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка замовлення книги');
  }
  return res.json();
};

export const getMyLoans = async (): Promise<BookLoan[]> => {
  const res = await apiFetch('/api/library/loans/my');
  if (!res.ok) throw new Error('Помилка завантаження позик');
  return res.json();
};

export const getAllLoans = async (params?: {
  status?: string; overdue?: boolean; search?: string; page?: number;
}): Promise<{ loans: BookLoan[]; hasMore: boolean }> => {
  const q = new URLSearchParams();
  if (params?.status)            q.set('status',  params.status);
  if (params?.overdue)           q.set('overdue', 'true');
  if (params?.search)            q.set('search',  params.search);
  if (params?.page !== undefined) q.set('page',    String(params.page));
  const res = await apiFetch(`/api/library/loans?${q}`);
  if (!res.ok) throw new Error('Помилка завантаження позик');
  return res.json();
};

export const deliverLoan = async (id: string): Promise<BookLoan> => {
  const res = await apiFetch(`/api/library/loans/${id}/deliver`, { method: 'PATCH' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка підтвердження видачі');
  }
  return res.json();
};

export const extendLoan = async (id: string, days: number): Promise<BookLoan> => {
  const res = await apiFetch(`/api/library/loans/${id}/extend`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ days }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка подовження терміну');
  }
  return res.json();
};

export const requestReturn = async (id: string, rating?: number): Promise<BookLoan> => {
  const res = await apiFetch(`/api/library/loans/${id}/request-return`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка запиту на повернення');
  }
  return res.json();
};

export const confirmReturn = async (id: string): Promise<BookLoan> => {
  const res = await apiFetch(`/api/library/loans/${id}/confirm-return`, { method: 'PATCH' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка підтвердження повернення');
  }
  return res.json();
};

export const cancelLoan = async (id: string): Promise<BookLoan> => {
  const res = await apiFetch(`/api/library/loans/${id}/cancel`, { method: 'PATCH' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка скасування');
  }
  return res.json();
};
