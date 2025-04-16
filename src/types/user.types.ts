export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export interface IUser {
  _id: string;
  email: string;
  password: string;
  telegramId?: string;
  username?: string;
  status: UserStatus;
  verificationCode?: string;
  verificationCodeExpires?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserCreate {
  email: string;
  telegramId?: string;
  username?: string;
  status?: UserStatus;
}

export interface IUserUpdate {
  email?: string;
  telegramId?: string;
  username?: string;
  status?: UserStatus;
  lastLoginAt?: Date;
  verificationCode?: string;
  verificationCodeExpires?: Date;
}

export interface IUserResponse {
  id: string;
  email: string;
  telegramId?: string;
  username?: string;
  status: UserStatus;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface IVerifyEmailRequest {
  email: string;
  code: string;
}
