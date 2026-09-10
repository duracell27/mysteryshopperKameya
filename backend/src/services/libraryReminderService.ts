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
      const dueDateStr = loan.dueDate.toLocaleDateString('uk-UA');

      if (daysLeft <= 3 && !loan.warningDay27Sent) {
        const msg = `Kameya: нагадування — поверніть книгу «${title}» до ${dueDateStr}.`;
        await sendSms(user.phone, msg).catch(console.error);
        await BookLoan.findByIdAndUpdate(loan._id, { warningDay27Sent: true });
      }

      if (daysLeft < 0 && !loan.warningDay31Sent) {
        const msg = `Kameya: термін повернення книги «${title}» минув ${dueDateStr}. Будь ласка, поверніть якнайшвидше.`;
        await sendSms(user.phone, msg).catch(console.error);
        await BookLoan.findByIdAndUpdate(loan._id, { warningDay31Sent: true });
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
