import { UserModel } from './user.schema';
import { IUser, IUserCreate, IUserUpdate, UserStatus } from '../../types/user.types';

export class UserCrud {
  static generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  static async create(userData: IUserCreate): Promise<IUser> {
    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const user = new UserModel({
      ...userData,
      verificationCode,
      verificationCodeExpires,
      status: UserStatus.PENDING
    });

    return user.save();
  }

  static async findByEmail(email: string): Promise<IUser | null> {
    return UserModel.findOne({ email: email.toLowerCase() });
  }

  static async findByTelegramId(telegramId: string): Promise<IUser | null> {
    return UserModel.findOne({ telegramId });
  }

  static async findById(id: string): Promise<IUser | null> {
    return UserModel.findById(id);
  }

  static async update(id: string, updateData: IUserUpdate): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
  }

  static async verifyEmail(email: string, code: string): Promise<IUser | null> {
    const user = await UserModel.findOne({
      email: email.toLowerCase(),
      verificationCode: code,
      verificationCodeExpires: { $gt: new Date() },
      status: UserStatus.PENDING
    });

    if (!user) return null;

    user.status = UserStatus.ACTIVE;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;

    return user.save();
  }

  static async regenerateVerificationCode(email: string): Promise<IUser | null> {
    const user = await this.findByEmail(email);
    if (!user || user.status !== UserStatus.PENDING) return null;

    const verificationCode = this.generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    return this.update(user._id, {
      verificationCode,
      verificationCodeExpires
    });
  }

  static async updateLastLogin(id: string): Promise<void> {
    await UserModel.findByIdAndUpdate(id, {
      $set: { lastLoginAt: new Date() }
    });
  }

  static async delete(id: string): Promise<IUser | null> {
    return UserModel.findByIdAndDelete(id);
  }

  static async updateByTelegramId(telegramId: string, data: IUserUpdate): Promise<IUser | null> {
    return UserModel.findOneAndUpdate({ telegramId }, data, { new: true });
  }

  static async unlinkTelegram(telegramId: string): Promise<IUser | null> {
    return UserModel.findOneAndUpdate(
      { telegramId },
      { $unset: { telegramId: 1 } },
      { new: true }
    );
  }

  static async isEmailTaken(email: string): Promise<boolean> {
    const user = await UserModel.findOne({ email: email.toLowerCase() });
    return !!user;
  }

  static async isTelegramLinked(telegramId: string): Promise<boolean> {
    const user = await UserModel.findOne({ telegramId });
    return !!user;
  }
}
