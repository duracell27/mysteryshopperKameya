import { Schema, Types, model } from 'mongoose';

interface ITip {
  userId: Types.ObjectId;
  date: string;
  content: string;
  createdAt: Date;
}

const TipSchema = new Schema<ITip>({
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date:    { type: String, required: true }, // формат: YYYY-MM-DD
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

TipSchema.index({ userId: 1, date: 1 }, { unique: true });

export const Tip = model<ITip>('Tip', TipSchema);
