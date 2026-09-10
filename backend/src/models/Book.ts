import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBook extends Document {
  title:        string;
  author:       string;
  genreId:      Types.ObjectId;
  coverUrl:     string;
  annotation:   string;
  isActive:     boolean;
  avgRating:    number;
  ratingsCount: number;
  createdAt:    Date;
  updatedAt:    Date;
}

const BookSchema = new Schema<IBook>(
  {
    title:        { type: String, required: true },
    author:       { type: String, required: true },
    genreId:      { type: Schema.Types.ObjectId, ref: 'BookGenre', required: true },
    coverUrl:     { type: String, default: '' },
    annotation:   { type: String, default: '' },
    isActive:     { type: Boolean, default: true },
    avgRating:    { type: Number, default: 0 },
    ratingsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Book = mongoose.model<IBook>('Book', BookSchema);
