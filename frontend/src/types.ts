export enum Screen {
  DASHBOARD = 'DASHBOARD',
  AUDIT_DETAILS = 'AUDIT_DETAILS',
  TRAINING_PLAN = 'TRAINING_PLAN',
  QUIZ = 'QUIZ',
  PROGRESS = 'PROGRESS',
  ADMIN_USERS = 'ADMIN_USERS',
  ADMIN_REPORTS = 'ADMIN_REPORTS',
  ADMIN_REPORTS_LIST = 'ADMIN_REPORTS_LIST',
  MY_REPORTS = 'MY_REPORTS',
}

export interface AuditQuestion {
  question: string;
  answer: string;
  isCorrect: boolean;
  comment?: string;
  score?: number;
  isImportant?: boolean;
}

export interface AuditSection {
  title: string;
  score: number;
  maxScore: number;
  feedback: string;
  questions: AuditQuestion[];
  maxScores?: number[];
}

export interface AuditResult {
  _id?: string;
  id?: string;
  auditId?: string;
  location?: string;
  store?: string;
  date: string;
  totalScore: number;
  sections: AuditSection[];
  fileName?: string;
  userId?: string;
  createdAt?: string;
}

export interface DailyTask {
  day: number;
  title: string;
  description: string;
  focusPoint: string;
  isCompleted: boolean;
  reflection: string;
}

export interface AIAnalysisResult {
  summary: string;
  weaknesses: string[];
  fifteenDayPlan: DailyTask[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  position: string | null;
  store: string | null;
  role: string;
}

export interface UserListItem {
  _id: string;
  phone: string;
  name: string;
  position?: string;
  store?: string;
  role: 'ADMIN' | 'EMPLOYEE';
  createdAt: string;
}

export const STORES = [
  'Арсен',
  'Бельведерська',
  'Галицька',
  'Галич',
  'Коломия',
  'Надвірна золото',
  'Надвірна срібло',
  'Цум',
  'Шашкевича',
  'Шпитальна',
] as const;

export const EMPLOYEE_POSITIONS = [
  'Продавець консультант',
  'Керівник відділу',
] as const;
