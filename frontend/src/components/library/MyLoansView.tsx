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

const STEPS = [
  { key: 'pending',        label: 'Замовлена',   icon: 'fa-truck' },
  { key: 'active',         label: 'На руках',    icon: 'fa-book-open' },
  { key: 'return_pending', label: 'Повертається', icon: 'fa-rotate-left' },
] as const;

const stepIndex = (status: string) => STEPS.findIndex(s => s.key === status);

const StatusStepper: React.FC<{ status: string }> = ({ status }) => {
  const current = stepIndex(status);
  return (
    <div className="flex items-center w-full mt-3 mb-2">
      {STEPS.map((step, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                done   ? 'bg-kameya-burgundy/20 text-kameya-burgundy' :
                active ? 'bg-kameya-burgundy text-white shadow-sm' :
                         'bg-slate-100 text-slate-300'
              }`}>
                {done
                  ? <i className="fas fa-check text-[9px]"></i>
                  : <i className={`fas ${step.icon} text-[9px]`}></i>
                }
              </div>
              <span className={`text-[9px] font-medium text-center leading-tight ${
                active ? 'text-kameya-burgundy' : done ? 'text-slate-400' : 'text-slate-300'
              }`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-1 mb-3 rounded-full transition-colors ${
                i < current ? 'bg-kameya-burgundy/40' : 'bg-slate-100'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const StarPicker: React.FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => {
  const [hovered, setHovered] = React.useState(0);
  const active = hovered || value;
  return (
    <div className="flex flex-col items-center gap-1.5" onMouseLeave={() => setHovered(0)}>
      <div className="flex space-x-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHovered(n)}
            className={`text-xl transition-colors ${n <= active ? 'text-yellow-400' : 'text-slate-200'}`}
          >★</button>
        ))}
      </div>
      <p className={`text-xs font-medium transition-colors ${active > 0 ? 'text-slate-600' : 'text-slate-300'}`}>
        {active > 0 ? `${active} / 10` : 'Оберіть оцінку'}
      </p>
    </div>
  );
};

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
    pending:        'Замовлена',
    active:         'На руках',
    return_pending: 'Повертається',
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
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => { setReturnModal(null); setRating(0); }}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}>
            {/* Burgundy header */}
            <div className="bg-kameya-burgundy px-5 pt-5 pb-6 relative">
              <button
                onClick={() => { setReturnModal(null); setRating(0); }}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
              <div className="flex gap-4">
                {bookOf(returnModal).coverUrl ? (
                  <img src={bookOf(returnModal).coverUrl} alt="" className="w-16 h-24 object-cover rounded-xl flex-shrink-0 shadow-md" />
                ) : (
                  <div className="w-16 h-24 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-book text-2xl text-white/50"></i>
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-8 pt-1">
                  <p className="text-xs text-white/60 mb-1">Повернення книги</p>
                  <h3 className="text-base font-bold text-white leading-snug">{bookOf(returnModal).title}</h3>
                  <p className="text-sm text-white/70 mt-1">{bookOf(returnModal).author}</p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div className="px-5 pt-4 pb-2 flex flex-col items-center">
              <p className="text-sm font-medium text-slate-700 mb-3">Оцінка книги (необов'язково)</p>
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <div className="px-5 py-4 flex gap-3 border-t border-slate-100">
              <button onClick={() => { setReturnModal(null); setRating(0); }}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50">
                Скасувати
              </button>
              <button onClick={handleReturn} disabled={submitting}
                className="flex-1 bg-kameya-burgundy text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-kameya-burgundy/90 disabled:opacity-50 flex items-center justify-center gap-2">
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
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Мої книги</h2>
          <div className="flex space-x-4">
            {bookOf(activeLoan).coverUrl ? (
              <img src={bookOf(activeLoan).coverUrl} alt="" className="w-20 h-28 object-cover rounded-lg flex-shrink-0" />
            ) : (
              <div className="w-20 h-28 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <i className="fas fa-book text-slate-300 text-2xl"></i>
              </div>
            )}
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-800 leading-snug min-w-0">{bookOf(activeLoan).title}</p>
                {activeLoan.dueDate && activeLoan.status === 'active' && (
                  <span className="flex-shrink-0"><DaysIndicator dueDate={activeLoan.dueDate} /></span>
                )}
              </div>
              <p className="text-sm text-slate-500">{bookOf(activeLoan).author}</p>
              <div className="flex items-center gap-2">
                <StatusStepper status={activeLoan.status} />
                {activeLoan.status === 'active' && (
                  <button onClick={() => setReturnModal(activeLoan)}
                    className="flex-shrink-0 bg-kameya-burgundy text-white px-3 py-1 rounded-lg text-xs font-medium hover:bg-kameya-burgundy/90">
                    Повернути
                  </button>
                )}
                {activeLoan.status === 'pending' && (
                  <button onClick={() => handleCancel(activeLoan._id)}
                    className="flex-shrink-0 border border-slate-300 text-slate-600 px-3 py-1 rounded-lg text-xs hover:bg-slate-50">
                    Скасувати
                  </button>
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
