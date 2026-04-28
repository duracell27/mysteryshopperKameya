import mongoose, { Schema, Document, Types } from 'mongoose';

export type TransactionReason = 'score' | 'reflection' | 'streak' | 'birthday';

export interface IPointsTransaction extends Document {
  userId: Types.ObjectId;
  reportId?: Types.ObjectId;
  quarter?: string;
  year: number;
  scorePercent: number;
  pointsAwarded: number;
  reason: TransactionReason;
  streakQuarters?: number;  // 2 | 3 | 4 — for streak transactions
  streakYear?: number;       // year the streak belongs to
  birthdayYear?: number;     // year the birthday bonus was awarded for
  createdAt: Date;
}

const PointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportId:       { type: Schema.Types.ObjectId, ref: 'Report' },
    quarter:        { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'] },
    year:           { type: Number, required: true },
    scorePercent:   { type: Number, required: true },
    pointsAwarded:  { type: Number, required: true },
    reason:         { type: String, enum: ['score', 'reflection', 'streak', 'birthday'], default: 'score' },
    streakQuarters: { type: Number },
    streakYear:     { type: Number },
    birthdayYear:   { type: Number },
  },
  { timestamps: true }
);

export const PointsTransaction = mongoose.model<IPointsTransaction>('PointsTransaction', PointsTransactionSchema);
