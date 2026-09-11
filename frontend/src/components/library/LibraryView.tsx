import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Book, BookGenre } from '../../types';
import { getGenres, getBooks, requestLoan } from '../../services/libraryService';
import { useAuth } from '../../context/AuthContext';
import { getDivisionLabel, getGroupLabel } from '../../config/org-structure';

type BookWithBorrowed = Book & { isBorrowed: boolean; dueDate?: string | null };

type ModalStep = 'detail' | 'confirm' | 'success';

const StarRating: React.FC<{ value: number; count: number }> = ({ value, count }) => {
  if (count === 0) return null;
  const stars = Math.round(value);
  return (
    <div className="flex items-center gap-1">
      <span className="text-yellow-400 text-[10px]">{'★'.repeat(stars)}{'☆'.repeat(10 - stars)}</span>
      <span className="text-[10px] text-slate-400">{value.toFixed(1)}</span>
    </div>
  );
};

const BookCard: React.FC<{
  book: BookWithBorrowed;
  onClick: () => void;
}> = ({ book, onClick }) => {
  const dueDateStr = book.dueDate
    ? new Date(book.dueDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
    : null;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col w-[140px] flex-shrink-0 text-left hover:shadow-md hover:border-kameya-burgundy/30 transition-all"
    >
      {book.coverUrl ? (
        <img src={book.coverUrl} alt={book.title} className="w-full h-[180px] object-cover" />
      ) : (
        <div className="w-full h-[180px] bg-slate-50 flex items-center justify-center">
          <i className="fas fa-book text-3xl text-slate-200"></i>
        </div>
      )}
      <div className="p-2.5 flex flex-col flex-1 gap-1">
        <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{book.title}</p>
        <p className="text-[10px] text-slate-500 truncate">{book.author}</p>
        <div className="mt-auto pt-1">
          {book.isBorrowed ? (
            <span className="flex flex-col items-center justify-center text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-md w-full leading-tight">
              <span>Зайнята</span>
              {dueDateStr && <span className="text-[9px]">до {dueDateStr}</span>}
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1 text-[10px] font-medium text-kameya-burgundy bg-kameya-burgundy/10 px-2 py-1 rounded-md w-full">
              <i className="fas fa-bookmark text-[9px]"></i>В наявності
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const BookModal: React.FC<{
  book: BookWithBorrowed;
  onClose: () => void;
  onReload: () => void;
  onRefresh?: () => void;
}> = ({ book, onClose, onReload, onRefresh }) => {
  const { user } = useAuth();
  const [step, setStep]           = useState<ModalStep>('detail');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]          = useState<string | null>(null);

  const genreName = typeof book.genreId === 'object' ? (book.genreId as BookGenre).name : '';
  const dueDateStr = book.dueDate
    ? new Date(book.dueDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' })
    : null;

  const divisionLabel = user ? getDivisionLabel(user.division) : '';
  const groupLabel    = user ? getGroupLabel(user.division, user.group) : '';
  const locationLabel = [divisionLabel, groupLabel].filter(Boolean).join(' · ');

  const handleOrder = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await requestLoan(book._id);
      setStep('success');
      onReload();
      onRefresh?.();
    } catch (e: unknown) {
      setError((e as { message?: string }).message ?? 'Помилка замовлення');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Detail step */}
        {step === 'detail' && (
          <>
            {/* Burgundy header */}
            <div className="bg-kameya-burgundy px-5 pt-5 pb-6 rounded-t-3xl sm:rounded-t-2xl relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <i className="fas fa-times text-xs"></i>
              </button>
              <div className="flex gap-4">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-24 h-36 object-cover rounded-xl flex-shrink-0 shadow-md" />
                ) : (
                  <div className="w-24 h-36 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-book text-3xl text-white/50"></i>
                  </div>
                )}
                <div className="flex-1 min-w-0 pt-1 pr-8">
                  <h2 className="text-base font-bold text-white leading-snug">{book.title}</h2>
                  <p className="text-sm text-white/70 mt-1">{book.author}</p>
                  {genreName && (
                    <span className="inline-block mt-2 text-xs bg-white/20 text-white px-2.5 py-0.5 rounded-full">{genreName}</span>
                  )}
                  <div className="mt-3">
                    {book.isBorrowed ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/80 bg-white/15 px-3 py-1.5 rounded-full">
                        <i className="fas fa-clock text-[10px]"></i>
                        {dueDateStr ? `Зайнята до ${dueDateStr}` : 'Зайнята'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-300 bg-white/10 px-3 py-1.5 rounded-full">
                        <i className="fas fa-check text-[10px]"></i>В наявності
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {book.annotation && (
              <div className="px-5 pt-4 pb-2 overflow-y-auto max-h-[35vh]">
                <p className="text-sm text-slate-600 leading-relaxed">{book.annotation}</p>
              </div>
            )}

            <div className="px-5 py-4 flex gap-3 border-t border-slate-100">
              <button onClick={onClose} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50">
                Закрити
              </button>
              {!book.isBorrowed && (
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 bg-kameya-burgundy text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-kameya-burgundy/90"
                >
                  Взяти книгу
                </button>
              )}
            </div>
          </>
        )}

        {/* Confirm step */}
        {step === 'confirm' && (
          <>
            <div className="p-5">
              <div className="flex items-center mb-4">
                <button onClick={() => setStep('detail')} className="text-slate-400 hover:text-slate-600">
                  <i className="fas fa-arrow-left"></i>
                </button>
                <h2 className="flex-1 text-center text-base font-bold text-slate-800">Підтвердження замовлення</h2>
                <div className="w-4" />
              </div>

              <div className="flex items-center gap-4 mb-5">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-14 h-20 object-cover rounded-lg flex-shrink-0 shadow-sm" />
                ) : (
                  <div className="w-14 h-20 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="fas fa-book text-slate-300 text-xl"></i>
                  </div>
                )}
                <div>
                  <p className="font-bold text-slate-900 text-base leading-snug">{book.title}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{book.author}</p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Отримувач</span>
                  <span className="font-medium text-slate-800">{user?.name || user?.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Локація</span>
                  <span className="font-medium text-slate-800 text-right max-w-[55%]">{locationLabel || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Термін</span>
                  <span className="font-medium text-slate-800">30 днів</span>
                </div>
              </div>

              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            </div>

            <div className="px-5 pb-5 flex gap-3">
              <button onClick={() => setStep('detail')} className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50">
                Назад
              </button>
              <button
                onClick={handleOrder}
                disabled={submitting}
                className="flex-1 bg-kameya-burgundy text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-kameya-burgundy/90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? <i className="fas fa-spinner fa-spin"></i> : 'Підтвердити'}
              </button>
            </div>
          </>
        )}

        {/* Success step */}
        {step === 'success' && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-check text-2xl text-green-600"></i>
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Дякуємо!</h2>
            <p className="text-sm text-slate-500 mb-6">HR скоро передасть тобі цю книгу 🙂</p>
            <button onClick={onClose} className="bg-kameya-burgundy text-white px-8 py-2.5 rounded-xl text-sm font-semibold hover:bg-kameya-burgundy/90">
              Чудово
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const LibraryView: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const [genres,     setGenres]     = useState<BookGenre[]>([]);
  const [books,      setBooks]      = useState<BookWithBorrowed[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [activeGenre, setActiveGenre] = useState<string>('');
  const [toast,      setToast]      = useState<string | null>(null);
  const [selected,   setSelected]   = useState<BookWithBorrowed | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try { const { books } = await getBooks({ limit: 100 }); setBooks(books); }
    catch { showToast('Помилка завантаження каталогу'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { getGenres().then(setGenres).catch(() => {}); }, []);
  useEffect(() => { loadBooks(); }, [loadBooks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter(b => {
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [books, search]);

  const byGenre = useMemo(() => {
    const genreMap = new Map<string, { name: string; books: BookWithBorrowed[] }>();
    for (const g of genres) genreMap.set(g._id, { name: g.name, books: [] });
    const noGenre: BookWithBorrowed[] = [];
    for (const b of filtered) {
      const gId = typeof b.genreId === 'object' ? (b.genreId as BookGenre)._id : b.genreId as string;
      if (gId && genreMap.has(gId)) {
        genreMap.get(gId)!.books.push(b);
      } else {
        noGenre.push(b);
      }
    }
    const sections = [...genreMap.values()].filter(s => s.books.length > 0);
    if (noGenre.length > 0) sections.push({ name: 'Інше', books: noGenre });
    if (!activeGenre) return sections;
    const active = genres.find(g => g._id === activeGenre);
    if (!active) return sections;
    return sections.filter(s => s.name === active.name);
  }, [filtered, genres, activeGenre]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}

      {selected && (
        <BookModal
          book={selected}
          onClose={() => setSelected(null)}
          onReload={loadBooks}
          onRefresh={onRefresh}
        />
      )}

      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800 flex-shrink-0">Бібліотека</h1>
        <input
          type="text"
          placeholder="Пошук за назвою або автором..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50"
        />
      </div>

      {/* Жанр-таби */}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveGenre('')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeGenre === ''
                ? 'bg-kameya-burgundy text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-kameya-burgundy/50 hover:text-kameya-burgundy'
            }`}
          >
            Всі
          </button>
          {genres.map(g => (
            <button
              key={g._id}
              onClick={() => setActiveGenre(g._id === activeGenre ? '' : g._id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeGenre === g._id
                  ? 'bg-kameya-burgundy text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-kameya-burgundy/50 hover:text-kameya-burgundy'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy"></i>
        </div>
      ) : byGenre.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <i className="fas fa-book-open text-4xl mb-3 block"></i>
          <p>Книг не знайдено</p>
        </div>
      ) : (
        <div className="space-y-6">
          {byGenre.map(section => (
            <section key={section.name}>
              <h2 className="text-base font-bold text-white bg-kameya-burgundy px-5 py-3 rounded-t-2xl tracking-wide">
                {section.name}
              </h2>
              <div className="rounded-b-2xl bg-white p-4 overflow-x-auto">
                <div className="flex gap-3 pb-1">
                  {section.books.map(book => (
                    <BookCard
                      key={book._id}
                      book={book}
                      onClick={() => setSelected(book)}
                    />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
