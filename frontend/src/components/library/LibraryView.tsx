import React, { useEffect, useState, useCallback } from 'react';
import { Book, BookGenre } from '../../types';
import { getGenres, getBooks, requestLoan } from '../../services/libraryService';

const StarRating: React.FC<{ value: number; count: number }> = ({ value, count }) => {
  if (count === 0) return <span className="text-xs text-slate-400">Без оцінок</span>;
  return (
    <div className="flex items-center space-x-1">
      <span className="text-yellow-400 text-xs">{'★'.repeat(Math.round(value))}{'☆'.repeat(10 - Math.round(value))}</span>
      <span className="text-xs text-slate-500">{value.toFixed(1)} ({count})</span>
    </div>
  );
};

export const LibraryView: React.FC = () => {
  const [genres,  setGenres]  = useState<BookGenre[]>([]);
  const [books,   setBooks]   = useState<(Book & { isBorrowed: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [genre,   setGenre]   = useState('');
  const [status,  setStatus]  = useState<'all' | 'available' | 'borrowed'>('all');
  const [toast,   setToast]   = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params: Parameters<typeof getBooks>[0] = {};
      if (genre) params.genre = genre;
      if (status !== 'all') params.status = status;
      if (search.trim()) params.search = search.trim();
      setBooks(await getBooks(params));
    } catch { showToast('Помилка завантаження каталогу'); }
    finally { setLoading(false); }
  }, [genre, status, search]);

  useEffect(() => { getGenres().then(setGenres).catch(() => {}); }, []);
  useEffect(() => { loadBooks(); }, [loadBooks]);

  const handleRequest = async (bookId: string) => {
    setRequesting(bookId);
    try {
      await requestLoan(bookId);
      showToast('Запит надіслано! Очікуйте доставки на ваш відділ.');
      loadBooks();
    } catch (e: unknown) {
      showToast((e as { message?: string }).message ?? 'Помилка замовлення');
    } finally { setRequesting(null); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Бібліотека</h1>
      </div>

      {/* Фільтри */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Пошук за назвою або автором..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50"
        />
        <select
          value={genre}
          onChange={e => setGenre(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50"
        >
          <option value="">Всі жанри</option>
          {genres.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
        </select>
        <select
          value={status}
          onChange={e => setStatus(e.target.value as typeof status)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50"
        >
          <option value="all">Всі книги</option>
          <option value="available">Вільні</option>
          <option value="borrowed">Зайняті</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <i className="fas fa-spinner fa-spin text-2xl text-kameya-burgundy"></i>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <i className="fas fa-book-open text-4xl mb-3"></i>
          <p>Книг не знайдено</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map(book => {
            const genreName = typeof book.genreId === 'object' ? (book.genreId as BookGenre).name : '';
            return (
              <div key={book._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt={book.title} className="w-full h-48 object-cover" />
                ) : (
                  <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                    <i className="fas fa-book text-4xl text-slate-300"></i>
                  </div>
                )}
                <div className="p-4 flex flex-col flex-1 space-y-2">
                  <h3 className="font-semibold text-slate-800 leading-tight line-clamp-2">{book.title}</h3>
                  <p className="text-sm text-slate-500">{book.author}</p>
                  {genreName && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full w-fit">{genreName}</span>
                  )}
                  <StarRating value={book.avgRating} count={book.ratingsCount} />
                  <div className="mt-auto pt-2">
                    {book.isBorrowed ? (
                      <span className="inline-flex items-center space-x-1 text-sm text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg w-full justify-center">
                        <i className="fas fa-lock text-xs"></i>
                        <span>Недоступна</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => handleRequest(book._id)}
                        disabled={!!requesting}
                        className="w-full bg-kameya-burgundy text-white py-1.5 rounded-lg text-sm font-medium hover:bg-kameya-burgundy/90 transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
                      >
                        {requesting === book._id
                          ? <i className="fas fa-spinner fa-spin"></i>
                          : <><i className="fas fa-bookmark"></i><span>Замовити</span></>
                        }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
