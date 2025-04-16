import { body, ValidationChain } from 'express-validator';
import { Types } from 'mongoose';

// Auth Interfaces
export interface IAuthRegister {
  email: string;
}

export interface IAuthVerify {
  email: string;
  code: string;
}

export interface IAuthResponse {
  user: {
    id: string;
    email: string;
    status: string;
  };
  token: string;
}

export interface ILoginSession {
  _id: string;
  userId: string;
  email: string;
  loginCode: string;
  loginCodeExpires: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Validation Rules
export class AuthValidation {
  static validateEmail(): ValidationChain[] {
    return [
      body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),
    ];
  }

  static validateVerification(): ValidationChain[] {
    return [
      body('email').isEmail().normalizeEmail(),
      body('code').isLength({ min: 6, max: 6 }).isNumeric()
        .withMessage('Please provide a valid 6-digit code'),
    ];
  }
}
