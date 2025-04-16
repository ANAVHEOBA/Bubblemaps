import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, UserStatus } from '../../types/user.types';

const userSchema = new mongoose.Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: function(this: IUser) {
      return !this.telegramId; // Password is required only if there's no telegramId
    },
  },
  telegramId: {
    type: String,
    unique: true,
    sparse: true,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING,
  },
  verificationCode: {
    type: String,
    length: 6,
  },
  verificationCodeExpires: Date,
  lastLoginAt: Date,
}, {
  timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Transform user object when converting to JSON
userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationCode;
  delete obj.verificationCodeExpires;
  return obj;
};

export const UserModel = mongoose.model<IUser>('User', userSchema);
