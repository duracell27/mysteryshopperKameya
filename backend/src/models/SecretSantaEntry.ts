import mongoose, { Schema, Document } from 'mongoose';

export interface ISecretSantaEntry extends Document {
  season: string;
  userId?: mongoose.Types.ObjectId;
  fullName: string;
  department?: string;
  hobbies?: string;
  interestingFacts?: string;
  wantsToReceive?: string;
  doesntWantToReceive?: string;
  recipientId?: mongoose.Types.ObjectId;
}

const SecretSantaEntrySchema = new Schema<ISecretSantaEntry>({
  season:               { type: String, default: '2026' },
  userId:               { type: Schema.Types.ObjectId, ref: 'User', unique: true, sparse: true },
  fullName:             { type: String, required: true },
  department:           { type: String },
  hobbies:              { type: String },
  interestingFacts:     { type: String },
  wantsToReceive:       { type: String },
  doesntWantToReceive:  { type: String },
  recipientId:          { type: Schema.Types.ObjectId, ref: 'SecretSantaEntry' },
});

export const SecretSantaEntry = mongoose.model<ISecretSantaEntry>('SecretSantaEntry', SecretSantaEntrySchema);
