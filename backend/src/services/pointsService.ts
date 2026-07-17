import { Types } from 'mongoose';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';

export function calculatePoints(totalScore: number): number {
  const floored = Math.floor(totalScore);
  if (floored === 100) return 100;
  if (floored >= 97)   return 55;
  if (floored >= 93)   return 35;
  if (floored >= 88)   return 18;
  if (floored >= 80)   return 8;
  if (floored >= 70)   return 2;
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
