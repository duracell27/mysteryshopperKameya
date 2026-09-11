<title>Бібліотека</title>
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Book, BookGenre } from '../../types';
import { getGenres, getBooks, requestLoan } from '../../services/libraryService';

type BookWithBorrowed = Book & { isBorrowed: boolean };

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
  requesting: string | null;
  onRequest: (id: string) => void;
}> = ({ book, requesting, onRequest }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col w-[140px] flex-shrink-0">
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
      <StarRating value={book.avgRating} count={book.ratingsCount} />
      <div className="mt-auto pt-1">
        {book.isBorrowed ? (
          <span className="flex items-center justify-center gap-1 text-[10px] text-slate-400 bg-slate-100 px-2 py-1 rounded-md w-full">
            <i className="fas fa-lock text-[9px]"></i>Недоступна
          </span>
        ) : (
          <button
            onClick={() => onRequest(book._id)}
            disabled={!!requesting}
            className="w-full bg-kameya-burgundy text-white py-1 rounded-md text-[10px] font-medium hover:bg-kameya-burgundy/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {requesting === book._id
              ? <i className="fas fa-spinner fa-spin text-[10px]"></i>
              : <><i className="fas fa-bookmark text-[9px]"></i>Замовити</>
            }
          </button>
        )}
      </div>
    </div>
  </div>
);

export const LibraryView: React.FC = () => {
  const [genres,     setGenres]     = useState<BookGenre[]>([]);
  const [books,      setBooks]      = useState<BookWithBorrowed[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState<'all' | 'available' | 'borrowed'>('all');
  const [toast,      setToast]      = useState<string | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try { setBooks(await getBooks({})); }
    catch { showToast('Помилка завантаження каталогу'); }
    finally { setLoading(false); }
  }, []);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return books.filter(b => {
      if (status === 'available' && b.isBorrowed) return false;
      if (status === 'borrowed' && !b.isBorrowed) return false;
      if (q && !b.title.toLowerCase().includes(q) && !b.author.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [books, search, status]);

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
    return sections;
  }, [filtered, genres]);

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm">
          {toast}
        </div>
      )}

      <h1 className="text-2xl font-bold text-slate-800">Бібліотека</h1>

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
                      requesting={requesting}
                      onRequest={handleRequest}
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
