import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';
import { BookGenre } from '../models/BookGenre';
import { Book } from '../models/Book';
import { BookLoan, ACTIVE_LOAN_STATUSES } from '../models/BookLoan';
import { AccessMatrix } from '../models/AccessMatrix';
import { User } from '../models/User';

const BOOKS_DIR = path.join(process.cwd(), 'uploads', 'books');

const bookStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, BOOKS_DIR),
  filename: (_req, file, cb) => {
    const ext = file.mimetype.split('/')[1].replace('jpeg', 'jpg');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  },
});

const bookUpload = multer({
  storage: bookStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Тільки зображення'));
  },
});

function deleteCover(coverUrl: string) {
  if (!coverUrl) return;
  const filePath = path.join(process.cwd(), coverUrl.replace(/^\//, ''));
  fs.unlink(filePath, () => {});
}

async function checkLibraryAccess(req: AuthRequest): Promise<boolean> {
  if (req.user?.isAdmin) return true;
  const matrix = await AccessMatrix.findOne().lean();
  const rule = matrix?.rules.find(
    r => r.division === req.user?.division && r.position === req.user?.position
  );
  return rule?.modules?.library === true;
}

const router = Router();
router.use(authMiddleware);

// ── Genres ──────────────────────────────────────────────────────────────────

// GET /api/library/genres
router.get('/genres', async (_req: AuthRequest, res: Response) => {
  try {
    const genres = await BookGenre.find().sort({ sortOrder: 1, name: 1 });
    return res.json(genres);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PATCH /api/library/genres/reorder
router.patch('/genres/reorder', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids)) return res.status(400).json({ message: 'ids має бути масивом' });
    await Promise.all(ids.map((id, idx) => BookGenre.findByIdAndUpdate(id, { sortOrder: idx })));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/library/genres
router.post('/genres', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body as { name: string };
    if (!name?.trim()) return res.status(400).json({ message: 'Назва обов\'язкова' });
    const genre = await BookGenre.create({ name: name.trim() });
    return res.status(201).json(genre);
  } catch (e: any) {
    if (e.code === 11000) return res.status(409).json({ message: 'Жанр вже існує' });
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PUT /api/library/genres/:id
router.put('/genres/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.body as { name: string };
    if (!name?.trim()) return res.status(400).json({ message: 'Назва обов\'язкова' });
    const genre = await BookGenre.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { new: true }
    );
    if (!genre) return res.status(404).json({ message: 'Жанр не знайдено' });
    return res.json(genre);
  } catch (e: any) {
    if (e.code === 11000) return res.status(409).json({ message: 'Жанр вже існує' });
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// DELETE /api/library/genres/:id
router.delete('/genres/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const hasBooks = await Book.exists({ genreId: req.params.id });
    if (hasBooks) return res.status(400).json({ message: 'Жанр використовується книгами' });
    const deleted = await BookGenre.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Жанр не знайдено' });
    return res.json({ deleted: true });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// ── Books ────────────────────────────────────────────────────────────────────

// GET /api/library/books
router.get('/books', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkLibraryAccess(req))) return res.status(403).json({ message: 'Доступ заборонено' });

    const { genre, status, search, page = '1', limit = '20', includeInactive } = req.query as Record<string, string>;
    const isAdminIncludeInactive = includeInactive === 'true' && req.user?.isAdmin;
    const filter: Record<string, unknown> = isAdminIncludeInactive ? {} : { isActive: true };
    if (genre) filter.genreId = genre;
    if (search) filter.$or = [
      { title:  { $regex: search.trim(), $options: 'i' } },
      { author: { $regex: search.trim(), $options: 'i' } },
    ];

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const books = await Book.find(filter)
      .populate('genreId', 'name')
      .sort({ title: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum + 1);

    const hasMore = books.length > limitNum;
    if (hasMore) books.pop();

    // Визначаємо статус кожної книги
    const bookIds = books.map(b => b._id);
    const activeLoans = await BookLoan.find({
      bookId: { $in: bookIds },
      status: { $in: ACTIVE_LOAN_STATUSES },
    }).select('bookId dueDate').lean();
    const loanMap = new Map(activeLoans.map(l => [l.bookId.toString(), l.dueDate ?? null]));

    let result = books.map(b => ({
      ...b.toObject(),
      isBorrowed: loanMap.has(b._id.toString()),
      dueDate: loanMap.get(b._id.toString()) ?? null,
    }));

    if (status === 'available') result = result.filter(b => !b.isBorrowed);
    if (status === 'borrowed')  result = result.filter(b =>  b.isBorrowed);

    return res.json({ books: result, hasMore });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/library/books/:id
router.get('/books/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkLibraryAccess(req))) return res.status(403).json({ message: 'Доступ заборонено' });
    const book = await Book.findById(req.params.id).populate('genreId', 'name');
    if (!book) return res.status(404).json({ message: 'Книгу не знайдено' });

    const activeLoan = req.user?.isAdmin
      ? await BookLoan.findOne({ bookId: book._id, status: { $in: ACTIVE_LOAN_STATUSES } })
          .populate('userId', 'name phone')
          .lean()
      : null;

    return res.json({ ...book.toObject(), activeLoan });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/library/books
router.post('/books', adminOnly, (req: AuthRequest, res: Response) => {
  bookUpload.single('cover')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      const { title, author, genreId, annotation } = req.body as {
        title: string; author: string; genreId: string; annotation: string;
      };
      if (!title || !author || !genreId) {
        return res.status(400).json({ message: 'Назва, автор і жанр обов\'язкові' });
      }
      const coverUrl = req.file ? `/uploads/books/${req.file.filename}` : '';
      const book = await Book.create({ title, author, genreId, coverUrl, annotation: annotation ?? '' });
      return res.status(201).json(book);
    } catch {
      return res.status(500).json({ message: 'Помилка сервера' });
    }
  });
});

// PUT /api/library/books/:id
router.put('/books/:id', adminOnly, (req: AuthRequest, res: Response) => {
  bookUpload.single('cover')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    try {
      const book = await Book.findById(req.params.id);
      if (!book) return res.status(404).json({ message: 'Книгу не знайдено' });

      const { title, author, genreId, annotation, isActive: isActiveStr } = req.body as {
        title?: string; author?: string; genreId?: string; annotation?: string; isActive?: string;
      };
      const isActive = isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined;
      if (title     !== undefined) book.title     = title;
      if (author    !== undefined) book.author    = author;
      if (genreId   !== undefined) book.genreId   = genreId as any;
      if (annotation !== undefined) book.annotation = annotation;
      if (isActive  !== undefined) book.isActive  = isActive;
      if (req.file) {
        deleteCover(book.coverUrl);
        book.coverUrl = `/uploads/books/${req.file.filename}`;
      }
      await book.save();
      return res.json(book);
    } catch {
      return res.status(500).json({ message: 'Помилка сервера' });
    }
  });
});

// DELETE /api/library/books/:id — soft delete
router.delete('/books/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const activeLoan = await BookLoan.exists({ bookId: req.params.id, status: { $in: ACTIVE_LOAN_STATUSES } });
    if (activeLoan) return res.status(400).json({ message: 'Книга зараз на руках — не можна деактивувати' });
    const book = await Book.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!book) return res.status(404).json({ message: 'Книгу не знайдено' });
    return res.json({ hidden: true });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// ── Loans ────────────────────────────────────────────────────────────────────

// POST /api/library/loans/admin-create — admin creates a loan directly (active)
router.post('/loans/admin-create', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { bookId, userId, deliveredAt, dueDate } = req.body as {
      bookId: string; userId: string; deliveredAt?: string; dueDate?: string;
    };
    if (!bookId || !userId) return res.status(400).json({ message: 'bookId та userId обов\'язкові' });

    const book = await Book.findById(bookId);
    if (!book || !book.isActive) return res.status(404).json({ message: 'Книгу не знайдено або недоступна' });

    const alreadyBorrowed = await BookLoan.exists({ bookId, status: { $in: ACTIVE_LOAN_STATUSES } });
    if (alreadyBorrowed) return res.status(409).json({ message: 'Книга вже на руках у іншого співробітника' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    const hasActiveLoan = await BookLoan.exists({ userId, status: { $in: ACTIVE_LOAN_STATUSES } });
    if (hasActiveLoan) return res.status(409).json({ message: 'У цього користувача вже є активна позика' });

    const now = deliveredAt ? new Date(deliveredAt) : new Date();
    const due = dueDate ? new Date(dueDate) : (() => { const d = new Date(now); d.setDate(d.getDate() + 30); return d; })();

    const loan = await BookLoan.create({
      bookId,
      userId,
      status: 'active',
      requestedAt: now,
      deliveredAt: now,
      dueDate: due,
    });
    return res.status(201).json(loan);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/library/loans — employee requests a book
router.post('/loans', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkLibraryAccess(req))) return res.status(403).json({ message: 'Доступ заборонено' });
    const { bookId } = req.body as { bookId: string };
    if (!bookId) return res.status(400).json({ message: 'bookId обов\'язковий' });

    const book = await Book.findById(bookId);
    if (!book || !book.isActive) return res.status(404).json({ message: 'Книгу не знайдено або недоступна' });

    const alreadyBorrowed = await BookLoan.exists({ bookId, status: { $in: ACTIVE_LOAN_STATUSES } });
    if (alreadyBorrowed) return res.status(409).json({ message: 'Книга вже на руках у іншого співробітника' });

    const hasActiveLoan = await BookLoan.exists({
      userId: req.user!.userId,
      status: { $in: ACTIVE_LOAN_STATUSES },
    });
    if (hasActiveLoan) return res.status(409).json({ message: 'У вас вже є активна позика. Поверніть книгу перед тим як взяти нову.' });

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const loan = await BookLoan.create({ bookId, userId: req.user!.userId, dueDate });
    return res.status(201).json(loan);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/library/loans/pending-count — admin: count of pending loans
router.get('/loans/pending-count', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const count = await BookLoan.countDocuments({ status: { $in: ['pending', 'return_pending'] } });
    return res.json({ count });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/library/loans/my — employee: active + history
router.get('/loans/my', async (req: AuthRequest, res: Response) => {
  try {
    const loans = await BookLoan.find({ userId: req.user!.userId })
      .populate('bookId', 'title author coverUrl avgRating')
      .sort({ requestedAt: -1 })
      .lean();
    return res.json(loans);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/library/loans — admin: all loans with filters
router.get('/loans', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { status, overdue, search, page = '1', limit = '20' } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status && status !== 'all') filter.status = status;
    if (overdue === 'true') {
      filter.status = 'active';
      filter.dueDate = { $lt: new Date() };
    }
    if (search) {
      const users = await User.find({ name: { $regex: search.trim(), $options: 'i' } }, '_id').lean();
      const books = await Book.find({ title: { $regex: search.trim(), $options: 'i' } }, '_id').lean();
      filter.$or = [
        { userId: { $in: users.map(u => u._id) } },
        { bookId: { $in: books.map(b => b._id) } },
      ];
    }

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

    const loans = await BookLoan.find(filter)
      .populate('bookId', 'title author coverUrl')
      .populate('userId', 'name phone division group')
      .sort({ requestedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum + 1);

    const hasMore = loans.length > limitNum;
    if (hasMore) loans.pop();
    return res.json({ loans, hasMore });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PATCH /api/library/loans/:id/deliver — admin confirms delivery
router.patch('/loans/:id/deliver', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const loan = await BookLoan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Позику не знайдено' });
    if (loan.status !== 'pending') return res.status(400).json({ message: 'Книга не в очікуванні видачі' });

    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);

    loan.status      = 'active';
    loan.deliveredAt = now;
    loan.dueDate     = dueDate;
    await loan.save();
    return res.json(loan);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PATCH /api/library/loans/:id/extend — admin extends due date
router.patch('/loans/:id/extend', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { days } = req.body as { days: number };
    if (!days || days < 1) return res.status(400).json({ message: 'days має бути > 0' });

    const loan = await BookLoan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Позику не знайдено' });
    if (loan.status !== 'active') return res.status(400).json({ message: 'Можна подовжити лише активну позику' });

    const base = loan.dueDate ?? new Date();
    const newDue = new Date(base);
    newDue.setDate(newDue.getDate() + days);

    loan.dueDate             = newDue;
    loan.dueDateExtendedAt   = new Date();
    loan.warningDay27Sent    = false;
    loan.warningDay31Sent    = false;
    await loan.save();
    return res.json(loan);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/library/books/:id/reviews — public reviews for a book
router.get('/books/:id/reviews', async (req: AuthRequest, res: Response) => {
  try {
    if (!(await checkLibraryAccess(req))) return res.status(403).json({ message: 'Доступ заборонено' });
    const reviews = await BookLoan.find({
      bookId: req.params.id,
      status: 'returned',
      rating: { $exists: true },
      review: { $exists: true, $ne: '' },
    })
      .populate('userId', 'name')
      .select('rating review returnedAt userId')
      .sort({ returnedAt: -1 })
      .lean();
    return res.json(reviews);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PATCH /api/library/loans/:id/request-return — employee requests return
router.patch('/loans/:id/request-return', async (req: AuthRequest, res: Response) => {
  try {
    const { rating, review } = req.body as { rating?: number; review?: string };
    if (!rating || rating < 1 || rating > 10) return res.status(400).json({ message: 'Оцінка від 1 до 10 обов\'язкова' });
    if (!review?.trim()) return res.status(400).json({ message: 'Відгук про книгу обов\'язковий' });

    const loan = await BookLoan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Позику не знайдено' });
    if (loan.userId.toString() !== req.user!.userId) return res.status(403).json({ message: 'Доступ заборонено' });
    if (loan.status !== 'active') return res.status(400).json({ message: 'Можна повернути лише активну книгу' });

    loan.status             = 'return_pending';
    loan.returnRequestedAt  = new Date();
    loan.rating             = rating;
    loan.review             = review.trim();
    await loan.save();
    return res.json(loan);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PATCH /api/library/loans/:id/confirm-return — admin confirms return
router.patch('/loans/:id/confirm-return', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const loan = await BookLoan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Позику не знайдено' });
    if (loan.status !== 'return_pending') return res.status(400).json({ message: 'Книга не в статусі очікування повернення' });

    loan.status     = 'returned';
    loan.returnedAt = new Date();
    await loan.save();

    // Оновити avgRating у Book якщо є оцінка
    if (loan.rating) {
      const book = await Book.findById(loan.bookId);
      if (book) {
        const newCount  = book.ratingsCount + 1;
        const newAvg    = parseFloat(((book.avgRating * book.ratingsCount + loan.rating) / newCount).toFixed(2));
        book.avgRating    = newAvg;
        book.ratingsCount = newCount;
        await book.save();
      }
    }

    return res.json(loan);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PATCH /api/library/loans/:id/cancel
router.patch('/loans/:id/cancel', async (req: AuthRequest, res: Response) => {
  try {
    const loan = await BookLoan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Позику не знайдено' });
    if (loan.status !== 'pending') return res.status(400).json({ message: 'Можна скасувати лише очікуючий запит' });
    const isOwner = loan.userId.toString() === req.user!.userId;
    if (!req.user?.isAdmin && !isOwner) return res.status(403).json({ message: 'Доступ заборонено' });

    loan.status = 'cancelled';
    await loan.save();
    return res.json(loan);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// PATCH /api/library/loans/:id/force-cancel — admin: force cancel any active loan
router.patch('/loans/:id/force-cancel', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const loan = await BookLoan.findById(req.params.id);
    if (!loan) return res.status(404).json({ message: 'Позику не знайдено' });
    if (['returned', 'cancelled'].includes(loan.status)) {
      return res.status(400).json({ message: 'Позика вже завершена' });
    }
    loan.status = 'cancelled';
    await loan.save();
    return res.json(loan);
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/library/stats — admin: library dashboard statistics for a year
router.get('/stats', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const year  = parseInt((req.query.year as string) || String(new Date().getFullYear()), 10);
    const start = new Date(year, 0, 1);
    const end   = new Date(year + 1, 0, 1);
    const now   = new Date();

    // Load all returned loans in the year (populated)
    const returnedLoans = await BookLoan.find({
      status: 'returned',
      returnedAt: { $gte: start, $lt: end },
    })
      .populate('bookId', 'title')
      .populate('userId', 'name division group')
      .lean();

    const turnover = returnedLoans.length;

    // Currently on hands (all time, not filtered by year)
    const onHands = await BookLoan.countDocuments({ status: { $in: ['active', 'return_pending'] } });

    // Overdue (active past dueDate)
    const overdueCount = await BookLoan.countDocuments({ status: 'active', dueDate: { $lt: now } });

    // New readers: users whose first ever loan was in this year
    const newReadersAgg = await BookLoan.aggregate([
      { $group: { _id: '$userId', firstLoan: { $min: '$requestedAt' } } },
      { $match: { firstLoan: { $gte: start, $lt: end } } },
      { $count: 'count' },
    ]);
    const newReaders: number = newReadersAgg[0]?.count ?? 0;

    // Monthly turnover (12 months)
    const monthlyMap = new Array(12).fill(0);
    for (const loan of returnedLoans) {
      if (loan.returnedAt) monthlyMap[new Date(loan.returnedAt).getMonth()]++;
    }
    const monthlyTurnover = monthlyMap.map((count, i) => ({ month: i + 1, count }));

    // Division ranking (top 5 by group)
    const divMap = new Map<string, { division: string; group: string; count: number }>();
    for (const loan of returnedLoans) {
      const user = loan.userId as any;
      if (user?.group) {
        const key = `${user.division}:${user.group}`;
        if (!divMap.has(key)) divMap.set(key, { division: user.division, group: user.group, count: 0 });
        divMap.get(key)!.count++;
      }
    }
    const divisionRanking = Array.from(divMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top 5 books
    const bookMap = new Map<string, { title: string; count: number }>();
    for (const loan of returnedLoans) {
      const book = loan.bookId as any;
      if (book?._id) {
        const id = book._id.toString();
        if (!bookMap.has(id)) bookMap.set(id, { title: book.title ?? '', count: 0 });
        bookMap.get(id)!.count++;
      }
    }
    const topBooks = Array.from(bookMap.entries())
      .map(([id, d]) => ({ _id: id, title: d.title, count: d.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top 5 readers
    const readerMap = new Map<string, { name: string; division: string; group: string; count: number }>();
    for (const loan of returnedLoans) {
      const user = loan.userId as any;
      if (user?._id) {
        const id = user._id.toString();
        if (!readerMap.has(id)) readerMap.set(id, { name: user.name ?? '', division: user.division ?? '', group: user.group ?? '', count: 0 });
        readerMap.get(id)!.count++;
      }
    }
    const topReaders = Array.from(readerMap.entries())
      .map(([id, d]) => ({ _id: id, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Recent 2 reviews (not filtered by year)
    const recentReviews = await BookLoan.find({
      status: 'returned',
      review: { $exists: true, $ne: '' },
    })
      .populate('bookId', 'title')
      .populate('userId', 'name')
      .sort({ returnedAt: -1 })
      .limit(2)
      .lean();

    // Overdue loans table
    const overdueLoans = await BookLoan.find({ status: 'active', dueDate: { $lt: now } })
      .populate('bookId', 'title')
      .populate('userId', 'name division group')
      .sort({ dueDate: 1 })
      .lean();

    const overdueList = overdueLoans.map(loan => {
      const delivered = loan.deliveredAt ?? loan.requestedAt;
      const daysOnHands = Math.floor((now.getTime() - new Date(delivered).getTime()) / (1000 * 60 * 60 * 24));
      return {
        _id: loan._id,
        user: loan.userId,
        book: loan.bookId,
        deliveredAt: loan.deliveredAt,
        daysOnHands,
      };
    });

    // Average reading days (for returned loans in year that have both deliveredAt and returnedAt)
    const withTimes = returnedLoans.filter(l => l.returnedAt && l.deliveredAt);
    let avgReadingDays = 0;
    if (withTimes.length) {
      const totalDays = withTimes.reduce((sum, l) => {
        const days = Math.max(1, Math.round(
          (new Date(l.returnedAt!).getTime() - new Date(l.deliveredAt!).getTime()) / (1000 * 60 * 60 * 24)
        ));
        return sum + days;
      }, 0);
      avgReadingDays = Math.max(1, Math.round(totalDays / withTimes.length));
    }

    return res.json({
      turnover,
      onHands,
      overdueCount,
      newReaders,
      monthlyTurnover,
      divisionRanking,
      topBooks,
      topReaders,
      recentReviews: recentReviews.map(r => ({
        _id: r._id,
        bookTitle: (r.bookId as any)?.title ?? '',
        userName:  (r.userId  as any)?.name  ?? '',
        returnedAt: r.returnedAt,
        review: r.review,
        rating: r.rating,
      })),
      overdueLoans: overdueList,
      avgReadingDays,
    });
  } catch {
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

export default router;
