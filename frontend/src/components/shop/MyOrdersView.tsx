import React, { useState, useEffect } from 'react';
import { ShopOrder, OrderStatus } from '../../types';
import { getMyOrders } from '../../services/shopOrdersService';
import { formatDate } from '../../utils/dateFormatter';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:     'Замовлено',
  in_progress: 'В роботі',
  completed:   'Виконано',
  cancelled:   'Скасовано',
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  pending:     'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-emerald-100 text-emerald-700',
  cancelled:   'bg-slate-100 text-slate-500',
};

export const MyOrdersView: React.FC = () => {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .catch(() => { setError('Не вдалося завантажити замовлення'); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <i className="fas fa-spinner fa-spin text-3xl text-kameya-burgundy" />
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
          {error} <button className="ml-2 underline" onClick={() => setError(null)}>×</button>
        </div>
      )}
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Мої замовлення</h2>
        <p className="text-slate-500 mt-1">Історія ваших замовлень у магазині</p>
      </header>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <i className="fas fa-box-open text-5xl mb-4 block" />
          <p>Замовлень ще немає</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex gap-4 items-center">
              <div className="w-16 h-16 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden">
                {order.productSnapshot.imageUrl ? (
                  <img
                    src={order.productSnapshot.imageUrl}
                    alt={order.productSnapshot.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <i className="fas fa-image text-slate-300 text-xl" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 truncate">{order.productSnapshot.name}</p>
                <p className="text-sm text-slate-500">{order.productSnapshot.price} балів · {formatDate(order.createdAt)}</p>
              </div>
              <span className={`text-xs font-medium px-3 py-1 rounded-full flex-shrink-0 ${STATUS_STYLES[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
