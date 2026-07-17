import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AdminNotification } from '../../types';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../../services/notificationsService';
import { timeAgo, formatAbsDateTime } from '../../utils/dateFormatter';

const TYPE_CONFIG = {
  reflection_submitted: {
    icon: 'fa-comment-dots',
    color: 'text-blue-500',
    bg: 'bg-blue-100',
    verb: 'подав(ла) рефлексію до звіту',
  },
  plan_generated: {
    icon: 'fa-graduation-cap',
    color: 'text-amber-500',
    bg: 'bg-amber-100',
    verb: 'отримав(ла) план навчання до звіту',
  },
  plan_completed: {
    icon: 'fa-circle-check',
    color: 'text-green-500',
    bg: 'bg-green-100',
    verb: 'завершив(ла) план навчання до звіту',
  },
} as const;

interface AdminNotificationsViewProps {
  onViewReport: (reportId: string, action?: string) => void;
  onMarkReadDecrement: () => void;
}

export const AdminNotificationsView: React.FC<AdminNotificationsViewProps> = ({
  onViewReport,
  onMarkReadDecrement,
}) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotifications = useCallback(async (searchVal: string, currentOffset: number, append: boolean) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const { notifications: newItems, hasMore: more } = await getNotifications(currentOffset, searchVal);
      setNotifications(prev => append ? [...prev, ...newItems] : newItems);
      setHasMore(more);
      setOffset(currentOffset + newItems.length);
    } catch {
      setError('Помилка завантаження сповіщень');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications('', 0, false);
  }, [fetchNotifications]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      fetchNotifications(val, 0, false);
    }, 300);
  };

  const handleLoadMore = () => {
    fetchNotifications(search, offset, true);
  };

  const handleMarkAll = async () => {
    const unreadCount = notifications.filter(n => !n.isRead).length;
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(x => ({ ...x, isRead: true })));
      for (let i = 0; i < unreadCount; i++) onMarkReadDecrement();
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const handleView = async (n: AdminNotification) => {
    if (!n.isRead) {
      try {
        await markNotificationRead(n._id);
        setNotifications(prev =>
          prev.map(x => x._id === n._id ? { ...x, isRead: true } : x)
        );
        onMarkReadDecrement();
      } catch {
        // non-blocking — navigate regardless
      }
    }
    onViewReport(n.reportId, n.type === 'reflection_submitted' ? 'reflection' : undefined);
  };

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Сповіщення</h2>
          <p className="text-slate-500 mt-1">Активність працівників</p>
        </div>
        <div className="flex items-center gap-2 mt-1 flex-shrink-0">
          {hasUnread && (
            <button
              onClick={handleMarkAll}
              disabled={markingAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-kameya-burgundy text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <i className={`fas ${markingAll ? 'fa-spinner fa-spin' : 'fa-check-double'}`}></i>
              Переглянути всі
            </button>
          )}
          <button
            onClick={() => fetchNotifications(search, 0, false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <i className="fas fa-rotate-right"></i>
            Оновити
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
        <input
          type="text"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Пошук за іменем..."
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy bg-white"
        />
        {search && (
          <button
            onClick={() => handleSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <i className="fas fa-xmark text-sm"></i>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <i className="fas fa-circle-exclamation"></i>
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-slate-100 h-20" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20 text-slate-400">
          <i className={`fas ${search ? 'fa-magnifying-glass' : 'fa-bell-slash'} text-4xl mb-4 block`}></i>
          <p className="text-lg font-medium">{search ? 'Нічого не знайдено' : 'Немає сповіщень'}</p>
          <p className="text-sm mt-1">
            {search ? 'Спробуйте змінити пошуковий запит' : 'Активність з\'явиться після нових дій працівників'}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {notifications.map(n => {
              const cfg = TYPE_CONFIG[n.type];
              return (
                <div
                  key={n._id}
                  className={`bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4 transition-colors ${
                    !n.isRead
                      ? 'border-l-4 border-l-kameya-burgundy border border-slate-100'
                      : 'border border-slate-100'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <i className={`fas ${cfg.icon} ${cfg.color}`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold">{n.userName}</span>
                      {' '}{cfg.verb}{' '}
                      <span className="font-medium text-slate-600">{n.reportFileName || 'звіт'}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400" title={formatAbsDateTime(n.createdAt)}>
                        {timeAgo(n.createdAt)}
                      </span>
                      {n.isOnTime !== null && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          n.isOnTime ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {n.isOnTime ? 'Вчасно' : 'Запізно'}
                        </span>
                      )}
                      {!n.isRead && (
                        <span className="w-2 h-2 rounded-full bg-kameya-burgundy flex-shrink-0" />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleView(n)}
                    className="flex-shrink-0 px-4 py-2 rounded-lg bg-kameya-burgundy text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                  >
                    Переглянути
                  </button>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {loadingMore ? (
                <><i className="fas fa-spinner fa-spin"></i> Завантаження...</>
              ) : (
                <><i className="fas fa-chevron-down"></i> Завантажити ще</>
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
};
