/**
 * One-time script: removes all streak bonus transactions and subtracts
 * the corresponding points from each user.
 *
 * Run on local:      npx ts-node src/scripts/removeStreakBonuses.ts
 * Run on production: MONGODB_URI=<prod_uri> npx ts-node src/scripts/removeStreakBonuses.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { PointsTransaction } from '../models/PointsTransaction';
import { User } from '../models/User';

dotenv.config();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI не задано у .env');

  await mongoose.connect(uri);
  console.log('MongoDB підключено');

  const streakTxs = await PointsTransaction.find({ reason: 'streak' });
  console.log(`Знайдено ${streakTxs.length} стрік-транзакцій`);

  if (streakTxs.length === 0) {
    console.log('Нічого видаляти');
    await mongoose.disconnect();
    return;
  }

  // Group points by user
  const byUser: Record<string, number> = {};
  for (const tx of streakTxs) {
    const uid = tx.userId.toString();
    byUser[uid] = (byUser[uid] ?? 0) + tx.pointsAwarded;
  }

  // Subtract points from each affected user
  for (const [uid, pts] of Object.entries(byUser)) {
    await User.findByIdAndUpdate(uid, [
      { $set: { points: { $max: [{ $subtract: ['$points', pts] }, 0] } } },
    ]);
    console.log(`  Користувач ${uid}: -${pts} балів`);
  }

  // Delete all streak transactions
  const { deletedCount } = await PointsTransaction.deleteMany({ reason: 'streak' });
  console.log(`Видалено ${deletedCount} транзакцій`);

  await mongoose.disconnect();
  console.log('Готово');
}

main().catch(err => { console.error(err); process.exit(1); });
