import mongoose, { Schema, Document, Types } from 'mongoose';

interface IQuestion {
  question: string;
  answer: string;
  isCorrect: boolean;
  comment?: string;
  score?: number;
  isImportant?: boolean;
}

interface ISection {
  title: string;
  score: number;
  maxScore: number;
  feedback: string;
  questions: IQuestion[];
  maxScores?: number[];
}

interface IReflection {
  answer1: string;
  answer2: string;
  submittedAt: Date;
  isOnTime: boolean;
  bonusPointsAwarded: boolean;
}

interface IAiRecommendations {
  tier: 'below85' | 'range85to94' | 'range95to99';
  mainMessage: string;
  weakPoints: string[];
  question: string | null;
  generatedAt: Date;
}

interface IScoreInsight {
  tier: 'below85' | 'range85to94' | 'range95to99' | 'perfect100';
  goalText?: string;
  confirmedAt?: Date;
  whatHelpedText?: string;
  submittedAt: Date;
}

interface ILearningTask {
  topicTitle: string;
  description: string;
  isCompleted: boolean;
  completedAt?: Date;
}

interface ILearningPlan {
  tasks: ILearningTask[];
  generatedAt: Date;
}

export interface IReport extends Document {
  userId: Types.ObjectId;
  auditId: string;
  location: string;
  store: string;
  date: string;
  quarter: string;
  year: number;
  totalScore: number;
  sections: ISection[];
  fileName: string;
  reflection?: IReflection;
  aiRecommendations?: IAiRecommendations;
  scoreInsight?: IScoreInsight;
  learningPlan?: ILearningPlan;
  createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  question: String,
  answer:   String,
  isCorrect: Boolean,
  comment:  String,
  score: Number,
  isImportant: { type: Boolean, default: true },
}, { _id: false });

const SectionSchema = new Schema<ISection>({
  title:     String,
  score:     Number,
  maxScore:  Number,
  feedback:  String,
  questions: [QuestionSchema],
  maxScores: [Number],
}, { _id: false });

const ReflectionSchema = new Schema<IReflection>(
  {
    answer1:            { type: String, required: true },
    answer2:            { type: String, required: true },
    submittedAt:        { type: Date, required: true },
    isOnTime:           { type: Boolean, required: true },
    bonusPointsAwarded: { type: Boolean, required: true },
  },
  { _id: false }
);

const AiRecommendationsSchema = new Schema<IAiRecommendations>(
  {
    tier:        { type: String, required: true },
    mainMessage: { type: String, required: true },
    weakPoints:  [{ type: String }],
    question:    { type: String, default: null },
    generatedAt: { type: Date, required: true },
  },
  { _id: false }
);

const ScoreInsightSchema = new Schema<IScoreInsight>(
  {
    tier:            { type: String, required: true },
    goalText:        { type: String },
    confirmedAt:     { type: Date },
    whatHelpedText:  { type: String },
    submittedAt:     { type: Date, required: true },
  },
  { _id: false }
);

const LearningTaskSchema = new Schema<ILearningTask>({
  topicTitle:  { type: String, required: true },
  description: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date },
}, { _id: false });

const LearningPlanSchema = new Schema<ILearningPlan>({
  tasks:       [LearningTaskSchema],
  generatedAt: { type: Date, required: true },
}, { _id: false });

const ReportSchema = new Schema<IReport>({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  auditId:    { type: String, default: '' },
  location:   { type: String, default: '' },
  store:      { type: String, default: '' },
  date:       { type: String, required: true },
  totalScore: { type: Number, required: true },
  sections:   [SectionSchema],
  fileName:   { type: String, default: '' },
  quarter:    { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'], default: 'Q1' },
  year:       { type: Number, default: () => new Date().getFullYear() },
  reflection: { type: ReflectionSchema, default: undefined },
  aiRecommendations: { type: AiRecommendationsSchema, default: undefined },
  scoreInsight:      { type: ScoreInsightSchema, default: undefined },
  learningPlan:      { type: LearningPlanSchema, default: undefined },
}, { timestamps: true });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
