import mongoose, { Schema, Document, Types } from 'mongoose';

export type BookLoanStatus = 'pending' | 'active' | 'return_pending' | 'returned' | 'cancelled';

export const ACTIVE_LOAN_STATUSES: BookLoanStatus[] = ['pending', 'active', 'return_pending'];

export interface IBookLoan extends Document {
  bookId:               Types.ObjectId;
  userId:               Types.ObjectId;
  status:               BookLoanStatus;
  requestedAt:          Date;
  deliveredAt?:         Date;
  dueDate?:             Date;
  dueDateExtendedAt?:   Date;
  returnRequestedAt?:   Date;
  returnedAt?:          Date;
  rating?:              number;
  warningDay27Sent:     boolean;
  warningDay31Sent:     boolean;
}

const BookLoanSchema = new Schema<IBookLoan>(
  {
    bookId:             { type: Schema.Types.ObjectId, ref: 'Book',  required: true },
    userId:             { type: Schema.Types.ObjectId, ref: 'User',  required: true },
    status:             { type: String, enum: ['pending','active','return_pending','returned','cancelled'], default: 'pending' },
    requestedAt:        { type: Date, default: Date.now },
    deliveredAt:        { type: Date },
    dueDate:            { type: Date },
    dueDateExtendedAt:  { type: Date },
    returnRequestedAt:  { type: Date },
    returnedAt:         { type: Date },
    rating:             { type: Number, min: 1, max: 10 },
    warningDay27Sent:   { type: Boolean, default: false },
    warningDay31Sent:   { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const BookLoan = mongoose.model<IBookLoan>('BookLoan', BookLoanSchema);
