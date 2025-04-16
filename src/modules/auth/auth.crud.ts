import { LoginSessionModel, ILoginSessionDocument } from './auth.schema';
import { UserCrud } from '../user/user.crud';
import { ILoginSession } from './auth.model';
import jwt from 'jsonwebtoken';
import { environment } from '../../config/environment';
import { Types } from 'mongoose';

interface IRegistrationSession {
  email: string;
  code: string;
  expiresAt: Date;
}

export class AuthCrud {
  private static registrationSessions = new Map<string, IRegistrationSession>();

  static generateLoginCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
  }

  static async createLoginSession(userId: string, email: string): Promise<ILoginSession> {
    // Delete any existing login sessions for this user
    await LoginSessionModel.deleteMany({ userId });

    const loginCode = this.generateLoginCode();
    const loginCodeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const session = await LoginSessionModel.create({
      userId,
      email,
      loginCode,
      loginCodeExpires,
    });

    return {
      _id: session._id.toString(),
      userId: session.userId,
      email: session.email,
      loginCode: session.loginCode,
      loginCodeExpires: session.loginCodeExpires,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
  }

  static async createRegistrationSession(email: string, code: string): Promise<void> {
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    this.registrationSessions.set(email, { email, code, expiresAt });
  }

  static async verifyRegistrationCode(email: string, code: string): Promise<boolean> {
    const session = this.registrationSessions.get(email);
    if (!session) return false;

    const isValid = session.code === code && session.expiresAt > new Date();
    if (isValid) {
      this.registrationSessions.delete(email);
    }
    return isValid;
  }

  static async deleteRegistrationSession(email: string): Promise<void> {
    this.registrationSessions.delete(email);
  }

  static async verifyLoginCode(email: string, code: string): Promise<ILoginSession | null> {
    const session = await LoginSessionModel.findOne({
      email: email.toLowerCase(),
      loginCode: code,
      loginCodeExpires: { $gt: new Date() }
    });

    if (!session) return null;

    return {
      _id: session._id.toString(),
      userId: session.userId,
      email: session.email,
      loginCode: session.loginCode,
      loginCodeExpires: session.loginCodeExpires,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
  }

  static async deleteLoginSession(sessionId: string): Promise<void> {
    await LoginSessionModel.findByIdAndDelete(new Types.ObjectId(sessionId));
  }

  static generateAuthToken(userId: string): string {
    return jwt.sign(
      { userId },
      environment.jwt.secret,
      { expiresIn: parseInt(environment.jwt.expiresIn) }
    );
  }

  static async verifyAuthToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, environment.jwt.secret) as { userId: string };
      const user = await UserCrud.findById(decoded.userId);
      return user ? decoded.userId : null;
    } catch {
      return null;
    }
  }

  static async regenerateLoginCode(email: string): Promise<ILoginSession | null> {
    const user = await UserCrud.findByEmail(email);
    if (!user) return null;

    // Delete existing session
    await LoginSessionModel.deleteMany({ userId: user._id });

    // Create new session
    return this.createLoginSession(user._id, email);
  }
}
