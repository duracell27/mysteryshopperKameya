import mongoose, { Schema, Document } from 'mongoose';

export interface IShopProduct extends Document {
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  quantity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ShopProductSchema = new Schema<IShopProduct>(
  {
    name:        { type: String, required: true },
    description: { type: String, default: '' },
    imageUrl:    { type: String, default: '' },
    price:       { type: Number, required: true, min: 1 },
    quantity:    { type: Number, required: true, min: 0, default: 0 },
    isActive:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ShopProduct = mongoose.model<IShopProduct>('ShopProduct', ShopProductSchema);
