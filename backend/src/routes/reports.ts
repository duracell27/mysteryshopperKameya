import { Router, Response } from 'express';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { Report } from '../models/Report';
import { User } from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { awardPoints } from '../services/pointsService';
import { PointsTransaction } from '../models/PointsTransaction';
import { getChunks } from '../services/standardsService';
import { syncStreakBonuses } from '../services/streakService';
import { checkAndAwardBirthday } from '../services/birthdayService';

function getTier(score: number): 'below85' | 'range85to94' | 'range95to99' | 'perfect100' {
  if (score === 100) return 'perfect100';
  if (score >= 95) return 'range95to99';
  if (score >= 85) return 'range85to94';
  return 'below85';
}

function buildSectionsText(sections: { title: string; score: number; maxScore: number; questions: { question: string; isCorrect: boolean }[] }[]): string {
  return sections.map(s => {
    const pct = Math.round((s.score / s.maxScore) * 100);
    const failed = s.questions.filter(q => !q.isCorrect).map(q => q.question);
    const failedStr = failed.length > 0 ? `\n  Невиконані: ${failed.join('; ')}` : '';
    return `- ${s.title}: ${s.score}/${s.maxScore} (${pct}%)${failedStr}`;
  }).join('\n');
}

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
    const { userId, auditId, location, date, totalScore, sections, fileName, quarter, year, month } = req.body;

    if (!userId || !date || totalScore === undefined || !quarter || !year) {
      return res.status(400).json({ message: 'Не вистачає обов\'язкових полів' });
    }

    const user = await User.findById(userId);
    const store = user?.store || '';

    const report = await Report.create({
      userId, auditId, location, store, date,
      quarter, year: Number(year),
      ...(month !== undefined && { month: Number(month) }),
      totalScore, sections, fileName,
    });

    const { pointsAwarded, totalPoints } = await awardPoints({
      userId,
      reportId: report._id as import('mongoose').Types.ObjectId,
      quarter,
      year: Number(year),
      totalScore,
    });

    // Recalculate streak bonuses after new report is added
    await syncStreakBonuses(userId, Number(year));

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

    // Рейтинг по середньому балу звітів серед усіх EMPLOYEE
    const totalUsers = await User.countDocuments({ role: 'EMPLOYEE' });
    const allReports = await Report.find({}, 'userId totalScore').lean();

    // Середній totalScore по кожному юзеру
    const scoreMap: Record<string, { sum: number; count: number }> = {};
    for (const r of allReports) {
      const uid = r.userId.toString();
      if (!scoreMap[uid]) scoreMap[uid] = { sum: 0, count: 0 };
      scoreMap[uid].sum += r.totalScore;
      scoreMap[uid].count += 1;
    }

    const avgScore = (uid: string) =>
      scoreMap[uid] ? scoreMap[uid].sum / scoreMap[uid].count : 0;

    // Зібрати всіх EMPLOYEE і посортувати за середнім балом
    const employees = await User.find({ role: 'EMPLOYEE' }, '_id').lean();
    const sorted = [...employees].sort(
      (a, b) => avgScore(b._id.toString()) - avgScore(a._id.toString())
    );

    const myIndex = sorted.findIndex(u => u._id.toString() === userId.toString());
    const myRank = myIndex === -1 ? totalUsers : myIndex + 1;
    const myAvg = Math.round(avgScore(userId.toString()) * 10) / 10;

    const tierNumber = Math.ceil(myRank / 10) * 10;
    const tier = `Топ ${tierNumber}`;

    return res.json({
      rank: myRank,
      totalUsers,
      totalScore: myAvg,
      tier,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка сервера' });
  }
});

// GET /api/reports/my — звіти поточного працівника
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Не авторизовано' });

    // Non-blocking birthday check — awards 15 pts if birthday passed this year and not yet awarded
    checkAndAwardBirthday(userId).catch(err =>
      console.error('[birthday] check failed:', err)
    );

    const reports = await Report.find({ userId }).sort({ createdAt: -1 });
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

// GET /api/reports/stats/dashboard — admin dashboard stats (period-aware)
router.get('/stats/dashboard', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  try {
    const periodType = (req.query.periodType as string) || 'year';
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
    const quarter = req.query.quarter as string | undefined;
    const month = req.query.month ? Number(req.query.month) : undefined;

    // Build filter for the selected period
    const filter: Record<string, unknown> = { year };
    if (periodType === 'quarter' && quarter) filter.quarter = quarter;
    if (periodType === 'month' && month) filter.month = month;

    const periodReports = await Report.find(filter)
      .populate('userId', 'name store')
      .lean();

    // ── Period avg & count ──
    const periodAvg = periodReports.length
      ? Math.round((periodReports.reduce((s, r) => s + r.totalScore, 0) / periodReports.length) * 10) / 10
      : null;
    const reportCount = periodReports.length;

    // ── Store ranking ──
    const storeMap: Record<string, { sum: number; count: number }> = {};
    for (const r of periodReports) {
      const store = r.store || (typeof r.userId === 'object' && r.userId && 'store' in r.userId ? (r.userId as { store?: string }).store : '') || 'Не вказано';
      if (!storeMap[store]) storeMap[store] = { sum: 0, count: 0 };
      storeMap[store].sum += r.totalScore;
      storeMap[store].count += 1;
    }
    const storeRanking = Object.entries(storeMap)
      .map(([store, { sum, count }]) => ({ store, avg: Math.round((sum / count) * 10) / 10, count }))
      .sort((a, b) => b.avg - a.avg);

    // ── Consultant ranking ──
    const consultantMap: Record<string, { name: string; sum: number; count: number }> = {};
    for (const r of periodReports) {
      const uid = typeof r.userId === 'object' && r.userId
        ? (r.userId as { _id: { toString(): string } })._id.toString()
        : String(r.userId);
      const name = typeof r.userId === 'object' && r.userId && 'name' in r.userId
        ? ((r.userId as { name?: string }).name || '—')
        : '—';
      if (!consultantMap[uid]) consultantMap[uid] = { name, sum: 0, count: 0 };
      consultantMap[uid].sum += r.totalScore;
      consultantMap[uid].count += 1;
    }
    const consultantRanking = Object.values(consultantMap)
      .map(({ name, sum, count }) => ({ name, avg: Math.round((sum / count) * 10) / 10, count }))
      .sort((a, b) => b.avg - a.avg);

    return res.json({ year, periodType, periodAvg, reportCount, storeRanking, consultantRanking });
  } catch (error) {
    console.error('dashboard stats error:', error);
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

// POST /api/reports/:id/generate-ai — generate AI recommendations (employee or admin)
router.post('/:id/generate-ai', async (req: AuthRequest, res: Response) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    const isOwner = report.userId.toString() === req.user?.userId?.toString();
    const isAdmin = req.user?.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Доступ заборонено' });

    const tier = getTier(report.totalScore);
    if (tier === 'perfect100') {
      return res.status(400).json({ message: 'Для 100% рекомендації не генеруються' });
    }

    // Return existing if already generated
    if (report.aiRecommendations) {
      return res.json(report);
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sectionsText = buildSectionsText(report.sections as { title: string; score: number; maxScore: number; questions: { question: string; isCorrect: boolean }[] }[]);

    const prompt = `Ти — аналітик результатів таємного покупця ювелірного магазину.
Проаналізуй звіт і поверни ТІЛЬКИ валідний JSON без markdown та пояснень.

Загальна оцінка: ${report.totalScore}%
Тір: ${tier}
Секції:
${sectionsText}

Поверни JSON у форматі:
{
  "tier": "${tier}",
  "mainMessage": "...",
  "weakPoints": ["...", "..."],
  "question": "..." або null
}

Правила:
- weakPoints для below85: рівно 3 конкретні пункти, кожен починається з назви секції через двокрапку
- weakPoints для range85to94: рівно 1 пункт, починається з назви секції через двокрапку
- weakPoints для range95to99: порожній масив []
- mainMessage для below85: "Є над чим попрацювати — ось три точки зростання:"
- mainMessage для range85to94: "Один крок до відмінного результату:"
- mainMessage для range95to99: одне речення-привітання з результатом
- question для range95to99: "Що допомогло тобі досягти такого результату?"
- question для below85 та range85to94: null
- Всі тексти виключно українською мовою, конкретно, без загальних фраз`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();
    const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed: { tier: string; mainMessage: string; weakPoints: unknown[]; question: unknown };
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('generate-ai: invalid JSON from Claude:', text.substring(0, 500));
      return res.status(500).json({ message: 'AI повернув невалідну відповідь. Спробуйте ще раз.' });
    }

    if (parsed.tier !== tier || typeof parsed.mainMessage !== 'string' || !parsed.mainMessage.trim()) {
      console.error('generate-ai: unexpected AI response shape:', parsed);
      return res.status(500).json({ message: 'AI повернув невалідну відповідь. Спробуйте ще раз.' });
    }

    const aiData = {
      tier: parsed.tier as 'below85' | 'range85to94' | 'range95to99',
      mainMessage: parsed.mainMessage.trim(),
      weakPoints: Array.isArray(parsed.weakPoints)
        ? parsed.weakPoints.filter((p): p is string => typeof p === 'string')
        : [],
      question: typeof parsed.question === 'string' ? parsed.question : null,
      generatedAt: new Date(),
    };

    // Atomic update — prevents race condition if two requests arrive simultaneously
    const saved = await Report.findOneAndUpdate(
      { _id: report._id, aiRecommendations: { $exists: false } },
      { $set: { aiRecommendations: aiData } },
      { new: true }
    );

    if (!saved) {
      return res.json(await Report.findById(report._id));
    }

    return res.json(saved);
  } catch (error) {
    console.error('generate-ai error:', error);
    return res.status(500).json({ message: 'Помилка генерації рекомендацій' });
  }
});

// POST /api/reports/:id/score-insight — employee submits their response
router.post('/:id/score-insight', async (req: AuthRequest, res: Response) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    if (report.userId.toString() !== req.user?.userId?.toString()) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    if (report.scoreInsight) {
      return res.status(409).json({ message: 'Відповідь вже надіслано' });
    }

    const tier = getTier(report.totalScore);
    const { goalText, whatHelpedText } = req.body;

    if (goalText && goalText.length > 2000) {
      return res.status(400).json({ message: 'Ціль не може перевищувати 2000 символів' });
    }
    if (whatHelpedText && whatHelpedText.length > 2000) {
      return res.status(400).json({ message: 'Відповідь не може перевищувати 2000 символів' });
    }

    if (tier === 'below85' && !goalText?.trim()) {
      return res.status(400).json({ message: 'Поле "ціль" обов\'язкове' });
    }
    if (tier === 'range95to99' && !whatHelpedText?.trim()) {
      return res.status(400).json({ message: 'Поле відповіді обов\'язкове' });
    }

    report.scoreInsight = {
      tier,
      ...(tier === 'below85' && { goalText: goalText.trim() }),
      ...(tier === 'range85to94' && { confirmedAt: new Date() }),
      ...(tier === 'range95to99' && { whatHelpedText: whatHelpedText.trim() }),
      submittedAt: new Date(),
    };
    await report.save();

    return res.json(report);
  } catch (error) {
    console.error('score-insight error:', error);
    return res.status(500).json({ message: 'Помилка збереження' });
  }
});

// POST /api/reports/:id/generate-learning-plan
router.post('/:id/generate-learning-plan', async (req: AuthRequest, res: Response) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    const isOwner = report.userId.toString() === req.user?.userId?.toString();
    const isAdmin = req.user?.role === 'ADMIN';
    if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Доступ заборонено' });

    if (!report.aiRecommendations) {
      return res.status(400).json({ message: 'Спочатку згенеруйте AI рекомендації' });
    }

    const tier = report.aiRecommendations.tier;
    if (tier !== 'below85' && tier !== 'range85to94') {
      return res.status(400).json({ message: 'План навчання генерується лише для тірів below85 та range85to94' });
    }

    // Idempotent for non-admins — return existing plan if already generated
    if (report.learningPlan && !isAdmin) {
      return res.json(report);
    }

    const taskCount = tier === 'below85' ? 6 : 3;
    const weakPoints = report.aiRecommendations.weakPoints;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const chunks = await getChunks();

    let contextText = '';

    if (chunks.length > 0) {
      const titlesText = chunks.map(c => `${c.index}: ${c.title}`).join('\n');
      const step1Prompt = `Ти аналітик навчання. Визнач найбільш релевантні розділи стандартів до слабких пунктів аудиту.
Поверни ТІЛЬКИ валідний JSON масив числових індексів (максимум 6) найбільш релевантних розділів.

Слабкі пункти:
${weakPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Розділи стандартів:
${titlesText}

Формат відповіді: [0, 3, 7]`;

      const step1Res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: step1Prompt }],
      });

      const step1Raw = (step1Res.content[0] as { type: string; text: string }).text.trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

      try {
        const parsed = JSON.parse(step1Raw);
        if (Array.isArray(parsed)) {
          const indices = parsed
            .filter((i): i is number => typeof i === 'number' && i >= 0 && i < chunks.length)
            .slice(0, 6);
          contextText = indices.map(i => `=== ${chunks[i].title} ===\n${chunks[i].content}`).join('\n\n');
        }
      } catch {
        console.warn('[generate-learning-plan] step 1 index selection failed, proceeding without standards context');
      }
    }

    const contextSection = contextText ? `\nРелевантні розділи стандартів обслуговування:\n${contextText}\n` : '';

    const step2Prompt = `Ти тренер з продажів ювелірного магазину. Створи план навчання на основі слабких пунктів аудиту.
Поверни ТІЛЬКИ валідний JSON масив з рівно ${taskCount} задачами.
${contextSection}
Слабкі пункти:
${weakPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Формат кожної задачі:
{
  "topicTitle": "Назва теми або проблеми (до 60 символів)",
  "description": "Конкретне практичне завдання (1-2 речення, українська)"
}

Правила:
- ${tier === 'below85' ? 'Рівно 6 задач: по 2 задачі на кожен з 3 слабких пунктів. topicTitle кожної задачі — це назва слабкого пункту.' : 'Від 2 до 3 задач для одного слабкого пункту. topicTitle — назва слабкого пункту.'}
- description: конкретна дія (що переглянути, що відпрацювати, який розділ стандартів опрацювати)
- Якщо є розділи стандартів — обов'язково вкажи конкретний розділ у description
- Без загальних порад, тільки конкретні дії`;

    let parsedTasks: { topicTitle: string; description: string }[] = [];

    for (let attempt = 0; attempt < 2; attempt++) {
      const step2Res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: step2Prompt }],
      });

      const step2Raw = (step2Res.content[0] as { type: string; text: string }).text.trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

      try {
        const parsed = JSON.parse(step2Raw);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0]?.topicTitle === 'string') {
          parsedTasks = parsed.filter(
            (t): t is { topicTitle: string; description: string } =>
              typeof t.topicTitle === 'string' && typeof t.description === 'string'
          );
          break;
        }
      } catch {
        if (attempt === 1) {
          console.error('[generate-learning-plan] step 2 failed both attempts. Raw:', step2Raw.substring(0, 300));
          return res.status(500).json({ message: 'AI повернув невалідну відповідь при генерації плану. Спробуйте ще раз.' });
        }
      }
    }

    if (parsedTasks.length === 0) {
      return res.status(500).json({ message: 'Не вдалось згенерувати план навчання' });
    }

    const generatedAt = new Date();
    const deadlineDays = Math.min(10, 5 + parsedTasks.length);
    const deadline = new Date(generatedAt.getTime() + deadlineDays * 24 * 60 * 60 * 1000);

    const learningPlanData = {
      tasks: parsedTasks.map(t => ({
        topicTitle: t.topicTitle.trim(),
        description: t.description.trim(),
        isCompleted: false,
      })),
      generatedAt,
      deadline,
    };

    const saved = isAdmin
      ? await Report.findByIdAndUpdate(report._id, { $set: { learningPlan: learningPlanData } }, { new: true })
      : await Report.findOneAndUpdate(
          { _id: report._id, learningPlan: { $exists: false } },
          { $set: { learningPlan: learningPlanData } },
          { new: true }
        );

    return res.json(saved ?? await Report.findById(report._id));
  } catch (error) {
    console.error('generate-learning-plan error:', error);
    return res.status(500).json({ message: 'Помилка генерації плану навчання' });
  }
});

// DELETE /api/reports/:id/learning-plan — admin only
router.delete('/:id/learning-plan', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $unset: { learningPlan: '' } },
      { new: true }
    );
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });
    return res.json(report);
  } catch (error) {
    console.error('delete-learning-plan error:', error);
    return res.status(500).json({ message: 'Помилка видалення плану' });
  }
});

// PATCH /api/reports/:id/learning-plan — admin only, replaces tasks array
router.patch('/:id/learning-plan', async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }
    const { tasks } = req.body as { tasks: { topicTitle: string; description: string; isCompleted: boolean; completedAt?: string; response?: string }[] };
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({ message: 'Масив задач не може бути порожнім' });
    }
    const invalid = tasks.some(t => typeof t.topicTitle !== 'string' || !t.topicTitle.trim() || typeof t.description !== 'string' || !t.description.trim());
    if (invalid) {
      return res.status(400).json({ message: 'Кожна задача повинна мати непорожні topicTitle і description' });
    }
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });
    if (!report.learningPlan) return res.status(400).json({ message: 'План навчання не існує' });

    report.learningPlan.tasks = tasks as any;
    report.markModified('learningPlan');
    await report.save();
    return res.json(report);
  } catch (error) {
    console.error('update-learning-plan error:', error);
    return res.status(500).json({ message: 'Помилка оновлення плану' });
  }
});

// PATCH /api/reports/:id/learning-plan/:taskIndex — toggle task completion
router.patch('/:id/learning-plan/:taskIndex', async (req: AuthRequest, res: Response) => {
  try {
    const taskIndex = parseInt(req.params.taskIndex, 10);
    if (isNaN(taskIndex) || taskIndex < 0) {
      return res.status(400).json({ message: 'Невалідний індекс задачі' });
    }

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });

    if (report.userId.toString() !== req.user?.userId?.toString()) {
      return res.status(403).json({ message: 'Доступ заборонено' });
    }

    if (!report.learningPlan || taskIndex >= report.learningPlan.tasks.length) {
      return res.status(400).json({ message: 'Задача не знайдена' });
    }

    const task = report.learningPlan.tasks[taskIndex];
    const { response } = req.body as { response?: string };

    if (!task.isCompleted) {
      if (!response || response.trim().length < 300) {
        return res.status(400).json({ message: 'Необхідно написати розгорнуту відповідь (мін. 300 символів)' });
      }
      task.response = response.trim();
    }

    task.isCompleted = !task.isCompleted;
    task.completedAt = task.isCompleted ? new Date() : undefined;

    report.markModified('learningPlan');
    await report.save();

    return res.json(report);
  } catch (error) {
    console.error('toggle-learning-task error:', error);
    return res.status(500).json({ message: 'Помилка збереження' });
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

// PATCH /api/reports/:id — оновити базові поля звіту (адмін)
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }
  try {
    const { quarter, year, month } = req.body as { quarter?: string; year?: number; month?: number | null };
    const update: Record<string, unknown> = {};
    if (quarter !== undefined) update.quarter = quarter;
    if (year !== undefined) update.year = Number(year);
    if (month !== undefined) update.month = month !== null ? Number(month) : undefined;

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).populate('userId', 'name phone store');

    if (!report) return res.status(404).json({ message: 'Звіт не знайдено' });
    return res.json(report);
  } catch (error) {
    console.error('patch-report error:', error);
    return res.status(500).json({ message: 'Помилка оновлення звіту' });
  }
});

// DELETE /api/reports/:id — видалити звіт (адмін)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Доступ заборонено' });
  }

  try {
    const { id } = req.params;
    const report = await Report.findById(id);

    if (!report) {
      return res.status(404).json({ message: 'Звіт не знайдено' });
    }

    // Знайти всі транзакції по цьому звіту і порахувати скільки балів треба відняти
    const transactions = await PointsTransaction.find({ reportId: id });
    const pointsToRemove = transactions.reduce((sum, t) => sum + t.pointsAwarded, 0);

    // Видалити транзакції і звіт
    await PointsTransaction.deleteMany({ reportId: id });
    await report.deleteOne();

    // Відняти бали від юзера (мінімум 0)
    if (pointsToRemove > 0) {
      await User.findByIdAndUpdate(report.userId, [
        { $set: { points: { $max: [{ $subtract: ['$points', pointsToRemove] }, 0] } } },
      ]);
    }

    // Recalculate streak bonuses after report is removed
    await syncStreakBonuses(report.userId, report.year);

    return res.json({ message: 'Звіт видалено', id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Помилка видалення звіту' });
  }
});

export default router;
