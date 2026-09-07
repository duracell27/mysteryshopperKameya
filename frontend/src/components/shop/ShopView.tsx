import React, { useState, useEffect } from 'react';
import { ShopProduct } from '../../types';
import { getShopProducts } from '../../services/shopProductsService';
import { placeOrder } from '../../services/shopOrdersService';
import { useAuth } from '../../context/AuthContext';

interface ShopViewProps {
  onPointsUpdate: (newPoints: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  available:   'bg-emerald-100 text-emerald-700',
  unavailable: 'bg-slate-100 text-slate-500',
};

export const ShopView: React.FC<ShopViewProps> = ({ onPointsUpdate }) => {
  const { user } = useAuth();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmProduct, setConfirmProduct] = useState<ShopProduct | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    getShopProducts()
      .then(setProducts)
      .catch(() => setError('Не вдалося завантажити товари'))
      .finally(() => setLoading(false));
  }, []);

  const handleOrder = async () => {
    if (!confirmProduct) return;
    setOrdering(true);
    try {
      const { points } = await placeOrder(confirmProduct._id);
      onPointsUpdate(points);
      setProducts(prev => prev.map(p =>
        p._id === confirmProduct._id ? { ...p, quantity: p.quantity - 1 } : p
      ));
      setSuccessMsg(`Замовлення "${confirmProduct.name}" успішно оформлено!`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка замовлення');
    } finally {
      setOrdering(false);
      setConfirmProduct(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy" />
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Магазин винагород</h2>
        <p className="text-slate-500 mt-1">
          Ваш баланс: <span className="font-semibold text-kameya-burgundy">{user?.points ?? 0} балів</span>
        </p>
      </header>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl">
          <i className="fas fa-check-circle mr-2" />{successMsg}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
          <i className="fas fa-exclamation-circle mr-2" />{error}
          <button className="ml-2 underline" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <i className="fas fa-store text-5xl mb-4 block" />
          <p>Товари відсутні</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => {
            const outOfStock = product.quantity === 0;
            const noPoints   = (user?.points ?? 0) < product.price;
            const disabled   = outOfStock || noPoints;
            return (
              <div
                key={product._id}
                className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col ${
                  outOfStock ? 'opacity-60 grayscale' : 'border-slate-100'
                }`}
              >
                <div className="h-44 bg-slate-100 flex items-center justify-center overflow-hidden">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <i className="fas fa-image text-4xl text-slate-300" />
                  )}
                </div>
                <div className="p-4 flex flex-col flex-1 gap-2">
                  <h3 className="font-semibold text-slate-800 text-lg leading-tight">{product.name}</h3>
                  {product.description && (
                    <p className="text-slate-500 text-sm line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-auto">
                    <span className="font-bold text-kameya-burgundy text-xl">{product.price} балів</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      outOfStock ? STATUS_COLORS.unavailable : STATUS_COLORS.available
                    }`}>
                      {outOfStock ? 'Немає в наявності' : `Залишок: ${product.quantity}`}
                    </span>
                  </div>
                  <button
                    disabled={disabled}
                    onClick={() => setConfirmProduct(product)}
                    className={`mt-2 w-full py-2 rounded-xl font-medium transition-colors ${
                      disabled
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-kameya-burgundy text-white hover:bg-kameya-burgundy/90'
                    }`}
                    title={outOfStock ? 'Немає в наявності' : noPoints ? 'Недостатньо балів' : ''}
                  >
                    {outOfStock ? 'Немає в наявності' : noPoints ? 'Недостатньо балів' : 'Замовити'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm modal */}
      {confirmProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-800">Підтвердження замовлення</h3>
            <p className="text-slate-600">
              Замовити <strong>{confirmProduct.name}</strong>?<br />
              З вашого рахунку буде списано{' '}
              <strong className="text-kameya-burgundy">{confirmProduct.price} балів</strong>.<br />
              Залишок: <strong>{(user?.points ?? 0) - confirmProduct.price} балів</strong>.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmProduct(null)}
                disabled={ordering}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={handleOrder}
                disabled={ordering}
                className="flex-1 py-2 rounded-xl bg-kameya-burgundy text-white font-medium hover:bg-kameya-burgundy/90 transition-colors disabled:opacity-50"
              >
                {ordering ? <i className="fas fa-spinner fa-spin" /> : 'Замовити'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
