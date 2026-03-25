import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  phone: string;
  password: string;
  name: string;
  position?: string;  // Продавець консультант | Керівник відділу
  store?: string;     // назва магазину
  role: 'ADMIN' | 'EMPLOYEE';
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phone:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    name:     { type: String, default: '' },
    position: { type: String },
    store:    { type: String },
    role:     { type: String, enum: ['ADMIN', 'EMPLOYEE'], default: 'EMPLOYEE' },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
