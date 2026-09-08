import React, { useState, useEffect, useCallback } from 'react';
import { ShopOrder, OrderStatus } from '../../types';
import { getAllOrders, updateOrderStatus } from '../../services/shopOrdersService';
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

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending:     ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

const FILTER_TABS: { key: string; label: string }[] = [
  { key: 'all',         label: 'Всі' },
  { key: 'pending',     label: 'Замовлено' },
  { key: 'in_progress', label: 'В роботі' },
  { key: 'completed',   label: 'Виконано' },
  { key: 'cancelled',   label: 'Скасовано' },
];

export const AdminShopOrdersView: React.FC = () => {
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getAllOrders({ status: statusFilter, search, page, limit: 20 })
      .then(({ orders: data, hasMore: more }) => {
        setOrders(data);
        setHasMore(more);
      })
      .catch(() => setError('Помилка завантаження'))
      .finally(() => setLoading(false));
  }, [statusFilter, search, page]);

  useEffect(() => { setPage(1); }, [statusFilter, search]);
  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (order: ShopOrder, newStatus: OrderStatus) => {
    setChangingId(order._id);
    try {
      const updated = await updateOrderStatus(order._id, newStatus);
      setOrders(prev => prev.map(o =>
        o._id === order._id ? { ...o, status: updated.status, adminNote: updated.adminNote } : o
      ));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Помилка зміни статусу');
    } finally {
      setChangingId(null);
    }
  };

  const getUserName = (order: ShopOrder): string => {
    if (typeof order.userId === 'object' && order.userId !== null) {
      return (order.userId as { name: string }).name || (order.userId as { phone: string }).phone;
    }
    return String(order.userId);
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-bold text-slate-800">Замовлення</h2>
        <p className="text-slate-500 mt-1">Управління замовленнями магазину</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
          {error} <button className="ml-2 underline" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text" placeholder="Пошук по імені або товару..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? 'bg-kameya-burgundy text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Дата</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Працівник</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Товар</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Балів</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Статус</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-600">Дії</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {orders.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-12 text-slate-400">Замовлень не знайдено</td></tr>
                )}
                {orders.map(order => (
                  <tr key={order._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(order.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{getUserName(order)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {order.productSnapshot.imageUrl
                            ? <img src={order.productSnapshot.imageUrl} alt="" className="w-full h-full object-cover" />
                            : <i className="fas fa-image text-slate-300 text-xs" />}
                        </div>
                        <span className="truncate max-w-[160px]">{order.productSnapshot.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-kameya-burgundy">{order.pointsSpent}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {NEXT_STATUSES[order.status].length > 0 && (
                        <div className="flex items-center justify-end gap-1">
                          {NEXT_STATUSES[order.status].map(next => (
                            <button
                              key={next}
                              disabled={changingId === order._id}
                              onClick={() => handleStatusChange(order, next)}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
                                next === 'cancelled'
                                  ? 'border-red-200 text-red-600 hover:bg-red-50'
                                  : 'border-kameya-burgundy/30 text-kameya-burgundy hover:bg-kameya-burgundy/5'
                              }`}
                            >
                              {changingId === order._id
                                ? <i className="fas fa-spinner fa-spin" />
                                : STATUS_LABELS[next]}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          >
            <i className="fas fa-chevron-left mr-1" /> Назад
          </button>
          <span className="text-sm text-slate-500">Стор. {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore || loading}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50"
          >
            Далі <i className="fas fa-chevron-right ml-1" />
          </button>
        </div>
      )}
    </div>
  );
};
