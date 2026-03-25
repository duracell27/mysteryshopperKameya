export enum Screen {
  DASHBOARD = 'DASHBOARD',
  AUDIT_DETAILS = 'AUDIT_DETAILS',
  TRAINING_PLAN = 'TRAINING_PLAN',
  QUIZ = 'QUIZ',
  PROGRESS = 'PROGRESS',
  ADMIN_USERS = 'ADMIN_USERS',
}

export interface AuditQuestion {
  question: string;
  answer: string;
  isCorrect: boolean;
  comment?: string;
}

export interface AuditSection {
  title: string;
  score: number;
  maxScore: number;
  feedback: string;
  questions: AuditQuestion[];
}

export interface AuditResult {
  id: string;
  date: string;
  totalScore: number;
  sections: AuditSection[];
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
