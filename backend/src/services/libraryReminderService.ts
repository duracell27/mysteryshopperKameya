import cron from 'node-cron';
import { BookLoan } from '../models/BookLoan';
import { Book } from '../models/Book';
import { User } from '../models/User';
import { sendSms } from './sms';

function daysUntil(date: Date): number {
  const now   = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function processLoanReminders(): Promise<void> {
  try {
    const activeLoans = await BookLoan.find({ status: 'active', dueDate: { $exists: true } }).lean();

    for (const loan of activeLoans) {
      if (!loan.dueDate) continue;
      const daysLeft = daysUntil(loan.dueDate);

      const user = await User.findById(loan.userId).lean();
      if (!user) continue;

      const book = await Book.findById(loan.bookId).select('title').lean();
      const title = book?.title ?? 'книгу';

      // Нагадування за 3 дні (27-й день)
      if (daysLeft === 3 && !loan.warningDay27Sent) {
        const msg = `Привіт! Термін користування книгою «${title}» закінчується через 3 дні. Встигаєш дочитати чи готовий(а) повернути?`;
        try {
          await sendSms(user.phone, msg);
          await BookLoan.findByIdAndUpdate(loan._id, { warningDay27Sent: true });
        } catch (e) {
          console.error('SMS send failed for loan', loan._id, e);
        }
      }

      // Сповіщення про прострочення (31-й день і далі)
      if (daysLeft < 0 && !loan.warningDay31Sent) {
        const msg = `Привіт! 30 днів користування книгою «${title}» минули. Будь ласка, поверни книгу в HR-відділ або звернися до HR для продовження.`;
        try {
          await sendSms(user.phone, msg);
          await BookLoan.findByIdAndUpdate(loan._id, { warningDay31Sent: true });
        } catch (e) {
          console.error('SMS send failed for loan', loan._id, e);
        }
      }
    }

    console.log('[Library Cron] Loan reminders processed');
  } catch (err) {
    console.error('[Library Cron] Error processing reminders:', err);
  }
}

export function scheduleLoanReminders(): void {
  // Запускається щодня о 10:00
  cron.schedule('0 10 * * *', processLoanReminders);
  console.log('[Library Cron] Loan reminder scheduler started');
}
