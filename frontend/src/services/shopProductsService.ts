import { ShopProduct } from '../types';
import { apiFetch } from './apiFetch';

export const getShopProducts = async (): Promise<ShopProduct[]> => {
  const res = await apiFetch('/api/shop/products');
  if (!res.ok) throw new Error('Помилка завантаження товарів');
  return res.json();
};

export const getAllShopProducts = async (): Promise<ShopProduct[]> => {
  const res = await apiFetch('/api/shop/products/all');
  if (!res.ok) throw new Error('Помилка завантаження товарів');
  return res.json();
};

export const createShopProduct = async (formData: FormData): Promise<ShopProduct> => {
  const res = await apiFetch('/api/shop/products', { method: 'POST', body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Помилка створення товару');
  }
  return res.json();
};

export const updateShopProduct = async (
  id: string,
  data: Partial<Pick<ShopProduct, 'name' | 'description' | 'price' | 'quantity' | 'isActive'>>
): Promise<ShopProduct> => {
  const res = await apiFetch(`/api/shop/products/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Помилка оновлення товару');
  return res.json();
};

export const replaceProductImage = async (id: string, formData: FormData): Promise<{ imageUrl: string }> => {
  const res = await apiFetch(`/api/shop/products/${id}/image`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Помилка завантаження зображення');
  return res.json();
};

export const deleteShopProduct = async (id: string): Promise<{ deleted?: boolean; hidden?: boolean; message?: string }> => {
  const res = await apiFetch(`/api/shop/products/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Помилка видалення товару');
  return res.json();
};
