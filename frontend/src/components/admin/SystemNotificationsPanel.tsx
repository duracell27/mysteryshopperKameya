import React, { useEffect, useState, useCallback } from 'react';
import { SystemLogEntry } from '../../types';
import { getSystemLogs, markSystemLogRead } from '../../services/notificationsService';
import { timeAgo, formatAbsDateTime } from '../../utils/dateFormatter';

interface SystemNotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  onMarkReadDecrement: () => void;
}

export const SystemNotificationsPanel: React.FC<SystemNotificationsPanelProps> = ({
  open,
  onClose,
  onMarkReadDecrement,
}) => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    getSystemLogs()
      .then(setLogs)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

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

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
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
              <i className="fas fa-shield-halved text-3xl mb-3 block"></i>
              <p className="text-sm">Немає системних подій</p>
            </div>
          ) : (
            logs.map(log => (
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    log.type === 'login_success' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <i className={`fas text-xs ${
                      log.type === 'login_success'
                        ? 'fa-circle-check text-green-600'
                        : 'fa-circle-xmark text-red-600'
                    }`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {log.userName ?? log.phone}
                    </p>
                    <p className="text-xs text-slate-500">
                      {log.type === 'login_success' ? 'Успішний вхід' : 'Невірний пароль'}
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
            ))
          )}
        </div>
      </div>
    </>
  );
};
