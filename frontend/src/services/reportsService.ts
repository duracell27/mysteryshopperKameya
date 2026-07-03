import { AuditResult, LearningTask, PointsTransaction, ScoreInsight, BadgeId } from '../types';
import { BADGE_CATALOGUE } from '../constants/badges';

export interface BadgePreview {
  badgeId: BadgeId;
  name: string;
  icon: string;
  color: string;
  condition: string;
  year?: number;
}

const getAuthHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem('kameya_token') ?? ''}`,
});

export interface ParsedReport extends AuditResult {
  fileName: string;
}

export const parseReport = async (file: File): Promise<ParsedReport> => {
  const formData = new FormData();
  formData.append('pdf', file);

  const res = await fetch('/api/reports/parse', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка аналізу PDF');
  }
  return res.json();
};

export interface ConfirmReportPayload {
  userId: string;
  auditId: string;
  location: string;
  date: string;
  totalScore: number;
  sections: AuditResult['sections'];
  fileName: string;
  quarter: string;
  year: number;
  month?: number;
  affirmation?: string;
  badgeOverride?: { action: 'cancel' } | { action: 'custom'; badgeIds: BadgeId[] };
}

export const previewAffirmation = async (userId: string): Promise<string> => {
  const res = await fetch(`/api/reports/preview-affirmation?userId=${encodeURIComponent(userId)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Помилка отримання афірмації');
  const data = await res.json();
  return data.affirmation as string;
};

export interface ConfirmReportResponse extends AuditResult {
  pointsAwarded: number;
  totalPoints: number;
}

export const confirmReport = async (data: ConfirmReportPayload): Promise<ConfirmReportResponse> => {
  const res = await fetch('/api/reports/confirm', {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка збереження звіту');
  }
  return res.json();
};

export const getMyReports = async (): Promise<AuditResult[]> => {
  const res = await fetch('/api/reports/my', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження звітів');
  return res.json();
};

export const getAllReports = async (): Promise<AuditResult[]> => {
  const res = await fetch('/api/reports', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження звітів');
  return res.json();
};

export const deleteReport = async (reportId: string): Promise<void> => {
  const res = await fetch(`/api/reports/${reportId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка видалення звіту');
  }
};

export const submitReflection = async (
  reportId: string,
  answer1: string,
  answer2: string,
): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/reflection`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer1, answer2 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка збереження рефлексії');
  }
  return res.json();
};

export interface UserRank {
  rank: number;
  totalUsers: number;
  totalScore: number;
  tier: string;
}

export const getMyRank = async (): Promise<UserRank> => {
  const res = await fetch('/api/reports/my/rank', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження рейтингу');
  return res.json();
};

export const getMyPointsHistory = async (): Promise<PointsTransaction[]> => {
  const res = await fetch("/api/reports/my/transactions", { headers: getAuthHeaders() });
  if (!res.ok) throw new Error("Помилка завантаження балів");
  return res.json();
};

export interface DashboardStats {
  year: number;
  periodType: 'month' | 'quarter' | 'year';
  periodAvg: number | null;
  reportCount: number;
  storeRanking: { store: string; avg: number; count: number }[];
  consultantRanking: { name: string; avg: number; count: number }[];
}

export interface DashboardParams {
  periodType?: 'month' | 'quarter' | 'year';
  year?: number;
  quarter?: string;
  month?: number;
}

export const getDashboardStats = async (params?: DashboardParams): Promise<DashboardStats> => {
  const q = new URLSearchParams();
  if (params?.periodType) q.set('periodType', params.periodType);
  if (params?.year) q.set('year', String(params.year));
  if (params?.quarter) q.set('quarter', params.quarter);
  if (params?.month) q.set('month', String(params.month));
  const res = await fetch(`/api/reports/stats/dashboard?${q}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження статистики');
  return res.json();
};

export const updateReportPeriod = async (
  reportId: string,
  data: { quarter?: string; year?: number; month?: number | null },
): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка оновлення звіту');
  }
  return res.json();
};

export const generateAiRecommendations = async (reportId: string): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/generate-ai`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка генерації рекомендацій');
  }
  return res.json();
};

export const generateLearningPlan = async (reportId: string): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/generate-learning-plan`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка генерації плану навчання');
  }
  return res.json();
};

export const deleteLearningPlan = async (reportId: string): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/learning-plan`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка видалення плану навчання');
  }
  return res.json();
};

export const updateLearningPlanTasks = async (reportId: string, tasks: LearningTask[]): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/learning-plan`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка оновлення плану навчання');
  }
  return res.json();
};

export const toggleLearningTask = async (reportId: string, taskIndex: number, response?: string): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/learning-plan/${taskIndex}`, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ response }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка оновлення задачі');
  }
  return res.json();
};

export const submitScoreInsight = async (
  reportId: string,
  data: Partial<Pick<ScoreInsight, 'goalText' | 'whatHelpedText'>>,
): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/score-insight`, {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Помилка збереження відповіді');
  }
  return res.json();
};

export const getMyBadges = async (): Promise<import('../types').BadgeAward[]> => {
  const res = await fetch('/api/reports/my/badges', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження бейджів');
  return res.json();
};

export const previewBadges = async (
  userId: string,
  totalScore: number,
  quarter: string,
  year: number,
): Promise<BadgePreview[]> => {
  try {
    const params = new URLSearchParams({
      userId,
      totalScore: String(totalScore),
      quarter,
      year: String(year),
    });
    const res = await fetch(`/api/reports/preview-badges?${params}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return [];
    const raw: { badgeId: BadgeId; year?: number }[] = await res.json();
    return raw.flatMap(item => {
      const def = BADGE_CATALOGUE.find(b => b.badgeId === item.badgeId);
      if (!def) return [];
      return [{
        badgeId: def.badgeId,
        name: def.name,
        icon: def.icon,
        color: def.color,
        condition: def.condition,
        year: item.year,
      }];
    });
  } catch {
    return [];
  }
};
