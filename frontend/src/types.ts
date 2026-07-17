export enum Screen {
  DASHBOARD = 'DASHBOARD',
  AUDIT_DETAILS = 'AUDIT_DETAILS',
  TRAINING_PLAN = 'TRAINING_PLAN',
  QUIZ = 'QUIZ',
  PROGRESS = 'PROGRESS',
  ADMIN_USERS = 'ADMIN_USERS',
  ADMIN_REPORTS = 'ADMIN_REPORTS',
  ADMIN_REPORTS_LIST = 'ADMIN_REPORTS_LIST',
  ADMIN_NOTIFICATIONS = 'ADMIN_NOTIFICATIONS',
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
  quarter?: string;
  year?: number;
  month?: number;
  totalScore: number;
  sections: AuditSection[];
  fileName?: string;
  userId?: string;
  createdAt?: string;
  reflection?: Reflection;
  aiRecommendations?: AiRecommendations;
  scoreInsight?: ScoreInsight;
  learningPlan?: LearningPlan;
  affirmation?: string;
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
  points: number;
}

export interface UserListItem {
  _id: string;
  phone: string;
  name: string;
  position?: string;
  store?: string;
  role: 'ADMIN' | 'EMPLOYEE';
  points?: number;
  createdAt: string;
}

export type TransactionReason = 'score' | 'reflection' | 'streak' | 'reflection_penalty';

export interface PointsTransaction {
  _id: string;
  userId: string;
  reportId?: { _id: string; fileName: string; date: string } | string;
  quarter?: string;
  year: number;
  scorePercent: number;
  pointsAwarded: number;
  reason?: TransactionReason;
  note?: string;
  streakQuarters?: number;
  streakYear?: number;
  createdAt: string;
}

export interface Reflection {
  answer1: string;
  answer2: string;
  submittedAt: string;
  isOnTime: boolean;
  bonusPointsAwarded: boolean;
}

export interface AiRecommendations {
  tier: 'below85' | 'range85to94' | 'range95to99';
  mainMessage: string;
  weakPoints: string[];
  question: string | null;
  generatedAt: string;
}

export interface ScoreInsight {
  tier: 'below85' | 'range85to94' | 'range95to99' | 'perfect100';
  goalText?: string;
  confirmedAt?: string;
  whatHelpedText?: string;
  submittedAt: string;
}

export interface LearningTask {
  topicTitle: string;
  description: string;
  isCompleted: boolean;
  completedAt?: string;
  response?: string;
}

export interface LearningPlan {
  tasks: LearningTask[];
  generatedAt: string;
  deadline?: string;
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

export type BadgeId =
  | 'first_report'
  | 'first_perfect'
  | 'honor_student'
  | 'student_of_year'
  | 'silver_guide'
  | 'gold_series'
  | 'platinum_standard'
  | 'comeback';

export interface BadgeAward {
  _id: string;
  badgeId: BadgeId;
  earnedAt: string;
  year?: number;
  manual?: boolean;
}

export type NotificationType = 'reflection_submitted' | 'plan_generated' | 'plan_completed';
export type SystemLogType = 'login_success' | 'login_failed' | 'password_changed';

export interface AdminNotification {
  _id: string;
  type: NotificationType;
  userId: string;
  reportId: string;
  userName: string;
  reportFileName: string;
  isOnTime: boolean | null;
  isRead: boolean;
  createdAt: string;
}

export interface SystemLogEntry {
  _id: string;
  type: SystemLogType;
  phone: string;
  userName: string | null;
  ip: string | null;
  isRead: boolean;
  createdAt: string;
}
