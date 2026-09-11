import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Book, BookGenre } from '../../types';
import {
  getGenres, createGenre, updateGenre, deleteGenre, reorderGenres,
  getBooks, createBook, updateBook, deactivateBook,
} from '../../services/libraryService';

type Tab = 'books' | 'genres';

interface BookFormData {
  title: string; author: string; genreId: string; annotation: string;
}

const EMPTY_FORM: BookFormData = { title: '', author: '', genreId: '', annotation: '' };

export const AdminLibraryBooksView: React.FC = () => {
  const [tab,     setTab]     = useState<Tab>('books');
  const [genres,  setGenres]  = useState<BookGenre[]>([]);
  const [books,   setBooks]   = useState<(Book & { isBorrowed: boolean })[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState<string | null>(null);

  // Book modal
  const [bookModal, setBookModal] = useState<{ mode: 'create' | 'edit'; book?: Book } | null>(null);
  const [form,     setForm]     = useState<BookFormData>(EMPTY_FORM);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving,   setSaving]   = useState(false);

  // Genre modal
  const [genreModal, setGenreModal] = useState<{ mode: 'create' | 'edit'; genre?: BookGenre } | null>(null);
  const [genreName,  setGenreName]  = useState('');
  const [savingGenre, setSavingGenre] = useState(false);

  // Genre drag state
  const dragIndex = useRef<number | null>(null);

  // Filter
  const [search, setSearch] = useState('');
  const [filterGenre, setFilterGenre] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [g, b] = await Promise.all([
        getGenres(),
        getBooks({ search: search || undefined, genre: filterGenre || undefined, includeInactive: true }),
      ]);
      setGenres(g);
      setBooks(b);
    } catch { showToast('Помилка завантаження'); }
    finally { setLoading(false); }
  }, [search, filterGenre]);

  useEffect(() => { loadData(); }, [loadData]);

  const openBookCreate = () => { setForm(EMPTY_FORM); setCoverFile(null); setBookModal({ mode: 'create' }); };
  const openBookEdit = (book: Book) => {
    const gid = typeof book.genreId === 'object' ? (book.genreId as BookGenre)._id : book.genreId;
    setForm({ title: book.title, author: book.author, genreId: gid, annotation: book.annotation });
    setCoverFile(null);
    setBookModal({ mode: 'edit', book });
  };

  const handleSaveBook = async () => {
    if (!form.title || !form.author || !form.genreId) {
      showToast('Назва, автор і жанр обов\'язкові'); return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('title',      form.title);
      fd.append('author',     form.author);
      fd.append('genreId',    form.genreId);
      fd.append('annotation', form.annotation);
      if (coverFile) fd.append('cover', coverFile);

      if (bookModal?.mode === 'create') {
        await createBook(fd);
        showToast('Книгу додано');
      } else if (bookModal?.book) {
        await updateBook(bookModal.book._id, fd);
        showToast('Книгу оновлено');
      }
      setBookModal(null);
      loadData();
    } catch (e: unknown) { showToast((e as Error).message ?? 'Помилка'); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Деактивувати книгу?')) return;
    try { await deactivateBook(id); showToast('Книгу деактивовано'); loadData(); }
    catch (e: unknown) { showToast((e as Error).message ?? 'Помилка'); }
  };

  const handleRestore = async (id: string) => {
    try { await updateBook(id, { isActive: true }); showToast('Книгу відновлено'); loadData(); }
    catch (e: unknown) { showToast((e as Error).message ?? 'Помилка'); }
  };

  const handleSaveGenre = async () => {
    if (!genreName.trim()) { showToast('Назва обов\'язкова'); return; }
    setSavingGenre(true);
    try {
      if (genreModal?.mode === 'create') { await createGenre(genreName.trim()); showToast('Жанр додано'); }
      else if (genreModal?.genre) { await updateGenre(genreModal.genre._id, genreName.trim()); showToast('Жанр оновлено'); }
      setGenreModal(null);
      loadData();
    } catch (e: unknown) { showToast((e as Error).message ?? 'Помилка'); }
    finally { setSavingGenre(false); }
  };

  const handleDeleteGenre = async (id: string) => {
    if (!confirm('Видалити жанр?')) return;
    try { await deleteGenre(id); showToast('Жанр видалено'); loadData(); }
    catch (e: unknown) { showToast((e as Error).message ?? 'Помилка'); }
  };

  const handleDragStart = (idx: number) => { dragIndex.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === idx) return;
    const next = [...genres];
    const [moved] = next.splice(dragIndex.current, 1);
    next.splice(idx, 0, moved);
    dragIndex.current = idx;
    setGenres(next);
  };
  const handleDrop = async () => {
    dragIndex.current = null;
    try { await reorderGenres(genres.map(g => g._id)); }
    catch { showToast('Помилка збереження порядку'); }
  };

  const genreName_of = (book: Book) =>
    typeof book.genreId === 'object' ? (book.genreId as BookGenre).name : '';

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {toast && (
        <div className="fixed top-4 right-4 z-[100] bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl text-sm">{toast}</div>
      )}

      {/* Book modal */}
      {bookModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg mt-10 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              {bookModal.mode === 'create' ? 'Додати книгу' : 'Редагувати книгу'}
            </h3>
            {[
              { label: 'Назва', key: 'title' as const },
              { label: 'Автор', key: 'author' as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-sm font-medium text-slate-700 block mb-1">{label}</label>
                <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50" />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Жанр</label>
              <select value={form.genreId} onChange={e => setForm(f => ({ ...f, genreId: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50">
                <option value="">Оберіть жанр</option>
                {genres.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Анотація</label>
              <textarea rows={3} value={form.annotation} onChange={e => setForm(f => ({ ...f, annotation: e.target.value }))}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50 resize-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Обкладинка</label>
              <input type="file" accept="image/*" onChange={e => setCoverFile(e.target.files?.[0] ?? null)}
                className="text-sm text-slate-600" />
            </div>
            <div className="flex space-x-3 pt-2">
              <button onClick={() => setBookModal(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">Скасувати</button>
              <button onClick={handleSaveBook} disabled={saving}
                className="flex-1 bg-kameya-burgundy text-white py-2 rounded-lg text-sm font-medium hover:bg-kameya-burgundy/90 disabled:opacity-50">
                {saving ? <i className="fas fa-spinner fa-spin"></i> : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Genre modal */}
      {genreModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-800">
              {genreModal.mode === 'create' ? 'Додати жанр' : 'Редагувати жанр'}
            </h3>
            <input value={genreName} onChange={e => setGenreName(e.target.value)}
              placeholder="Назва жанру"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50" />
            <div className="flex space-x-3">
              <button onClick={() => setGenreModal(null)}
                className="flex-1 border border-slate-300 text-slate-700 py-2 rounded-lg text-sm hover:bg-slate-50">Скасувати</button>
              <button onClick={handleSaveGenre} disabled={savingGenre}
                className="flex-1 bg-kameya-burgundy text-white py-2 rounded-lg text-sm font-medium hover:bg-kameya-burgundy/90 disabled:opacity-50">
                {savingGenre ? <i className="fas fa-spinner fa-spin"></i> : 'Зберегти'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Бібліотека — Каталог</h1>
        <button onClick={tab === 'books' ? openBookCreate : () => { setGenreName(''); setGenreModal({ mode: 'create' }); }}
          className="bg-kameya-burgundy text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-kameya-burgundy/90 flex items-center space-x-2">
          <i className="fas fa-plus"></i>
          <span>{tab === 'books' ? 'Додати книгу' : 'Додати жанр'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 border-b border-slate-200">
        {(['books', 'genres'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-kameya-burgundy text-kameya-burgundy' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}>
            {t === 'books' ? 'Книги' : 'Жанри'}
          </button>
        ))}
      </div>

      {tab === 'books' && (
        <>
          <div className="flex flex-wrap gap-3">
            <input type="text" placeholder="Пошук..." value={search} onChange={e => setSearch(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50" />
            <select value={filterGenre} onChange={e => setFilterGenre(e.target.value)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kameya-burgundy/50">
              <option value="">Всі жанри</option>
              {genres.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><i className="fas fa-spinner fa-spin text-xl text-kameya-burgundy"></i></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Книга</th>
                    <th className="pb-3 font-medium">Жанр</th>
                    <th className="pb-3 font-medium">Рейтинг</th>
                    <th className="pb-3 font-medium">Статус</th>
                    <th className="pb-3 font-medium">Дії</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {books.map(book => (
                    <tr key={book._id} className="hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <div className="flex items-center space-x-3">
                          {book.coverUrl
                            ? <img src={book.coverUrl} alt="" className="w-10 h-14 object-cover rounded" />
                            : <div className="w-10 h-14 bg-slate-100 rounded flex items-center justify-center"><i className="fas fa-book text-slate-300 text-xs"></i></div>
                          }
                          <div>
                            <p className="font-medium text-slate-800">{book.title}</p>
                            <p className="text-xs text-slate-500">{book.author}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{genreName_of(book)}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        {book.ratingsCount > 0
                          ? <span className="text-yellow-500">★ {book.avgRating.toFixed(1)} <span className="text-slate-400 text-xs">({book.ratingsCount})</span></span>
                          : <span className="text-slate-400 text-xs">—</span>
                        }
                      </td>
                      <td className="py-3 pr-4">
                        {book.isActive === false
                          ? <span className="bg-slate-100 text-slate-400 text-xs px-2 py-0.5 rounded-full">Деактивована</span>
                          : book.isBorrowed
                            ? <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full inline-flex flex-col items-center leading-tight">
                                <span>Зайнята</span>
                                {book.dueDate && <span className="opacity-75">до {new Date(book.dueDate).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })}</span>}
                              </span>
                            : <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">Вільна</span>
                        }
                      </td>
                      <td className="py-3">
                        <div className="flex space-x-2">
                          <button onClick={() => openBookEdit(book)}
                            className="text-slate-500 hover:text-kameya-burgundy transition-colors" title="Редагувати">
                            <i className="fas fa-pen text-xs"></i>
                          </button>
                          {book.isActive === false
                            ? (
                              <button onClick={() => handleRestore(book._id)}
                                className="text-slate-500 hover:text-green-600 transition-colors text-xs" title="Відновити">
                                Відновити
                              </button>
                            ) : (
                              <button onClick={() => handleDeactivate(book._id)}
                                className="text-slate-500 hover:text-red-500 transition-colors" title="Деактивувати">
                                <i className="fas fa-eye-slash text-xs"></i>
                              </button>
                            )
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {books.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">Книг не знайдено</p>}
            </div>
          )}
        </>
      )}

      {tab === 'genres' && (
        <div className="space-y-2">
          {genres.map((g, idx) => (
            <div
              key={g._id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={e => handleDragOver(e, idx)}
              onDrop={handleDrop}
              className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-4 py-3 cursor-grab active:cursor-grabbing select-none"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-grip-vertical text-slate-300 text-xs flex-shrink-0"></i>
                <span className="text-slate-800 text-sm">{g.name}</span>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => { setGenreName(g.name); setGenreModal({ mode: 'edit', genre: g }); }}
                  className="text-slate-400 hover:text-kameya-burgundy"><i className="fas fa-pen text-xs"></i></button>
                <button onClick={() => handleDeleteGenre(g._id)}
                  className="text-slate-400 hover:text-red-500"><i className="fas fa-trash text-xs"></i></button>
              </div>
            </div>
          ))}
          {genres.length === 0 && <p className="text-center py-8 text-slate-400 text-sm">Жанрів поки немає</p>}
          {genres.length > 1 && (
            <p className="text-center text-[11px] text-slate-300 pt-1">
              <i className="fas fa-grip-vertical mr-1"></i>Перетягніть для зміни порядку
            </p>
          )}
        </div>
      )}
    </div>
  );
};
