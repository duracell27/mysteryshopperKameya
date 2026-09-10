import mongoose, { Schema, Document } from 'mongoose';

export interface IBookGenre extends Document {
  name: string;
}

const BookGenreSchema = new Schema<IBookGenre>(
  { name: { type: String, required: true, unique: true } },
  { timestamps: true }
);

export const BookGenre = mongoose.model<IBookGenre>('BookGenre', BookGenreSchema);
