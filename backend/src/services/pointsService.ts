import { Types } from 'mongoose';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';

export function calculatePoints(totalScore: number): number {
  const floored = Math.floor(totalScore);
  if (floored === 100) return 200;
  if (floored >= 95)   return 150;
  if (floored >= 90)   return 100;
  if (floored >= 80)   return 50;
  return 0;
}

export async function awardPoints(params: {
  userId: Types.ObjectId | string;
  reportId: Types.ObjectId | string;
  quarter: string;
  year: number;
  totalScore: number;
}): Promise<{ pointsAwarded: number; totalPoints: number }> {
  const { userId, reportId, quarter, year, totalScore } = params;
  const pointsAwarded = calculatePoints(totalScore);

  await PointsTransaction.create({
    userId,
    reportId,
    quarter,
    year,
    scorePercent: totalScore,
    pointsAwarded,
  });

  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { points: pointsAwarded } },
    { new: true }
  );

  return {
    pointsAwarded,
    totalPoints: updated?.points ?? 0,
  };
}
