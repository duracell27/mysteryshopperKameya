import React, { useEffect, useState, useCallback } from 'react';
import { BookLoan, Book } from '../../types';
import { getAllLoans, deliverLoan, extendLoan, confirmReturn, cancelLoan } from '../../services/libraryService';

function daysLeft(dueDate?: string): number | null {
  if (!dueDate) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dueDate); due.setHours(0,0,0,0);
  return Math.floor((due.getTime() - now.getTime()) / (1000*60*60*24));
}

const DueBadge: React.FC<{ dueDate?: string }> = ({ dueDate }) => {
  const d = daysLeft(dueDate);
  if (d === null) return null;
  if (d < 0)  return <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Прострочено {Math.abs(d)} дн.</span>;
  if (d < 3)  return <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">⚠ {d} дн.</span>;
  if (d < 7)  return <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">{d} дн.</span>;
  return <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{d} дн.</span>;
};

const STATUS_LABEL: Record<string, string> = {
  pending:        'Очікує видачі',
  active:         'На руках',
  return_pending: 'Очікує повернення',
  returned:       'Повернено',
  cancelled:      'Скасовано',
};
const STATUS_COLOR: Record<string, string> = {
  pending:        'bg-blue-100 text-blue-700',
  active:         'bg-green-100 text-green-700',
  return_pending: 'bg-orange-100 text-orange-700',
  returned:       'bg-slate-100 text-slate-600',
  cancelled:      'bg-slate-100 text-slate-400',
};

export const AdminLibraryLoansView: React.FC = () => {
  const [loans,   setLoans]   = useState<BookLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<string | null>(null);
  const [status,  setStatus]  = useState('all');
  const [overdue, setOverdue] = useState(false);
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [extendModal, setExtendModal] = useState<BookLoan | null>(null);
  const [extendDays,  setExtendDays]  = useState('7');
  const [acting, setActing] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { loans: data, hasMore: more } = await getAllLoans({
        status: status !== 'all' ? status : undefined,
        overdue,
        search: search || undefined,
        page,
      });
      setLoans(data);
      setHasMore(more);
    } catch { showToast('Помилка завантаження'); }
    finally { setLoading(false); }
  }, [status, overdue, search, page]);

  useEffect(() => { setPage(1); }, [status, overdue, search]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>, successMsg: string) => {
    setActing(id);
    try { await fn(); showToast(successMsg); load(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Помилка'); }
    finally { setActing(null); }
  };

  const handleExtend = async () => {
    if (!extendModal) return;
    const days = parseInt(extendDays, 10);
    if (isNaN(days) || days < 1) { showToast('Вкажіть кількість днів'); return; }
    await act(extendModal._id, () => extendLoan(extendModal._id, days), `Термін подовжено на ${days} днів`);
    setExtendModal(null);
  };

  const bookOf  = (l: BookLoan) => l.bookId as Book;
  const userOf  = (l: BookLoan) => l.userId as { _id: string; name: string; phone: string; division?: string };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm">{toast}</div>
      )}

      {/* Extend modal */}
      {extendModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Подовжити термін</h3>
            <p className="text-sm text-slate-600">«{bookOf(extendModal).title}»</p>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Кількість днів</label>
              <input type="number" min="1" value={extendDays} onChange={e => setExtendDays(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50" />
            </div>
            <div className="flex space-x-3">
              <button onClick={() => setExtendModal(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">Скасувати</button>
              <button onClick={handleExtend}
                className="flex-1 bg-kameya-burgundy text-white py-2 rounded-lg text-sm font-medium hover:bg-kameya-burgundy/90">
                Подовжити
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-slate-800">Бібліотека — Запити</h1>

      {/* Фільтри */}
      <div className="flex flex-wrap gap-3 items-center">
        <input type="text" placeholder="Пошук..." value={search} onChange={e => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[160px] focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50" />
        <select value={status} onChange={e => { setStatus(e.target.value); setOverdue(false); }}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50">
          <option value="all">Всі статуси</option>
          <option value="pending">Очікують видачі</option>
          <option value="active">На руках</option>
          <option value="return_pending">Очікують повернення</option>
          <option value="returned">Повернені</option>
          <option value="cancelled">Скасовані</option>
        </select>
        <label className="flex items-center space-x-2 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={overdue} onChange={e => { setOverdue(e.target.checked); if (e.target.checked) setStatus('all'); }}
            className="rounded" />
          <span>Прострочені</span>
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><i className="fas fa-spinner fa-spin text-xl text-kameya-burgundy"></i></div>
      ) : loans.length === 0 ? (
        <p className="text-center py-8 text-slate-400 text-sm">Запитів не знайдено</p>
      ) : (
        <div className="space-y-3">
          {loans.map(loan => {
            const book = bookOf(loan);
            const user = userOf(loan);
            return (
              <div key={loan._id} className="bg-white rounded-xl border border-slate-100 p-4">
                <div className="flex items-start space-x-4">
                  {book.coverUrl
                    ? <img src={book.coverUrl} alt="" className="w-12 h-16 object-cover rounded flex-shrink-0" />
                    : <div className="w-12 h-16 bg-slate-100 rounded flex items-center justify-center flex-shrink-0"><i className="fas fa-book text-slate-300"></i></div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-800 text-sm">{book.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[loan.status]}`}>
                        {STATUS_LABEL[loan.status]}
                      </span>
                      {loan.status === 'active' && <DueBadge dueDate={loan.dueDate} />}
                    </div>
                    <p className="text-xs text-slate-500">{book.author}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      <i className="fas fa-user text-slate-400 mr-1"></i>
                      {user.name} · {user.phone}
                      {user.division && <span className="text-slate-400 ml-1">({user.division})</span>}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1 text-xs text-slate-400">
                      <span>Запит: {new Date(loan.requestedAt).toLocaleDateString('uk-UA')}</span>
                      {loan.deliveredAt && <span>· Видано: {new Date(loan.deliveredAt).toLocaleDateString('uk-UA')}</span>}
                      {loan.dueDate     && <span>· До: {new Date(loan.dueDate).toLocaleDateString('uk-UA')}</span>}
                      {loan.returnedAt  && <span>· Повернено: {new Date(loan.returnedAt).toLocaleDateString('uk-UA')}</span>}
                      {loan.rating      && <span>· ★ {loan.rating}/10</span>}
                    </div>
                  </div>
                  {/* Дії */}
                  <div className="flex flex-col space-y-1.5 flex-shrink-0">
                    {loan.status === 'pending' && (
                      <>
                        <button disabled={!!acting} onClick={() => act(loan._id, () => deliverLoan(loan._id), 'Книгу видано!')}
                          className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50">
                          {acting === loan._id ? <i className="fas fa-spinner fa-spin"></i> : 'Видати'}
                        </button>
                        <button disabled={!!acting} onClick={() => act(loan._id, () => cancelLoan(loan._id), 'Запит скасовано')}
                          className="border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-50">
                          Скасувати
                        </button>
                      </>
                    )}
                    {loan.status === 'active' && (
                      <button disabled={!!acting} onClick={() => { setExtendDays('7'); setExtendModal(loan); }}
                        className="border border-kameya-burgundy text-kameya-burgundy px-3 py-1.5 rounded-lg text-xs hover:bg-kameya-burgundy/5 disabled:opacity-50">
                        Подовжити
                      </button>
                    )}
                    {loan.status === 'return_pending' && (
                      <button disabled={!!acting} onClick={() => act(loan._id, () => confirmReturn(loan._id), 'Повернення підтверджено!')}
                        className="bg-kameya-burgundy text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-kameya-burgundy/90 disabled:opacity-50">
                        {acting === loan._id ? <i className="fas fa-spinner fa-spin"></i> : 'Прийнято'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50">
            <i className="fas fa-chevron-left mr-1"></i> Назад
          </button>
          <span className="text-sm text-slate-500">Стор. {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={!hasMore || loading}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50">
            Далі <i className="fas fa-chevron-right ml-1"></i>
          </button>
        </div>
      )}
    </div>
  );
};
