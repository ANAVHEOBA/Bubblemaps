import mongoose from 'mongoose';
import { UserStatus } from '../../types/user.types';

export interface IUser {
  _id: string;
  email: string;
  telegramId?: string;
  username?: string;
  status: UserStatus;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserCreate {
  email: string;
  telegramId?: string;
  username?: string;
  status?: UserStatus;
}

const userSchema = new mongoose.Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  telegramId: {
    type: String,
    sparse: true,
    unique: true,
  },
  username: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING,
    required: true,
  },
  lastLoginAt: Date,
}, {
  timestamps: true,
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ telegramId: 1 });

export const UserModel = mongoose.model<IUser>('User', userSchema);
