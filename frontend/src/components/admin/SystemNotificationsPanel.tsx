import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SystemLogEntry, SystemLogType } from '../../types';
import { getSystemLogs, markSystemLogRead, markAllSystemLogsRead } from '../../services/notificationsService';
import { timeAgo, formatAbsDateTime } from '../../utils/dateFormatter';

interface SystemNotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onMarkReadDecrement: () => void;
}

const LOG_CONFIG: Record<SystemLogType, { bg: string; icon: string; color: string; label: string }> = {
  login_success:    { bg: 'bg-green-100',  icon: 'fa-circle-check', color: 'text-green-600',  label: 'Успішний вхід'  },
  login_failed:     { bg: 'bg-red-100',    icon: 'fa-circle-xmark', color: 'text-red-600',    label: 'Невірний пароль' },
  password_changed: { bg: 'bg-amber-100',  icon: 'fa-key',          color: 'text-amber-600',  label: 'Зміна пароля'   },
};

export const SystemNotificationsPanel: React.FC<SystemNotificationsPanelProps> = ({
  open,
  onClose,
  onMarkReadDecrement,
}) => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLogs = useCallback(async (searchVal: string, currentOffset: number, append: boolean) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    setError(false);
    try {
      const { logs: newLogs, hasMore: more } = await getSystemLogs(currentOffset, searchVal);
      setLogs(prev => append ? [...prev, ...newLogs] : newLogs);
      setHasMore(more);
      setOffset(currentOffset + newLogs.length);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setOffset(0);
    fetchLogs('', 0, false);
  }, [open, fetchLogs]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLogs(val, 0, false);
    }, 300);
  };

  const handleLoadMore = () => {
    fetchLogs(search, offset, true);
  };

  const handleMarkAll = async () => {
    const unreadCount = logs.filter(l => !l.isRead).length;
    if (unreadCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllSystemLogsRead();
      setLogs(prev => prev.map(x => ({ ...x, isRead: true })));
      for (let i = 0; i < unreadCount; i++) onMarkReadDecrement();
    } catch {
      // ignore
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClick = async (log: SystemLogEntry) => {
    if (log.isRead) return;
    try {
      await markSystemLogRead(log._id);
      setLogs(prev => prev.map(x => x._id === log._id ? { ...x, isRead: true } : x));
      onMarkReadDecrement();
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  const hasUnread = logs.some(l => !l.isRead);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex flex-col border-b border-slate-100">
          <div className="flex items-center justify-between p-5 pb-3">
            <div className="flex items-center gap-2">
              <i className="fas fa-shield-halved text-kameya-burgundy"></i>
              <h3 className="text-lg font-bold text-slate-800">Системні сповіщення</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
            >
              <i className="fas fa-xmark"></i>
            </button>
          </div>

          {/* Search */}
          <div className="px-5 pb-3">
            <div className="relative">
              <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
              <input
                type="text"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Пошук за іменем або телефоном..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/30 focus:border-kameya-burgundy bg-slate-50"
              />
              {search && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <i className="fas fa-xmark text-xs"></i>
                </button>
              )}
            </div>
          </div>

          {/* Mark all read */}
          {hasUnread && (
            <div className="px-5 pb-3">
              <button
                onClick={handleMarkAll}
                disabled={markingAll}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                <i className={`fas ${markingAll ? 'fa-spinner fa-spin' : 'fa-check-double'}`}></i>
                Позначити всі переглянутими
              </button>
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <i className="fas fa-circle-exclamation"></i>
              Помилка завантаження логів
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-16" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <i className={`fas ${search ? 'fa-magnifying-glass' : 'fa-shield-halved'} text-3xl mb-3 block`}></i>
              <p className="text-sm">{search ? 'Нічого не знайдено' : 'Немає системних подій'}</p>
            </div>
          ) : (
            <>
              {logs.map(log => {
                const cfg = LOG_CONFIG[log.type] ?? LOG_CONFIG.login_success;
                return (
                  <button
                    key={log._id}
                    onClick={() => handleClick(log)}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      !log.isRead
                        ? 'border-l-4 border-l-kameya-burgundy border-slate-100 bg-slate-50'
                        : 'border-slate-100 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <i className={`fas text-xs ${cfg.icon} ${cfg.color}`}></i>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {log.userName ?? log.phone}
                        </p>
                        <p className="text-xs text-slate-500">
                          {cfg.label}
                          {log.userName && (
                            <span className="text-slate-400 ml-1">· {log.phone}</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5" title={formatAbsDateTime(log.createdAt)}>
                          {timeAgo(log.createdAt)}
                        </p>
                      </div>
                      {!log.isRead && (
                        <div className="w-2 h-2 rounded-full bg-kameya-burgundy mt-1 flex-shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}

              {/* Load more */}
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 mt-2"
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
      </div>
    </>
  );
};
