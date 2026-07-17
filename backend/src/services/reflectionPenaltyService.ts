import { Report } from '../models/Report';
import { PointsTransaction } from '../models/PointsTransaction';
import { applyReflectionPenalty } from './pointsService';

const MS_72H = 72 * 60 * 60 * 1000;

export async function runReflectionPenaltyCheck(): Promise<void> {
  const deadline = new Date(Date.now() - MS_72H);

  const overdueReports = await Report.find({
    createdAt: { $lt: deadline },
    $or: [{ reflection: { $exists: false } }, { reflection: null }],
  }).select('_id userId quarter year totalScore reflection').lean();

  for (const report of overdueReports) {
    // Double-check reflection is still missing (race-condition guard)
    if (report.reflection) continue;

    const alreadyPenalized = await PointsTransaction.exists({
      reportId: report._id,
      reason: 'reflection_penalty',
    });
    if (alreadyPenalized) continue;

    const scoreTx = await PointsTransaction.findOne({
      reportId: report._id,
      reason: { $in: ['score', null] },
      pointsAwarded: { $gt: 0 },
    });

    const pointsToDeduct = scoreTx?.pointsAwarded ?? 0;
    if (pointsToDeduct <= 0) continue;

    await applyReflectionPenalty({
      userId: report.userId,
      reportId: report._id as import('mongoose').Types.ObjectId,
      quarter: report.quarter,
      year: report.year,
      scorePercent: report.totalScore,
      pointsToDeduct,
    });

    console.log(`[penalty] -${pointsToDeduct} pts — user ${report.userId}, report ${report._id}`);
  }
}
