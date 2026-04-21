import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPointsTransaction extends Document {
  userId: Types.ObjectId;
  reportId: Types.ObjectId;
  quarter: string;
  year: number;
  scorePercent: number;
  pointsAwarded: number;
  createdAt: Date;
}

const PointsTransactionSchema = new Schema<IPointsTransaction>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportId:      { type: Schema.Types.ObjectId, ref: 'Report', required: true },
    quarter:       { type: String, enum: ['Q1', 'Q2', 'Q3', 'Q4'], required: true },
    year:          { type: Number, required: true },
    scorePercent:  { type: Number, required: true },
    pointsAwarded: { type: Number, required: true },
  },
  { timestamps: true }
);

export const PointsTransaction = mongoose.model<IPointsTransaction>('PointsTransaction', PointsTransactionSchema);
