import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITask {
  _id: Types.ObjectId;
  title: string;
  description: string;
  type: 'theory' | 'practice' | 'meeting' | 'observation' | 'other';
}

export interface IDayPlan extends Document {
  day: number;
  isHoliday: boolean;
  tasks: Types.DocumentArray<ITask & Document>;
}

const taskSchema = new Schema<ITask>({
  title:       { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: ['theory', 'practice', 'meeting', 'observation', 'other'],
    default: 'other',
  },
});

const dayPlanSchema = new Schema<IDayPlan>({
  day:       { type: Number, required: true, unique: true },
  isHoliday: { type: Boolean, default: false },
  tasks:     [taskSchema],
});

export const DayPlan = mongoose.model<IDayPlan>('DayPlan', dayPlanSchema);
