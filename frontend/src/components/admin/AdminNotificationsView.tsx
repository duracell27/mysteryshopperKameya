import React, { useEffect, useState, useCallback } from 'react';
import { AdminNotification } from '../../types';
import { getNotifications, markNotificationRead } from '../../services/notificationsService';
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
  onViewReport: (reportId: string) => void;
  onMarkReadDecrement: () => void;
}

export const AdminNotificationsView: React.FC<AdminNotificationsViewProps> = ({
  onViewReport,
  onMarkReadDecrement,
}) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getNotifications()
      .then(setNotifications)
      .catch(() => setError('Помилка завантаження сповіщень'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

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
    onViewReport(n.reportId);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-800">Сповіщення</h2>
          <p className="text-slate-500 mt-1">Активність працівників</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <i className="fas fa-rotate-right"></i>
          Оновити
        </button>
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
          <i className="fas fa-bell-slash text-4xl mb-4 block"></i>
          <p className="text-lg font-medium">Немає сповіщень</p>
          <p className="text-sm mt-1">Активність з'явиться після нових дій працівників</p>
        </div>
      ) : (
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
      )}
    </div>
  );
};
