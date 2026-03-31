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

export interface IReport extends Document {
  userId: Types.ObjectId;
  auditId: string;
  location: string;
  store: string;
  date: string;
  totalScore: number;
  sections: ISection[];
  fileName: string;
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

const ReportSchema = new Schema<IReport>({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
  auditId:    { type: String, default: '' },
  location:   { type: String, default: '' },
  store:      { type: String, default: '' },
  date:       { type: String, required: true },
  totalScore: { type: Number, required: true },
  sections:   [SectionSchema],
  fileName:   { type: String, default: '' },
}, { timestamps: true });

export const Report = mongoose.model<IReport>('Report', ReportSchema);
