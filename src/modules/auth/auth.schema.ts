import { Document, Schema, model, Types } from 'mongoose';
import { ILoginSession } from './auth.model';

// Omit _id from ILoginSession when extending Document
export interface ILoginSessionDocument extends Omit<ILoginSession, '_id'>, Document {
  _id: Types.ObjectId;
}

const loginSessionSchema = new Schema<ILoginSessionDocument>(
  {
    userId: { type: String, required: true },
    email: { type: String, required: true },
    loginCode: { type: String, required: true },
    loginCodeExpires: { type: Date, required: true },
  },
  {
    timestamps: true,
  }
);

// Indexes for quick lookups and automatic expiration
loginSessionSchema.index({ email: 1 });
loginSessionSchema.index({ loginCodeExpires: 1 }, { expireAfterSeconds: 0 });

export const LoginSessionModel = model<ILoginSessionDocument>('LoginSession', loginSessionSchema);
