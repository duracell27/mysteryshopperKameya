import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { Tip } from '../models/Tip';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/tips/today — отримати пораду дня
router.get('/today', async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Спробуємо знайти пораду для сьогодні
    let tip = await Tip.findOne({ date: today });

    if (!tip) {
      // Якщо поради немає, генеруємо її через Claude
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Напиши коротку (1-2 речення), корисну та мотивуючу пораду дня для консультантів/гідів магазину про покращення якості обслуговування клієнтів.

          Пораду напиши українською мовою, зроби її позитивною та практичною. Без додатків, деталей чи лапок - просто текст поради.`,
        }],
      });

      const content = (response.content[0] as { type: string; text: string }).text.trim();

      // Зберігаємо нову пораду
      tip = await Tip.create({ date: today, content });
    }

    return res.json({ date: tip.date, content: tip.content });
  } catch (error) {
    console.error('Tip generation error:', error);
    return res.status(500).json({ message: 'Помилка завантаження поради дня' });
  }
});

export default router;
