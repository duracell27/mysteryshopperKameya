import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBadgeAward {
  _id: Types.ObjectId;
  badgeId: string;
  earnedAt: Date;
  year?: number;
  manual?: boolean;
}

export interface IUser extends Document {
  phone: string;
  password: string;
  name: string;
  position?: string;
  store?: string;
  role: 'ADMIN' | 'EMPLOYEE';
  points: number;
  birthday?: Date;
  badges: IBadgeAward[];
  createdAt: Date;
  updatedAt: Date;
}

const BadgeAwardSchema = new Schema<IBadgeAward>({
  badgeId:  { type: String, required: true },
  earnedAt: { type: Date, required: true, default: Date.now },
  year:     { type: Number },
  manual:   { type: Boolean, default: false },
});

const UserSchema = new Schema<IUser>(
  {
    phone:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name:     { type: String, default: '' },
    position: { type: String },
    store:    { type: String },
    role:     { type: String, enum: ['ADMIN', 'EMPLOYEE'], default: 'EMPLOYEE' },
    points:   { type: Number, default: 0 },
    birthday: { type: Date },
    badges:   { type: [BadgeAwardSchema], default: [] },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
