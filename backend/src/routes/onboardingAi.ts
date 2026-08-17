import { Router, Response } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { Trainee } from '../models/Trainee';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/analyze', authMiddleware, adminOnly, async (req: AuthRequest, res: Response) => {
  const { days, traineeName, traineeId } = req.body;

  if (!days || !traineeName || !traineeId) {
    return res.status(400).json({ error: 'Відсутні дані для аналізу' });
  }

  const reflections = days.filter((d: any) => d.reflection);
  if (reflections.length === 0) {
    return res.status(400).json({ error: 'Немає рефлексій для аналізу' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY не налаштований' });

  const summary = reflections.map((d: any) => {
    const r = d.reflection;
    return `День ${d.day}: настрій=${r.q1}/5, зрозумілість=${r.q2}/5, комфорт=${r.q3}/5, лояльність=${r.q5}/5` +
      (r.q4 ? `, стресори: "${r.q4}"` : '') +
      (r.comments ? `, коментар: "${r.comments}"` : '');
  }).join('\n');

  const prompt = `Ти — HR-менеджер салону краси Камея. Проаналізуй рефлексії стажера "${traineeName}" і дай короткий структурований звіт (4-6 речень) про:
- загальний емоційний стан та настрій
- атмосферу та комфорт у салоні
- питання або труднощі, що виникали
- загальне враження та рекомендації

Дані рефлексій (шкала 1-5):
${summary}

Відповідай українською мовою. Звіт має бути теплим, підтримуючим і конкретним.`;

  try {
    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = message.content.find((b) => b.type === 'text')
      ? (message.content.find((b) => b.type === 'text') as any).text
      : 'Не вдалося отримати відповідь.';

    await Trainee.findByIdAndUpdate(traineeId, {
      $push: { aiReports: { analysis: text, daysCount: reflections.length } },
    });

    res.json({ analysis: text });
  } catch (err) {
    console.error('Claude API error:', err);
    res.status(500).json({ error: 'Помилка AI сервісу' });
  }
});

export default router;
