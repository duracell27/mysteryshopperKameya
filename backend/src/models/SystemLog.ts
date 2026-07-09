import mongoose, { Schema, Document } from 'mongoose';

export type SystemLogType = 'login_success' | 'login_failed';

export interface ISystemLog extends Document {
  type: SystemLogType;
  phone: string;
  userName: string | null;
  ip: string | null;
  isRead: boolean;
  createdAt: Date;
}

const SystemLogSchema = new Schema<ISystemLog>(
  {
    type:     { type: String, enum: ['login_success', 'login_failed'], required: true },
    phone:    { type: String, required: true },
    userName: { type: String, default: null },
    ip:       { type: String, default: null },
    isRead:   { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

SystemLogSchema.index({ isRead: 1 });
SystemLogSchema.index({ createdAt: -1 });

export const SystemLog = mongoose.model<ISystemLog>('SystemLog', SystemLogSchema);
