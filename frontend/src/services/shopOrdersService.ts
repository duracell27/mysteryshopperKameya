import { ShopOrder, OrderStatus } from '../types';
import { apiFetch } from './apiFetch';

export const placeOrder = async (productId: string): Promise<{ order: ShopOrder; points: number }> => {
  const res = await apiFetch('/api/shop/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка замовлення');
  }
  return res.json();
};

export const getMyOrders = async (): Promise<ShopOrder[]> => {
  const res = await apiFetch('/api/shop/orders/my');
  if (!res.ok) throw new Error('Помилка завантаження замовлень');
  return res.json();
};

export const getPendingOrdersCount = async (): Promise<number> => {
  const res = await apiFetch('/api/shop/orders/pending-count');
  if (!res.ok) return 0;
  const data = await res.json() as { count: number };
  return data.count;
};

export const getAllOrders = async (params: {
  status?: string; search?: string; page?: number; limit?: number;
}): Promise<{ orders: ShopOrder[]; hasMore: boolean }> => {
  const qs = new URLSearchParams();
  if (params.status && params.status !== 'all') qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const res = await apiFetch(`/api/shop/orders?${qs.toString()}`);
  if (!res.ok) throw new Error('Помилка завантаження замовлень');
  return res.json();
};

export const updateOrderStatus = async (
  id: string, status: OrderStatus, adminNote?: string
): Promise<ShopOrder> => {
  const res = await apiFetch(`/api/shop/orders/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, adminNote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка зміни статусу');
  }
  return res.json();
};
