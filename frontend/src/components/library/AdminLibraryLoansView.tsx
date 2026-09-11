import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { BookLoan, Book } from '../../types';
import { getAllLoans, deliverLoan, extendLoan, confirmReturn, cancelLoan, forceCancelLoan } from '../../services/libraryService';
import { getDivisionLabel, getGroupLabel } from '../../config/org-structure';

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

function isOverdue(loan: { status: string; dueDate?: string }): boolean {
  return loan.status === 'active' && !!loan.dueDate && new Date(loan.dueDate) < new Date();
}

function loanPriority(loan: { status: string; dueDate?: string }): number {
  if (loan.status === 'pending')        return 0;
  if (loan.status === 'return_pending') return 1;
  if (isOverdue(loan))                  return 2;
  if (loan.status === 'active')         return 3;
  if (loan.status === 'returned')       return 4;
  return 5;
}

function loanGroup(loan: { status: string; dueDate?: string }): string {
  if (loan.status === 'pending' || loan.status === 'return_pending') return 'action';
  if (isOverdue(loan))   return 'overdue';
  if (loan.status === 'active') return 'active';
  return 'done';
}

const GROUP_LABEL: Record<string, string> = {
  action:  'Потребують дії',
  overdue: 'Прострочені',
  active:  'На руках',
  done:    'Завершені',
};

const STATUS_LABEL: Record<string, string> = {
  pending:        'Замовлена',
  active:         'На руках',
  return_pending: 'Повертається',
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

export const AdminLibraryLoansView: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const [loans,   setLoans]   = useState<BookLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<string | null>(null);
  const [status,  setStatus]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [page,    setPage]    = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [extendModal,      setExtendModal]      = useState<BookLoan | null>(null);
  const [extendDays,       setExtendDays]       = useState('7');
  const [forceCancelModal, setForceCancelModal] = useState<BookLoan | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { loans: data, hasMore: more } = await getAllLoans({
        status: status !== 'all' ? status : undefined,
        search: search || undefined,
        page,
      });
      setLoans(data);
      setHasMore(more);
    } catch { showToast('Помилка завантаження'); }
    finally { setLoading(false); }
  }, [status, search, page]);

  useEffect(() => { setPage(1); }, [status, search]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>, successMsg: string) => {
    setActing(id);
    try { await fn(); showToast(successMsg); load(); onRefresh?.(); }
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
  const userOf  = (l: BookLoan) => l.userId as { _id: string; name: string; phone: string; division?: string; group?: string };

  const sorted = useMemo(() =>
    [...loans].sort((a, b) => loanPriority(a) - loanPriority(b)),
    [loans]
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm">{toast}</div>
      )}

      {/* Extend modal */}
      {extendModal && (() => {
        const days = parseInt(extendDays, 10);
        const base = extendModal.dueDate ? new Date(extendModal.dueDate) : new Date();
        const newDate = !isNaN(days) && days > 0
          ? new Date(base.getTime() + days * 86400000)
          : null;
        const newDateStr = newDate
          ? newDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
          : null;
        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setExtendModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="bg-kameya-burgundy px-5 py-4">
                <h3 className="text-base font-bold text-white">Подовжити термін</h3>
                <p className="text-sm text-white/70 mt-0.5">«{bookOf(extendModal).title}»</p>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Швидкий вибір</p>
                  <div className="flex gap-2">
                    {[7, 14, 30].map(d => (
                      <button key={d} onClick={() => setExtendDays(String(d))}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          extendDays === String(d)
                            ? 'bg-kameya-burgundy text-white border-kameya-burgundy'
                            : 'border-slate-200 text-slate-600 hover:border-kameya-burgundy/50 hover:text-kameya-burgundy'
                        }`}>
                        {d} дн.
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">Або введіть вручну</label>
                  <input type="number" min="1" value={extendDays} onChange={e => setExtendDays(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50" />
                </div>
                {newDateStr && (
                  <div className="bg-slate-50 rounded-xl px-4 py-3 text-sm">
                    <span className="text-slate-500">Нова дата повернення: </span>
                    <span className="font-semibold text-slate-800">{newDateStr}</span>
                  </div>
                )}
              </div>
              <div className="px-5 pb-5 flex gap-3">
                <button onClick={() => setExtendModal(null)}
                  className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50">
                  Скасувати
                </button>
                <button onClick={handleExtend}
                  className="flex-1 bg-kameya-burgundy text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-kameya-burgundy/90">
                  Підтвердити
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Force-cancel modal */}
      {forceCancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setForceCancelModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-kameya-burgundy px-5 py-4">
              <h3 className="text-base font-bold text-white">Скасувати позику</h3>
              <p className="text-sm text-white/70 mt-0.5">«{bookOf(forceCancelModal).title}»</p>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-slate-700">Після скасування:</p>
              <ul className="text-sm text-slate-600 space-y-1.5">
                <li className="flex items-start gap-2"><i className="fas fa-circle-check text-green-500 mt-0.5 text-xs flex-shrink-0"></i>Книга повернеться у доступний каталог</li>
                <li className="flex items-start gap-2"><i className="fas fa-circle-xmark text-red-400 mt-0.5 text-xs flex-shrink-0"></i>Позику буде позначено як скасовану</li>
                <li className="flex items-start gap-2"><i className="fas fa-triangle-exclamation text-yellow-500 mt-0.5 text-xs flex-shrink-0"></i>Дію неможливо відмінити</li>
              </ul>
            </div>
            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setForceCancelModal(null)}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50">
                Закрити
              </button>
              <button
                onClick={async () => { await act(forceCancelModal._id, () => forceCancelLoan(forceCancelModal._id), 'Позику скасовано, книга доступна'); setForceCancelModal(null); }}
                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-red-600"
                disabled={!!acting}
              >
                {acting === forceCancelModal._id ? <i className="fas fa-spinner fa-spin"></i> : 'Підтвердити'}
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
        <select value={status} onChange={e => setStatus(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50">
          <option value="all">Всі статуси</option>
          <option value="pending">Замовлені</option>
          <option value="active">На руках</option>
          <option value="return_pending">Повертаються</option>
          <option value="returned">Повернені</option>
          <option value="cancelled">Скасовані</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><i className="fas fa-spinner fa-spin text-xl text-kameya-burgundy"></i></div>
      ) : loans.length === 0 ? (
        <p className="text-center py-8 text-slate-400 text-sm">Запитів не знайдено</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((loan, idx) => {
            const book = bookOf(loan);
            const user = userOf(loan);
            const prev = sorted[idx - 1];
            const curGroup  = loanGroup(loan);
            const prevGroup = prev ? loanGroup(prev) : null;
            const showDivider = curGroup !== prevGroup;
            return (
              <React.Fragment key={loan._id}>
                {showDivider && (
                  <div className="flex items-center gap-3 pt-1">
                    <div className={`flex-1 h-px ${curGroup === 'active' ? 'bg-kameya-burgundy/20' : 'bg-slate-200'}`} />
                    <span className={`text-xs font-medium uppercase tracking-wide flex-shrink-0 ${curGroup === 'active' ? 'text-kameya-burgundy/60' : 'text-slate-400'}`}>
                      {GROUP_LABEL[curGroup]}
                    </span>
                    <div className={`flex-1 h-px ${curGroup === 'active' ? 'bg-kameya-burgundy/20' : 'bg-slate-200'}`} />
                  </div>
                )}
              <div className={`rounded-xl border overflow-hidden flex ${
                curGroup === 'active'
                  ? 'bg-kameya-burgundy/5 border-kameya-burgundy/15'
                  : 'bg-white border-slate-100'
              }`}>
                {book.coverUrl
                  ? <img src={book.coverUrl} alt="" className="w-24 object-cover flex-shrink-0 self-stretch" />
                  : <div className="w-24 bg-slate-100 flex items-center justify-center flex-shrink-0"><i className="fas fa-book text-slate-300 text-2xl"></i></div>
                }
                <div className="flex items-start gap-4 p-4 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-800 text-sm">{book.title}</p>
                    </div>
                    <p className="text-xs text-slate-500">{book.author}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      <i className="fas fa-user text-slate-400 mr-1"></i>
                      {user.name} · {user.phone}
                    </p>
                    {user.division && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        <i className="fas fa-location-dot mr-1"></i>
                        {getDivisionLabel(user.division)}
                        {user.group && ` · ${getGroupLabel(user.division, user.group)}`}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1 text-xs text-slate-400">
                      <span>Запит: {new Date(loan.requestedAt).toLocaleDateString('uk-UA')}</span>
                      {loan.deliveredAt && <span>· Видано: {new Date(loan.deliveredAt).toLocaleDateString('uk-UA')}</span>}
                      {loan.dueDate     && <span>· До: {new Date(loan.dueDate).toLocaleDateString('uk-UA')}</span>}
                      {loan.returnedAt  && <span>· Повернено: {new Date(loan.returnedAt).toLocaleDateString('uk-UA')}</span>}
                      {loan.rating      && <span>· ★ {loan.rating}/10</span>}
                    </div>
                  </div>
                  {/* Дії */}
                  <div className="flex flex-col items-end justify-between flex-shrink-0 self-stretch">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[loan.status]}`}>
                          {STATUS_LABEL[loan.status]}
                        </span>
                        {loan.status === 'active' && <DueBadge dueDate={loan.dueDate} />}
                      </div>
                      {loan.status === 'active' && (
                        <div className="flex items-center gap-1">
                          <span
                            title="СМС за 3 дні до закінчення (день 27)"
                            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                              loan.warningDay27Sent
                                ? 'bg-green-50 text-green-600'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            <i className="fas fa-comment-sms text-[9px]"></i> 27д
                          </span>
                          <span
                            title="СМС після прострочення (день 31+)"
                            className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                              loan.warningDay31Sent
                                ? 'bg-orange-50 text-orange-600'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            <i className="fas fa-comment-sms text-[9px]"></i> 31д
                          </span>
                        </div>
                      )}
                    </div>
                    {loan.status === 'pending' && (
                      <div className="flex flex-col gap-1.5 w-full">
                        <button disabled={!!acting} onClick={() => act(loan._id, () => deliverLoan(loan._id), 'Книгу відправлено!')}
                          className="w-full bg-kameya-burgundy text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-kameya-burgundy/90 disabled:opacity-50">
                          {acting === loan._id ? <i className="fas fa-spinner fa-spin"></i> : 'Відправити'}
                        </button>
                        <button disabled={!!acting} onClick={() => act(loan._id, () => cancelLoan(loan._id), 'Запит скасовано')}
                          className="w-full border border-kameya-burgundy text-kameya-burgundy px-3 py-1.5 rounded-lg text-xs hover:bg-kameya-burgundy/5 disabled:opacity-50">
                          Скасувати
                        </button>
                      </div>
                    )}
                    {loan.status === 'active' && (
                      <div className="flex flex-col gap-1.5 w-full">
                        <button disabled={!!acting} onClick={() => { setExtendDays('7'); setExtendModal(loan); }}
                          className="w-full bg-kameya-burgundy text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-kameya-burgundy/90 disabled:opacity-50 whitespace-nowrap">
                          Продовжити термін
                        </button>
                        <button disabled={!!acting} onClick={() => setForceCancelModal(loan)}
                          className="w-full border border-kameya-burgundy text-kameya-burgundy px-3 py-1.5 rounded-lg text-xs hover:bg-kameya-burgundy/5 disabled:opacity-50 whitespace-nowrap">
                          Скасувати позику
                        </button>
                      </div>
                    )}
                    {loan.status === 'return_pending' && (
                      <button disabled={!!acting} onClick={() => act(loan._id, () => confirmReturn(loan._id), 'Повернення підтверджено!')}
                        className="bg-kameya-burgundy text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-kameya-burgundy/90 disabled:opacity-50">
                        {acting === loan._id ? <i className="fas fa-spinner fa-spin"></i> : 'Отримана'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              </React.Fragment>
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
