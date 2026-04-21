import { Router, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { Report } from '../models/Report';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { awardPoints } from '../services/pointsService';
import { PointsTransaction } from '../models/PointsTransaction';

const router = Router();
router.use(authMiddleware);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Тільки PDF файли'));
  },
});

const EXTRACTION_PROMPT = `Ти отримав PDF файл зі звітом таємного покупця ювелірного магазину українською мовою.
Проаналізуй його та поверни ТІЛЬКИ ВАЛІДНИЙ JSON без жодного додаткового тексту, пояснень чи markdown блоків.

КРИТИЧНО ВАЖЛИВО:
1. ВСЕ строкові значення МАЮТЬ бути екрановані: замість " використовуй \\"
2. Замість переносів рядків використовуй \\n
3. Замість символів \\ використовуй \\\\
4. JSON ПОВИНЕН бути 100% валідним - без помилок синтаксису!

ПРАВИЛА ДЛЯ ПОЛЯ "answer" (ВАЖЛИВО!):
Це поле ЗАВЖДИ повинно містити числове значення оцінки, отримане за питання:
- Якщо оцінка за питання 4 бали з 4 → "answer": "4"
- Якщо оцінка за питання 8 з 10 → "answer": "8"
- Якщо оцінка за питання "Так" (1 бал) → "answer": "1"
- Якщо оцінка за питання "Ні" (0 балів) → "answer": "0"
- НІКОЛИ не залишай це поле порожнім!

ПРАВИЛА ДАНИХ:
1. TOTALSCORE: число від 0 до 100 (завжди як число, не строка)
2. Для кожного питання:
   - "score": число балів, отримане за це питання (наприклад 4, 8, 0, 1)
   - "answer": строка з тим же числом (наприклад "4", "8", "0", "1") - ОБОВ'ЯЗКОВО!
   - "isCorrect": true якщо score > 0, інакше false
   - "isImportant": true якщо це обов'язковий критерій для оцінки, false якщо інформаційне питання без балів
   - "comment": коментар з PDF або порожня строка ""
3. "feedback": коментар про розділ (ЕКРАНУЙ спеціальні символи!)
4. "question": текст питання (ЕКРАНУЙ спеціальні символи!)
5. "maxScores": масив максимальних балів для кожного підпункту розділу

ПРИКЛАД З РІЗНИМИ ТИПАМИ ОЦІНОК:
{
  "auditId": "6_IF_Dniстровська",
  "location": "Івано-Франківськ, вул. Дністровська 3",
  "date": "2025-11-06",
  "totalScore": 97.06,
  "sections": [
    {
      "title": "Вітання",
      "score": 12,
      "maxScore": 15,
      "maxScores": [4, 5, 6],
      "feedback": "Працівник був привітний та доступний.",
      "questions": [
        {
          "question": "Чи дотримано стандарту зустрічі? (макс. 4)",
          "answer": "4",
          "score": 4,
          "isCorrect": true,
          "isImportant": true,
          "comment": "Відмінна зустріч"
        },
        {
          "question": "Оцінка ввічливості (шкала 0-10)",
          "answer": "8",
          "score": 8,
          "isCorrect": true,
          "isImportant": true,
          "comment": "Дуже привітна"
        }
      ]
    }
  ]
}

ОБОВ'ЯЗКОВО: Поверни ТІЛЬКИ JSON, нічого більше! Не залишай поле "answer" порожнім!`;

// POST /api/reports/parse — надсилаємо PDF до Claude, повертаємо розпізнані дані
router.post('/parse', (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  upload.single('pdf')(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'Файл не завантажено' });

    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: req.file.buffer.toString('base64'),
              },
            } as never,
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        }],
      });

      const raw = (response.content[0] as { type: string; text: string }).text.trim();
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (jsonError) {
        console.error('JSON parse failed. Raw response:', text.substring(0, 1000));
        console.error('JSON error:', jsonError);

        // Спробувати виправити деякі поширені проблеми
        try {
          let fixed = text;

          // Замінити реальні переноси рядків на \n в усіх значеннях
          // Використовуємо більш агресивний підхід з лапками
          let inString = false;
          let escaped = false;
          let result = '';

          for (let i = 0; i < fixed.length; i++) {
            const char = fixed[i];
            const nextChar = fixed[i + 1];

            if (escaped) {
              result += char;
              escaped = false;
              continue;
            }

            if (char === '\\') {
              result += char;
              escaped = true;
              continue;
            }

            if (char === '"') {
              inString = !inString;
              result += char;
              continue;
            }

            // Якщо всередину рядка переніс - замінити на \n
            if (inString && (char === '\n' || char === '\r')) {
              result += '\\n';
              // Пропустити наступний символ якщо це \r\n або \n\r
              if ((char === '\r' && nextChar === '\n') || (char === '\n' && nextChar === '\r')) {
                i++;
              }
              continue;
            }

            result += char;
          }

          parsed = JSON.parse(result);
          console.log('JSON успішно виправлено автоматично');
        } catch (fixError) {
          console.error('Fix attempt failed:', fixError);
          return res.status(500).json({
            message: 'Claude повернув невалідний JSON. Спробуйте інший файл або перевірте формат PDF.',
            debug: jsonError instanceof Error ? jsonError.message : String(jsonError)
          });
        }
      }

      let fileName = req.file.originalname || 'report.pdf';
      try {
        fileName = Buffer.from(fileName, 'latin1').toString('utf8');
      } catch {
        // залишимо як є, якщо конвертація не вдалась
      }
      return res.json({ ...parsed, fileName });
    } catch (error) {
      console.error('Claude parse error:', error);
      return res.status(500).json({ message: 'Помилка аналізу PDF. Перевірте формат файлу.' });
    }
  });
});

// POST /api/reports/confirm — адмін підтверджує, зберігаємо до бази
router.post('/confirm', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  try {
    const { userId, auditId, location, date, totalScore, sections, fileName, quarter, year } = req.body;

    if (!userId || !date || totalScore === undefined || !quarter || !year) {
      return res.status(400).json({ message: 'Не вистачає обов\'язкових полів' });
    }

    const user = await User.findById(userId);
    const store = user?.store || '';

    const report = await Report.create({
      userId, auditId, location, store, date,
      quarter, year: Number(year),
      totalScore, sections, fileName,
    });

    const { pointsAwarded, totalPoints } = await awardPoints({
      userId,
      reportId: report._id as import('mongoose').Types.ObjectId,
      quarter,
      year: Number(year),
      totalScore,
    });

    return res.status(201).json({ ...report.toObject(), pointsAwarded, totalPoints });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка збереження' });
  }
});

// GET /api/reports/my/rank — ранг користувача серед всіх
router.get('/my/rank', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Не авторизовано' });
    }

    // Отримати всі звіти та згрупувати по користувачам
    const allReports = await Report.find();

    // Обчислити суму балів для кожного користувача
    const userScores: { [key: string]: number } = {};
    allReports.forEach(report => {
      const uid = report.userId.toString();
      userScores[uid] = (userScores[uid] || 0) + (report.totalScore || 0);
    });

    // Сортувати користувачів за балами (спадаючи)
    const sortedUsers = Object.entries(userScores)
      .sort(([, scoreA], [, scoreB]) => scoreB - scoreA)
      .map(([uid], index) => ({ userId: uid, rank: index + 1 }));

    // Знайти ранг поточного користувача
    const userRank = sortedUsers.find(u => u.userId === userId.toString());
    const totalUsers = sortedUsers.length;
    const userTotalScore = userScores[userId.toString()] || 0;

    // Визначити рівень на основі рангу (кожні 10 позицій)
    let tier = 'Топ 100+';
    if (userRank) {
      const tierNumber = Math.ceil(userRank.rank / 10) * 10;
      tier = `Топ ${tierNumber}`;
    }

    return res.json({
      rank: userRank?.rank || totalUsers + 1,
      totalUsers,
      totalScore: userTotalScore,
      tier
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/reports/my — звіти поточного працівника
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const reports = await Report.find({ userId: req.user?.userId }).sort({ createdAt: -1 });
    return res.json(reports);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/reports/my/transactions — історія балів поточного працівника
router.get('/my/transactions', async (req: AuthRequest, res: Response) => {
  try {
    const transactions = await PointsTransaction.find({ userId: req.user?.userId })
      .sort({ createdAt: -1 });
    return res.json(transactions);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/reports — всі звіти (адмін)
router.get('/', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  try {
    const reports = await Report.find().populate('userId', 'name phone store').sort({ createdAt: -1 });
    return res.json(reports);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// POST /api/reports/:id/reflection — employee submits reflection
router.post('/:id/reflection', async (req: AuthRequest, res: Response) => {
  try {
    const { answer1, answer2 } = req.body;

    if (!answer1?.trim() || !answer2?.trim()) {
      return res.status(400).json({ message: 'Обидві відповіді обов\'язкові' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ message: 'Звіт не знайдено' });
    }

    if (report.userId.toString() !== req.user?.userId?.toString()) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    if (report.reflection) {
      return res.status(409).json({ message: 'Рефлексію вже подано' });
    }

    const MS_72H = 72 * 60 * 60 * 1000;
    const isOnTime = Date.now() - report.createdAt.getTime() <= MS_72H;

    report.reflection = {
      answer1: answer1.trim(),
      answer2: answer2.trim(),
      submittedAt: new Date(),
      isOnTime,
      bonusPointsAwarded: isOnTime,
    };
    await report.save();

    if (isOnTime) {
      await User.findByIdAndUpdate(report.userId, { $inc: { points: 10 } });
      await PointsTransaction.create({
        userId: report.userId,
        reportId: report._id,
        quarter: report.quarter,
        year: report.year,
        scorePercent: 0,
        pointsAwarded: 10,
      });
    }

    return res.json(report);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// DELETE /api/reports/:id — видалити звіт (адмін)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  try {
    const { id } = req.params;
    const report = await Report.findByIdAndDelete(id);

    if (!report) {
      return res.status(404).json({ message: 'Звіт не знайдено' });
    }

    return res.json({ message: 'Звіт видалено', id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка видалення звіту' });
  }
});

export default router;
