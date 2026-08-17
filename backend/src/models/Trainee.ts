import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReflection {
  q1: number; q2: number; q3: number;
  q4: string; q5: number;
  comments: string;
  submittedAt: Date;
}

export interface ITraineeDay {
  day: number;
  completedTaskIds: Types.ObjectId[];
  reflection?: IReflection;
}

export interface IAiReport {
  _id: Types.ObjectId;
  analysis: string;
  daysCount: number;
  createdAt: Date;
}

interface DayPlanForPublic {
  day: number;
  isHoliday: boolean;
  tasks: { _id: Types.ObjectId; title: string; description: string; type: string }[];
}

interface PopulatedUser { name: string; position: string; }

export interface ITrainee extends Document {
  user: Types.ObjectId;
  startDate: Date;
  days: ITraineeDay[];
  aiReports: IAiReport[];
  toPublic(user: PopulatedUser, dayPlans: DayPlanForPublic[]): object;
}

const reflectionSchema = new Schema<IReflection>(
  { q1: Number, q2: Number, q3: Number, q4: String, q5: Number, comments: String, submittedAt: Date },
  { _id: false },
);

const traineeDaySchema = new Schema<ITraineeDay>({
  day:              { type: Number, required: true },
  completedTaskIds: [{ type: Schema.Types.ObjectId }],
  reflection:       reflectionSchema,
});

const aiReportSchema = new Schema<IAiReport>({
  analysis:  { type: String, required: true },
  daysCount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

const traineeSchema = new Schema<ITrainee>(
  {
    user:      { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    startDate: { type: Date, default: Date.now },
    days:      [traineeDaySchema],
    aiReports: [aiReportSchema],
  },
  { timestamps: true },
);

traineeSchema.methods.toPublic = function (
  populatedUser: PopulatedUser,
  dayPlans: DayPlanForPublic[],
): object {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(this.startDate); start.setHours(0, 0, 0, 0);
  const elapsed = Math.floor((today.getTime() - start.getTime()) / 86400000);

  if (elapsed < 0) {
    return {
      id: this._id.toString(), name: populatedUser.name, position: populatedUser.position,
      startDate: this.startDate, currentDay: null, isCompleted: false, days: [], aiReports: [],
    };
  }

  const DURATION = 14;
  const totalDays = dayPlans.length > 0
    ? Math.max(Math.max(...dayPlans.map((p) => p.day)), DURATION)
    : DURATION;

  const isCompleted = elapsed >= totalDays;
  const currentDay  = isCompleted ? totalDays : elapsed + 1;
  const endDate     = new Date(start);
  endDate.setDate(endDate.getDate() + totalDays - 1);

  return {
    id: this._id.toString(),
    name: populatedUser.name,
    position: populatedUser.position,
    startDate: this.startDate,
    endDate: endDate.toISOString(),
    currentDay,
    isCompleted,
    aiReports: (this.aiReports ?? [])
      .map((r: IAiReport) => ({
        id: r._id.toString(), analysis: r.analysis,
        daysCount: r.daysCount, createdAt: r.createdAt,
      }))
      .sort((a: { createdAt: Date }, b: { createdAt: Date }) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    days: dayPlans.sort((a, b) => a.day - b.day).map((plan) => {
      const isPreview = !isCompleted && plan.day > currentDay;
      const td = this.days.find((d: ITraineeDay) => d.day === plan.day);
      const completedIds = (td?.completedTaskIds ?? []).map((id: Types.ObjectId) => id.toString());
      return {
        day: plan.day, isHoliday: plan.isHoliday, isPreview,
        tasks: plan.tasks.map((t) => ({
          id: t._id.toString(), title: t.title,
          description: t.description || '', type: t.type,
          completed: completedIds.includes(t._id.toString()),
        })),
        reflection: !isPreview && td?.reflection
          ? { q1: td.reflection.q1, q2: td.reflection.q2, q3: td.reflection.q3,
              q4: td.reflection.q4, q5: td.reflection.q5,
              comments: td.reflection.comments, submittedAt: td.reflection.submittedAt }
          : undefined,
      };
    }),
  };
};

export const Trainee = mongoose.model<ITrainee>('Trainee', traineeSchema);
