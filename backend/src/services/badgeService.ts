import { Types } from 'mongoose';
import { User } from '../models/User';
import { Report } from '../models/Report';
import { BadgeId } from '../constants/badges';

const QUARTER_ORDER: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

function calcSeriesMilestones(reports: { quarter: string; totalScore: number }[]): number[] {
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
    if (byQuarter[q] === undefined) { streak = 0; prevQ = 0; continue; }
    if (prevQ > 0 && q !== prevQ + 1) streak = 0;
    if (byQuarter[q] === 100) {
      streak++;
      if (streak >= 2 && streak <= 4) milestones.push(streak);
    } else {
      streak = 0;
    }
    prevQ = q;
  }

  return milestones;
}

/**
 * Pure read-only simulation: computes which badges would be earned if a report
 * with the given params were confirmed. Does not write to DB.
 *
 * excludeReportId: when called after a report is already saved (i.e. from
 * evaluateOnReportConfirm), pass the new report's _id so it is excluded from
 * the DB query and instead treated as the synthetic "incoming" report.
 * Without this param (preview mode), the report does not yet exist in DB.
 */
export async function computePendingBadges(
  userId: string | Types.ObjectId,
  totalScore: number,
  quarter: string,
  year: number,
  excludeReportId?: string | Types.ObjectId,
): Promise<{ badgeId: BadgeId; year?: number }[]> {
  const user = await User.findById(userId);
  if (!user) return [];

  const dbQuery: Record<string, unknown> = { userId };
  if (excludeReportId) dbQuery['_id'] = { $ne: excludeReportId };

  const existingReports = await Report.find(dbQuery).sort({ createdAt: 1 }).lean();
  const allReports = [...existingReports, { quarter, totalScore, year }];

  const pending: { badgeId: BadgeId; year?: number }[] = [];
  const has = (id: BadgeId) => user.badges.some(b => b.badgeId === id);
  const hasForYear = (id: BadgeId, y: number) =>
    user.badges.some(b => b.badgeId === id && b.year === y);

  // ── Старт ──────────────────────────────────────────────────────────────────
  if (!has('first_report')) {
    pending.push({ badgeId: 'first_report' });
  }

  if (!has('first_perfect') && allReports.length === 1 && allReports[0].totalScore === 100) {
    pending.push({ badgeId: 'first_perfect' });
  }

  // ── Серія ──────────────────────────────────────────────────────────────────
  const yearReports = allReports.filter(r => r.year === year);
  const milestones = calcSeriesMilestones(yearReports);

  for (const m of milestones) {
    const badgeId: BadgeId = m === 2 ? 'silver_guide' : m === 3 ? 'gold_series' : 'platinum_standard';
    if (!hasForYear(badgeId, year)) {
      pending.push({ badgeId, year });
    }
  }

  // ── Камбек ─────────────────────────────────────────────────────────────────
  if (allReports.length >= 2) {
    let historicalComebacks = 0;
    for (let i = 1; i < allReports.length; i++) {
      const prev = allReports[i - 1] as typeof existingReports[0];
      const curr = allReports[i];
      const prevHasCompletedPlan =
        'learningPlan' in prev &&
        !!prev.learningPlan?.tasks?.length &&
        prev.learningPlan.tasks.every((t: { isCompleted: boolean }) => t.isCompleted);
      if (prev.totalScore < 85 && prevHasCompletedPlan && curr.totalScore === 100) {
        historicalComebacks++;
      }
    }
    const existingComebacks = user.badges.filter(b => b.badgeId === 'comeback').length;
    if (existingComebacks < historicalComebacks) {
      pending.push({ badgeId: 'comeback' });
    }
  }

  return pending;
}

export async function evaluateOnReportConfirm(
  userId: string | Types.ObjectId,
  reportId: string | Types.ObjectId,
): Promise<void> {
  const report = await Report.findById(reportId).lean();
  if (!report) return;

  const pending = await computePendingBadges(
    userId,
    report.totalScore,
    report.quarter,
    report.year ?? new Date().getFullYear(),
    reportId,
  );

  if (pending.length > 0) {
    const newBadges = pending.map(b => ({ ...b, earnedAt: new Date() }));
    await User.findByIdAndUpdate(userId, { $push: { badges: { $each: newBadges } } });
  }
}

export async function evaluateOnLearningPlanComplete(
  userId: string | Types.ObjectId,
  reportId: string | Types.ObjectId,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  if (user.badges.some(b => b.badgeId === 'honor_student')) return;

  const report = await Report.findById(reportId).lean();
  if (!report?.learningPlan) return;

  const plan = report.learningPlan;
  const allOnTime = plan.tasks.every(
    (t: { isCompleted: boolean; completedAt?: Date }) =>
      t.isCompleted && t.completedAt && new Date(t.completedAt) <= new Date(plan.deadline),
  );

  if (allOnTime) {
    await User.findByIdAndUpdate(userId, {
      $push: { badges: { badgeId: 'honor_student', earnedAt: new Date() } },
    });
  }
}

export async function evaluateStudentOfYear(
  userId: string | Types.ObjectId,
  year: number,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  if (user.badges.some(b => b.badgeId === 'student_of_year' && b.year === year)) return;

  const reports = await Report.find({ userId, year }).lean();
  const reportsWithPlan = reports.filter(r => r.learningPlan);
  if (reportsWithPlan.length === 0) return;

  const allOnTime = reportsWithPlan.every(r => {
    const plan = r.learningPlan!;
    if (!plan.tasks.length) return false;
    return plan.tasks.every(
      (t: { isCompleted: boolean; completedAt?: Date }) =>
        t.isCompleted && t.completedAt && new Date(t.completedAt) <= new Date(plan.deadline),
    );
  });

  if (allOnTime) {
    await User.findByIdAndUpdate(userId, {
      $push: { badges: { badgeId: 'student_of_year', earnedAt: new Date(), year } },
    });
  }
}
