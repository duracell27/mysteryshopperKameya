import React, { useEffect, useState } from 'react';
import { BookLoan, Book } from '../../types';
import { getMyLoans, requestReturn, cancelLoan } from '../../services/libraryService';

function daysLeft(dueDate: string): number {
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(dueDate); due.setHours(0,0,0,0);
  return Math.floor((due.getTime() - now.getTime()) / (1000*60*60*24));
}

const DaysIndicator: React.FC<{ dueDate: string }> = ({ dueDate }) => {
  const d = daysLeft(dueDate);
  let color = 'text-green-600 bg-green-50';
  let label = `${d} дн.`;
  if (d < 0)      { color = 'text-red-600 bg-red-50';    label = `Прострочено на ${Math.abs(d)} дн.`; }
  else if (d < 3) { color = 'text-red-600 bg-red-50';    label = `Залишилось ${d} дн.`; }
  else if (d < 7) { color = 'text-yellow-600 bg-yellow-50'; label = `Залишилось ${d} дн.`; }
  else            { label = `Залишилось ${d} дн.`; }
  return <span className={`text-xs font-medium px-2 py-1 rounded-full ${color}`}>{label}</span>;
};

const StarPicker: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <div className="flex space-x-1">
    {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
      <button
        key={n}
        onClick={() => onChange(n)}
        className={`text-xl ${n <= value ? 'text-yellow-400' : 'text-slate-200'} hover:text-yellow-400 transition-colors`}
      >★</button>
    ))}
  </div>
);

export const MyLoansView: React.FC = () => {
  const [loans,    setLoans]    = useState<BookLoan[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [toast,    setToast]    = useState<string | null>(null);
  const [returnModal, setReturnModal] = useState<BookLoan | null>(null);
  const [rating,   setRating]   = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = async () => {
    setLoading(true);
    try { setLoans(await getMyLoans()); }
    catch { showToast('Помилка завантаження'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const activeLoan = loans.find(l => ['pending','active','return_pending'].includes(l.status));
  const history    = loans.filter(l => ['returned','cancelled'].includes(l.status));

  const handleReturn = async () => {
    if (!returnModal) return;
    setSubmitting(true);
    try {
      await requestReturn(returnModal._id, rating > 0 ? rating : undefined);
      showToast('Запит на повернення надіслано!');
      setReturnModal(null);
      setRating(0);
      load();
    } catch (e: any) {
      showToast(e.message ?? 'Помилка');
    } finally { setSubmitting(false); }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelLoan(id);
      showToast('Запит скасовано');
      load();
    } catch (e: any) { showToast(e.message ?? 'Помилка'); }
  };

  const bookOf = (loan: BookLoan) => loan.bookId as Book;
  const statusLabel: Record<string, string> = {
    pending:        'Очікує доставки',
    active:         'На руках',
    return_pending: 'Очікує повернення',
    returned:       'Повернено',
    cancelled:      'Скасовано',
  };

  if (loading) return (
    <div className="flex justify-center py-12">
      <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy"></i>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm">{toast}</div>
      )}

      {/* Модалка повернення */}
      {returnModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Повернення книги</h3>
            <p className="text-sm text-slate-600">«{bookOf(returnModal).title}»</p>
            <div>
              <p className="text-sm text-slate-600 mb-2">Оцінка (необов'язково):</p>
              <StarPicker value={rating} onChange={setRating} />
              {rating > 0 && <p className="text-xs text-slate-500 mt-1">{rating} / 10</p>}
            </div>
            <div className="flex space-x-3 pt-2">
              <button onClick={() => { setReturnModal(null); setRating(0); }}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">
                Скасувати
              </button>
              <button onClick={handleReturn} disabled={submitting}
                className="flex-1 bg-kameya-burgundy text-white py-2 rounded-lg text-sm font-medium hover:bg-kameya-burgundy/90 disabled:opacity-50">
                {submitting ? <i className="fas fa-spinner fa-spin"></i> : 'Підтвердити'}
              </button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold text-slate-800">Мої книги</h1>

      {/* Активна позика */}
      {activeLoan ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Зараз на руках</h2>
          <div className="flex space-x-4">
            {bookOf(activeLoan).coverUrl ? (
              <img src={bookOf(activeLoan).coverUrl} alt="" className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />
            ) : (
              <div className="w-20 h-28 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-book text-slate-300 text-2xl"></i>
              </div>
            )}
            <div className="flex-1 space-y-2">
              <p className="font-semibold text-slate-800">{bookOf(activeLoan).title}</p>
              <p className="text-sm text-slate-500">{bookOf(activeLoan).author}</p>
              <p className="text-xs text-slate-400">{statusLabel[activeLoan.status]}</p>
              {activeLoan.dueDate && activeLoan.status === 'active' && (
                <DaysIndicator dueDate={activeLoan.dueDate} />
              )}
              <div className="flex space-x-2 pt-1">
                {activeLoan.status === 'active' && (
                  <button onClick={() => setReturnModal(activeLoan)}
                    className="bg-kameya-burgundy text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-kameya-burgundy/90">
                    Повернути
                  </button>
                )}
                {activeLoan.status === 'pending' && (
                  <button onClick={() => handleCancel(activeLoan._id)}
                    className="border border-slate-300 text-slate-600 px-4 py-1.5 rounded-lg text-sm hover:bg-slate-50">
                    Скасувати запит
                  </button>
                )}
                {activeLoan.status === 'return_pending' && (
                  <span className="text-xs text-slate-400 italic">Очікуємо підтвердження адміна</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
          <i className="fas fa-book-open text-3xl mb-2"></i>
          <p className="text-sm">Немає активних позик</p>
        </div>
      )}

      {/* Історія */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Історія</h2>
          {history.map(loan => (
            <div key={loan._id} className="bg-white rounded-xl border border-slate-100 p-4 flex items-center space-x-4">
              {bookOf(loan).coverUrl ? (
                <img src={bookOf(loan).coverUrl} alt="" className="w-12 h-16 object-cover rounded-lg flex-shrink-0" />
              ) : (
                <div className="w-12 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-book text-slate-300"></i>
                </div>
              )}
              <div className="flex-1">
                <p className="font-medium text-slate-800 text-sm">{bookOf(loan).title}</p>
                <p className="text-xs text-slate-500">{bookOf(loan).author}</p>
                <p className="text-xs text-slate-400 mt-1">{statusLabel[loan.status]}</p>
                {loan.returnedAt && (
                  <p className="text-xs text-slate-400">
                    Повернено: {new Date(loan.returnedAt).toLocaleDateString('uk-UA')}
                  </p>
                )}
              </div>
              {loan.rating && (
                <div className="text-right">
                  <span className="text-yellow-400">★</span>
                  <span className="text-sm font-medium text-slate-700 ml-1">{loan.rating}/10</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
