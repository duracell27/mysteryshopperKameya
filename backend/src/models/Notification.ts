import mongoose, { Schema, Document, Types } from 'mongoose';

export type NotificationType = 'reflection_submitted' | 'plan_generated' | 'plan_completed';

export interface INotification extends Document {
  type: NotificationType;
  userId: Types.ObjectId;
  reportId: Types.ObjectId;
  userName: string;
  reportFileName: string;
  isOnTime: boolean | null;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: {
      type: String,
      enum: ['reflection_submitted', 'plan_generated', 'plan_completed'],
      required: true,
    },
    userId:         { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    reportId:       { type: Schema.Types.ObjectId, ref: 'Report', required: true },
    userName:       { type: String, required: true },
    reportFileName: { type: String, required: true },
    isOnTime:       { type: Boolean, default: null },
    isRead:         { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ isRead: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
