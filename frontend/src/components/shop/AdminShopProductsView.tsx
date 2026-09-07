import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ShopProduct } from '../../types';
import {
  getAllShopProducts,
  createShopProduct,
  updateShopProduct,
  replaceProductImage,
  deleteShopProduct,
} from '../../services/shopProductsService';

type ProductForm = { name: string; description: string; price: string; quantity: string };
const EMPTY_FORM: ProductForm = { name: '', description: '', price: '', quantity: '0' };

const UAH_PER_POINT = 2;
const uahToPoints = (uah: string): string => {
  const v = parseFloat(uah);
  if (isNaN(v) || v <= 0) return '';
  return String(Math.round(v / UAH_PER_POINT));
};

export const AdminShopProductsView: React.FC = () => {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [priceUah, setPriceUah] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    getAllShopProducts()
      .then(setProducts)
      .catch(() => setError('Помилка завантаження'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
    setPriceUah('');
    setImageFile(null);
    setShowForm(true);
  };

  const openEdit = (p: ShopProduct) => {
    setEditingProduct(p);
    const uah = String(p.price * UAH_PER_POINT);
    setPriceUah(uah);
    setForm({ name: p.name, description: p.description, price: String(p.price), quantity: String(p.quantity) });
    setImageFile(null);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingProduct(null); setForm(EMPTY_FORM); setPriceUah(''); setImageFile(null); setError(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingProduct) {
        await updateShopProduct(editingProduct._id, {
          name: form.name,
          description: form.description,
          price: parseInt(form.price, 10),
          quantity: parseInt(form.quantity, 10),
        });
        if (imageFile) {
          const fd = new FormData();
          fd.append('image', imageFile);
          await replaceProductImage(editingProduct._id, fd);
        }
      } else {
        const fd = new FormData();
        fd.append('name', form.name);
        fd.append('description', form.description);
        fd.append('price', form.price);
        fd.append('quantity', form.quantity);
        if (imageFile) fd.append('image', imageFile);
        await createShopProduct(fd);
      }
      closeForm();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: ShopProduct) => {
    try {
      await updateShopProduct(p._id, { isActive: !p.isActive });
      setProducts(prev => prev.map(x => x._id === p._id ? { ...x, isActive: !p.isActive } : x));
    } catch { setError('Помилка оновлення'); }
  };

  const handleDelete = async (p: ShopProduct) => {
    if (!confirm(`Видалити "${p.name}"?`)) return;
    try {
      const result = await deleteShopProduct(p._id);
      if (result.hidden) {
        setProducts(prev => prev.map(x => x._id === p._id ? { ...x, isActive: false } : x));
        alert('Товар приховано (є повʼязані замовлення)');
      } else {
        setProducts(prev => prev.filter(x => x._id !== p._id));
      }
    } catch { setError('Помилка видалення'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Товари магазину</h2>
          <p className="text-slate-500 mt-1">Управління каталогом</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-kameya-burgundy text-white rounded-xl hover:bg-kameya-burgundy/90 transition-colors">
          <i className="fas fa-plus" />
          Додати товар
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
          {error} <button className="ml-2 underline" onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Фото</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Назва</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Ціна</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Кількість</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Статус</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Немає товарів</td></tr>
              )}
              {products.map(p => (
                <tr key={p._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden flex items-center justify-center">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        : <i className="fas fa-image text-slate-300" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    {p.description && <p className="text-slate-400 text-xs truncate max-w-[200px]">{p.description}</p>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-kameya-burgundy">{p.price} балів</td>
                  <td className="px-4 py-3 text-slate-700">{p.quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {p.isActive ? 'Активний' : 'Прихований'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(p)} className="p-1.5 text-slate-400 hover:text-kameya-burgundy transition-colors" title="Редагувати">
                        <i className="fas fa-pen" />
                      </button>
                      <button onClick={() => handleToggleActive(p)} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors" title={p.isActive ? 'Приховати' : 'Показати'}>
                        <i className={`fas ${p.isActive ? 'fa-eye-slash' : 'fa-eye'}`} />
                      </button>
                      <button onClick={() => handleDelete(p)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors" title="Видалити">
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && createPortal(
        <div className="fixed inset-0 z-[200] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              {editingProduct ? 'Редагувати товар' : 'Додати товар'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Назва *</label>
                <input
                  required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Опис</label>
                <textarea
                  rows={3} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ціна в грн *</label>
                <div className="flex items-center gap-3">
                  <input
                    required type="number" min="1" value={priceUah}
                    onChange={e => {
                      setPriceUah(e.target.value);
                      setForm(f => ({ ...f, price: uahToPoints(e.target.value) }));
                    }}
                    placeholder="190"
                    className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30"
                  />
                  <span className="text-sm text-slate-500 whitespace-nowrap">
                    {form.price ? (
                      <span className="font-semibold text-kameya-burgundy">= {form.price} балів</span>
                    ) : (
                      <span className="text-slate-300">= — балів</span>
                    )}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Кількість</label>
                <input
                  required type="number" min="0" value={form.quantity}
                  onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {editingProduct?.imageUrl ? 'Замінити фото' : 'Фото'}
                </label>
                <input
                  ref={imageInputRef} type="file" accept="image/*"
                  onChange={e => setImageFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
                {editingProduct?.imageUrl && !imageFile && (
                  <img src={editingProduct.imageUrl} alt="" className="mt-2 h-20 w-20 object-cover rounded-lg border border-slate-100" />
                )}
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeForm} disabled={saving}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50">
                  Скасувати
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-kameya-burgundy text-white font-medium hover:bg-kameya-burgundy/90 disabled:opacity-50">
                  {saving ? <i className="fas fa-spinner fa-spin" /> : editingProduct ? 'Зберегти' : 'Додати'}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
