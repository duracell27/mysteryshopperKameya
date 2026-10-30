import mongoose, { Schema, Document } from 'mongoose';

export interface IShopSettings extends Document {
  catalogOnly: boolean;
}

const ShopSettingsSchema = new Schema<IShopSettings>({
  catalogOnly: { type: Boolean, default: false },
});

export const ShopSettings = mongoose.model<IShopSettings>('ShopSettings', ShopSettingsSchema);
