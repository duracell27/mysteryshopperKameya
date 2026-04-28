import 'dotenv/config';
import { connectDB } from '../db';
import { Report } from '../models/Report';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';

async function run() {
  await connectDB();

  // Знайти всі транзакції де reportId вказує на неіснуючий звіт
  const allTransactions = await PointsTransaction.find({});
  const orphaned: string[] = [];

  for (const tx of allTransactions) {
    const exists = await Report.exists({ _id: tx.reportId });
    if (!exists) orphaned.push(String(tx._id));
  }

  if (orphaned.length === 0) {
    console.log('Осиротілих транзакцій не знайдено.');
    process.exit(0);
  }

  console.log(`Знайдено ${orphaned.length} осиротілих транзакцій. Видаляємо...`);
  await PointsTransaction.deleteMany({ _id: { $in: orphaned } });
  console.log('Видалено.');

  // Перерахувати бали для всіх юзерів з решти транзакцій
  const users = await User.find({});
  let updated = 0;
  for (const user of users) {
    const transactions = await PointsTransaction.find({ userId: user._id });
    const total = transactions.reduce((sum, tx) => sum + tx.pointsAwarded, 0);
    if (user.points !== total) {
      await User.findByIdAndUpdate(user._id, { points: total });
      console.log(`${user.name || user.phone}: ${user.points ?? '?'} → ${total}`);
      updated++;
    }
  }

  console.log(`\nГотово. Оновлено балів у ${updated} користувачів.`);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });
