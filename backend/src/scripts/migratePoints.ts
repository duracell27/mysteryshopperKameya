import 'dotenv/config';
import { connectDB } from '../db';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';

async function run() {
  await connectDB();

  const users = await User.find({});
  let updated = 0;

  for (const user of users) {
    const transactions = await PointsTransaction.find({ userId: user._id });
    const total = transactions.reduce((sum, tx) => sum + tx.pointsAwarded, 0);
    if (user.points !== total) {
      await User.findByIdAndUpdate(user._id, { points: total });
      console.log(`${user.name || user.phone}: ${user.points ?? 'немає поля'} → ${total}`);
      updated++;
    }
  }

  console.log(`\nГотово. Оновлено ${updated} користувачів.`);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
