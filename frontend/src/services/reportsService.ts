import { AuditResult } from '../types';

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
}

export const confirmReport = async (data: ConfirmReportPayload): Promise<AuditResult> => {
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
