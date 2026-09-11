import mongoose, { Schema, Document } from 'mongoose';

export interface IBookGenre extends Document {
  name: string;
  sortOrder: number;
}

const BookGenreSchema = new Schema<IBookGenre>(
  {
    name:      { type: String, required: true, unique: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const BookGenre = mongoose.model<IBookGenre>('BookGenre', BookGenreSchema);
