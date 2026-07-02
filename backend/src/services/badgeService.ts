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

export async function evaluateOnReportConfirm(
  userId: string | Types.ObjectId,
  reportId: string | Types.ObjectId,
): Promise<void> {
  const user = await User.findById(userId);
  if (!user) return;

  const allReports = await Report.find({ userId })
    .sort({ createdAt: 1 })
    .lean();

  const newBadges: { badgeId: BadgeId; earnedAt: Date; year?: number }[] = [];
  const has = (id: BadgeId) => user.badges.some(b => b.badgeId === id);
  const hasForYear = (id: BadgeId, year: number) =>
    user.badges.some(b => b.badgeId === id && b.year === year);

  // ── Старт ──────────────────────────────────────────────────────────────────
  if (!has('first_report')) {
    newBadges.push({ badgeId: 'first_report', earnedAt: new Date() });
  }

  if (!has('first_perfect') && allReports.length === 1 && allReports[0].totalScore === 100) {
    newBadges.push({ badgeId: 'first_perfect', earnedAt: new Date() });
  }

  // ── Серія ──────────────────────────────────────────────────────────────────
  const currentReport = allReports.find(r => r._id.toString() === reportId.toString());
  const year = currentReport?.year ?? new Date().getFullYear();
  const yearReports = allReports.filter(r => r.year === year);
  const milestones = calcSeriesMilestones(yearReports);

  for (const m of milestones) {
    const badgeId: BadgeId = m === 2 ? 'silver_guide' : m === 3 ? 'gold_series' : 'platinum_standard';
    if (!hasForYear(badgeId, year)) {
      newBadges.push({ badgeId, earnedAt: new Date(), year });
    }
  }

  // ── Камбек ─────────────────────────────────────────────────────────────────
  if (allReports.length >= 2) {
    let historicalComebacks = 0;
    for (let i = 1; i < allReports.length; i++) {
      const prev = allReports[i - 1];
      const curr = allReports[i];
      const prevHasCompletedPlan =
        !!prev.learningPlan?.tasks?.length &&
        prev.learningPlan.tasks.every((t: { isCompleted: boolean }) => t.isCompleted);
      if (prev.totalScore < 85 && prevHasCompletedPlan && curr.totalScore === 100) {
        historicalComebacks++;
      }
    }
    const existingComebacks = user.badges.filter(b => b.badgeId === 'comeback').length;
    if (existingComebacks < historicalComebacks) {
      newBadges.push({ badgeId: 'comeback', earnedAt: new Date() });
    }
  }

  if (newBadges.length > 0) {
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
