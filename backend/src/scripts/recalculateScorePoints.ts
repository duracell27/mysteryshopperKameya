import 'dotenv/config';
import mongoose from 'mongoose';
import { PointsTransaction } from '../models/PointsTransaction';
import { User } from '../models/User';
import { calculatePoints } from '../services/pointsService';

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI не задано у .env');

  await mongoose.connect(uri);
  console.log('MongoDB підключено\n');

  const scoreTxs = await PointsTransaction.find({ reason: 'score' });
  console.log(`Знайдено ${scoreTxs.length} score-транзакцій\n`);

  let txUpdated = 0;

  for (const tx of scoreTxs) {
    const newPoints = calculatePoints(tx.scorePercent);
    if (tx.pointsAwarded !== newPoints) {
      console.log(`  Транзакція ${tx._id}: ${tx.scorePercent}% → ${tx.pointsAwarded} балів → ${newPoints} балів`);
      await PointsTransaction.findByIdAndUpdate(tx._id, { pointsAwarded: newPoints });
      txUpdated++;
    }
  }

  console.log(`\nОновлено транзакцій: ${txUpdated}\n`);

  // Recalculate user totals from all transactions
  const users = await User.find({});
  let usersUpdated = 0;

  for (const user of users) {
    const transactions = await PointsTransaction.find({ userId: user._id });
    const newTotal = transactions.reduce((sum, tx) => sum + tx.pointsAwarded, 0);
    const safeTotal = Math.max(newTotal, 0);

    if (user.points !== safeTotal) {
      console.log(`  Користувач ${user.name || user.phone}: ${user.points ?? 0} → ${safeTotal} балів`);
      await User.findByIdAndUpdate(user._id, { points: safeTotal });
      usersUpdated++;
    }
  }

  console.log(`\nОновлено користувачів: ${usersUpdated}`);
  console.log('\nГотово.');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
