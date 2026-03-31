import { Schema, model } from 'mongoose';

interface ITip {
  date: string;
  content: string;
  createdAt: Date;
}

const TipSchema = new Schema<ITip>({
  date: { type: String, required: true, unique: true }, // формат: YYYY-MM-DD
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Tip = model<ITip>('Tip', TipSchema);
