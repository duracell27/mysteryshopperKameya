import { Types } from 'mongoose';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';

const BIRTHDAY_POINTS = 15;

// Called when an employee loads their data.
// Awards 15 pts if today >= their birthday in the current year and not yet awarded this year.
export async function checkAndAwardBirthday(
  userId: string | Types.ObjectId,
): Promise<void> {
  const user = await User.findById(userId, 'birthday').lean();
  if (!user?.birthday) return;

  const today = new Date();
  const currentYear = today.getFullYear();
  const bday = new Date(user.birthday);

  // Birthday this calendar year
  const bdayThisYear = new Date(currentYear, bday.getMonth(), bday.getDate());

  // Don't award if birthday hasn't arrived yet this year
  if (today < bdayThisYear) return;

  // Idempotency — already awarded this year?
  const already = await PointsTransaction.findOne({
    userId,
    reason: 'birthday',
    birthdayYear: currentYear,
  });
  if (already) return;

  const currentQ = `Q${Math.ceil((today.getMonth() + 1) / 3)}`;

  await PointsTransaction.create({
    userId,
    year: currentYear,
    quarter: currentQ,
    scorePercent: 0,
    pointsAwarded: BIRTHDAY_POINTS,
    reason: 'birthday',
    birthdayYear: currentYear,
  });

  await User.findByIdAndUpdate(userId, { $inc: { points: BIRTHDAY_POINTS } });
}
