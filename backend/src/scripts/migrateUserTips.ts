/**
 * One-time migration: drops the old tips.date_1 unique index and
 * removes any existing tip documents (they were shared across all users).
 * The new schema creates a compound {userId, date} unique index automatically.
 *
 * Run on local:      npx ts-node src/scripts/migrateUserTips.ts
 * Run on production: MONGODB_URI=<prod_uri> npx ts-node src/scripts/migrateUserTips.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI не задано у .env');

  await mongoose.connect(uri);
  console.log('MongoDB підключено');

  const db = mongoose.connection.db!;
  const tipsCol = db.collection('tips');

  // Drop old single-field unique index on date if it exists
  try {
    await tipsCol.dropIndex('date_1');
    console.log('Старий індекс date_1 видалено');
  } catch {
    console.log('Індекс date_1 не знайдено (вже відсутній)');
  }

  // Remove all existing tips — they were shared and have no userId
  const { deletedCount } = await tipsCol.deleteMany({});
  console.log(`Видалено ${deletedCount} старих записів tips`);

  await mongoose.disconnect();
  console.log('Готово. Нові поради генеруватимуться per-user автоматично.');
}

main().catch(err => { console.error(err); process.exit(1); });
