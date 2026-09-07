import mongoose, { Schema, Document, Types } from 'mongoose';

export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface IShopOrder extends Document {
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  productSnapshot: { name: string; price: number; imageUrl: string };
  pointsSpent: number;
  status: OrderStatus;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ShopOrderSchema = new Schema<IShopOrder>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
    productId:   { type: Schema.Types.ObjectId, ref: 'ShopProduct', required: true },
    productSnapshot: {
      name:     { type: String, required: true },
      price:    { type: Number, required: true },
      imageUrl: { type: String, default: '' },
    },
    pointsSpent: { type: Number, required: true },
    status:      { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' },
    adminNote:   { type: String },
  },
  { timestamps: true }
);

export const ShopOrder = mongoose.model<IShopOrder>('ShopOrder', ShopOrderSchema);
