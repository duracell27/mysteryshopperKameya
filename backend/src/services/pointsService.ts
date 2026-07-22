import { Types } from 'mongoose';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';

export function calculatePoints(totalScore: number): number {
  const rounded = Math.round(totalScore);
  if (rounded === 100) return 100;
  if (rounded >= 97)   return 60;
  if (rounded >= 94)   return 50;
  if (rounded >= 85)   return 40;
  if (rounded >= 70)   return 20;
  return 0;
}

export async function applyReflectionPenalty(params: {
  userId: Types.ObjectId | string;
  reportId: Types.ObjectId | string;
  quarter: string;
  year: number;
  scorePercent: number;
  pointsToDeduct: number;
}): Promise<void> {
  const { userId, reportId, quarter, year, scorePercent, pointsToDeduct } = params;

  await PointsTransaction.create({
    userId,
    reportId,
    quarter,
    year,
    scorePercent,
    pointsAwarded: -pointsToDeduct,
    reason: 'reflection_penalty',
    note: 'Не вчасно заповнена рефлексія',
  });

  await User.findByIdAndUpdate(userId, [
    { $set: { points: { $max: [{ $subtract: ['$points', pointsToDeduct] }, 0] } } },
  ]);
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
