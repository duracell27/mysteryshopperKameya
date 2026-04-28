import { Types } from 'mongoose';
import { Report } from '../models/Report';
import { User } from '../models/User';
import { PointsTransaction } from '../models/PointsTransaction';

const QUARTER_ORDER: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
const STREAK_BONUS: Record<number, number> = { 2: 50, 3: 100, 4: 150 };

// Returns which streak milestones (2, 3, 4) are reached given a set of reports for one year.
function calcMilestones(reports: { quarter: string; totalScore: number }[]): number[] {
  // One score per quarter — take the highest if duplicates exist
  const byQuarter: Record<number, number> = {};
  for (const r of reports) {
    const q = QUARTER_ORDER[r.quarter];
    if (q === undefined) continue;
    if (byQuarter[q] === undefined || r.totalScore > byQuarter[q]) {
      byQuarter[q] = r.totalScore;
    }
  }

  const milestones: number[] = [];
  let streak = 0;
  let prevQ = 0;

  for (const q of [1, 2, 3, 4]) {
    if (byQuarter[q] === undefined) {
      // No report for this quarter — gap resets streak
      streak = 0;
      prevQ = 0;
      continue;
    }
    // Gap between existing quarters also resets streak
    if (prevQ > 0 && q !== prevQ + 1) {
      streak = 0;
    }
    if (byQuarter[q] > 90) {
      streak++;
      if (streak >= 2 && STREAK_BONUS[streak]) {
        milestones.push(streak);
      }
    } else {
      streak = 0;
    }
    prevQ = q;
  }

  return milestones;
}

export async function syncStreakBonuses(
  userId: string | Types.ObjectId,
  year: number,
): Promise<void> {
  const reports = await Report.find({ userId, year }, 'quarter totalScore').lean();
  const shouldHave = calcMilestones(reports);

  const existing = await PointsTransaction.find({
    userId,
    reason: 'streak',
    streakYear: year,
  });

  // Add missing milestones
  for (const m of shouldHave) {
    if (!existing.find(t => t.streakQuarters === m)) {
      const pts = STREAK_BONUS[m];
      await PointsTransaction.create({
        userId,
        year,
        scorePercent: 0,
        pointsAwarded: pts,
        reason: 'streak',
        streakQuarters: m,
        streakYear: year,
      });
      await User.findByIdAndUpdate(userId, { $inc: { points: pts } });
    }
  }

  // Remove milestones that no longer apply
  for (const tx of existing) {
    if (tx.streakQuarters === undefined || shouldHave.includes(tx.streakQuarters)) continue;
    await PointsTransaction.findByIdAndDelete(tx._id);
    await User.findByIdAndUpdate(userId, [
      { $set: { points: { $max: [{ $subtract: ['$points', tx.pointsAwarded] }, 0] } } },
    ]);
  }
}
