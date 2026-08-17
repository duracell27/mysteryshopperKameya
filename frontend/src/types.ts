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
  ADMIN_COMPANY_STRUCTURE = 'ADMIN_COMPANY_STRUCTURE',
  // Onboarding
  ONBOARDING_14 = 'ONBOARDING_14',
  ONBOARDING_30 = 'ONBOARDING_30',
  ONBOARDING_60 = 'ONBOARDING_60',
  // Learning
  LEARNING_GENERAL    = 'LEARNING_GENERAL',
  LEARNING_START      = 'LEARNING_START',
  LEARNING_CONSULTANT = 'LEARNING_CONSULTANT',
  LEARNING_MANAGERS   = 'LEARNING_MANAGERS',
  LEARNING_MARKETING  = 'LEARNING_MARKETING',
  // Admin
  ADMIN_ACCESS_MATRIX = 'ADMIN_ACCESS_MATRIX',
  ADMIN_ONBOARDING = 'ADMIN_ONBOARDING',
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
  audioRecordings?: AudioRecording[];
  learningPlanManualPoints?: 5 | 10;
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
  isAdmin: boolean;
  division: string;
  group: string;
  position: string;
  points: number;
  avatarUrl?: string | null;
}

export interface UserListItem {
  _id: string;
  phone: string;
  name: string;
  isAdmin: boolean;
  division: string;
  group: string;
  position: string;
  points?: number;
  createdAt: string;
  avatarUrl?: string | null;
}

export type TransactionReason = 'score' | 'reflection' | 'streak' | 'reflection_penalty' | 'learning_plan_manual';

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

export interface AudioRecording {
  _id: string;
  label: string;
  filename: string;
  originalName: string;
  uploadedAt: string;
}

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

// ── Onboarding 14 ───────────────────────────────────────────────────────────

export interface OnboardingTask {
  id: string;
  title: string;
  description: string;
  type: 'theory' | 'practice' | 'meeting' | 'observation' | 'other';
  completed: boolean;
}

export interface OnboardingReflection {
  q1: number; q2: number; q3: number;
  q4: string; q5: number;
  comments: string;
  submittedAt: string;
}

export interface OnboardingDay {
  day: number;
  isHoliday: boolean;
  isPreview: boolean;
  tasks: OnboardingTask[];
  reflection?: OnboardingReflection;
}

export interface OnboardingAiReport {
  id: string;
  analysis: string;
  daysCount: number;
  createdAt: string;
}

export interface OnboardingTrainee {
  id: string;
  name: string;
  position: string;
  startDate: string;
  endDate?: string;
  currentDay: number | null;
  isCompleted: boolean;
  days: OnboardingDay[];
  aiReports: OnboardingAiReport[];
}

// Для адмін-управління планом (без прогресу стажера)
export interface AdminOnboardingTaskItem {
  _id: string;
  title: string;
  description: string;
  type: 'theory' | 'practice' | 'meeting' | 'observation' | 'other';
}

export interface AdminDayPlan {
  _id: string;
  day: number;
  isHoliday: boolean;
  tasks: AdminOnboardingTaskItem[];
}
