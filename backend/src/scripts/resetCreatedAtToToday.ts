import 'dotenv/config';
import { connectDB } from '../db';
import { Report } from '../models/Report';

async function run() {
  await connectDB();

  const now = new Date();

  // Знаходимо всі звіти без рефлексії
  const preview = await Report.find({ reflection: { $exists: false } }, '_id fileName createdAt').lean();

  console.log(`\nЗнайдено ${preview.length} звітів без рефлексії:`);
  for (const r of preview) {
    console.log(`  ${r.fileName} | createdAt: ${(r.createdAt as Date).toISOString()}`);
  }

  if (preview.length === 0) {
    console.log('Нічого оновлювати.');
    process.exit(0);
  }

  console.log(`\nНова дата: ${now.toISOString()}`);
  console.log('Продовжити? (Ctrl+C щоб скасувати, Enter щоб підтвердити)');

  await new Promise<void>(resolve => process.stdin.once('data', () => resolve()));

  // Використовуємо collection.updateMany щоб обійти Mongoose timestamps і оновити createdAt напряму
  const result = await Report.collection.updateMany(
    { reflection: { $exists: false } },
    { $set: { createdAt: now } }
  );

  console.log(`\n✅ Оновлено ${result.modifiedCount} звітів. createdAt = ${now.toISOString()}`);
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
