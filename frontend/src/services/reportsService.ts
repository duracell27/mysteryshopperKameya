import { AuditResult, PointsTransaction, ScoreInsight } from '../types';

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
}

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
  networkAvg: number | null;
  latestQ: string | null;
  latestQAvg: number | null;
  storeRanking: { store: string; avg: number; count: number }[];
  consultantRanking: { name: string; avg: number; count: number }[];
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const res = await fetch('/api/reports/stats/dashboard', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Помилка завантаження статистики');
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

export const toggleLearningTask = async (reportId: string, taskIndex: number): Promise<AuditResult> => {
  const res = await fetch(`/api/reports/${reportId}/learning-plan/${taskIndex}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
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
