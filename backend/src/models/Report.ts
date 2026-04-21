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
}, { timestamps: true });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
