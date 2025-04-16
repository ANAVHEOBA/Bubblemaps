import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { UserCrud } from '../user/user.crud';
import { AuthCrud } from './auth.crud';
import { emailService } from '../../services/email.service';
import { UserStatus } from '../../types/user.types';
import { IAuthRegister, IAuthVerify, AuthValidation } from './auth.model';

export class AuthController {
  // Validation Rules
  static emailValidation = AuthValidation.validateEmail();
  static verificationValidation = AuthValidation.validateVerification();

  private validateRequest(req: Request): { isValid: boolean; errors?: any[] } {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return { isValid: false, errors: errors.array() };
    }
    return { isValid: true };
  }

  initiateAuth = async (req: Request<{}, {}, IAuthRegister>, res: Response): Promise<void> => {
    try {
      const validation = this.validateRequest(req);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          errors: validation.errors
        });
        return;
      }

      const { email } = req.body;

      // Check if user exists
      let user = await UserCrud.findByEmail(email);
      
      if (!user) {
        // Create new user if doesn't exist
        user = await UserCrud.create({ 
          email,
          status: UserStatus.PENDING 
        });
      }

      // Create auth session and send code
      const session = await AuthCrud.createLoginSession(user._id, email);
      await emailService.sendVerificationCode(email, session.loginCode);

      res.json({
        success: true,
        message: 'Verification code sent to your email'
      });
    } catch (error) {
      console.error('Auth initiation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initiate authentication'
      });
    }
  };

  verifyAuth = async (req: Request<{}, {}, IAuthVerify>, res: Response): Promise<void> => {
    try {
      const validation = this.validateRequest(req);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          errors: validation.errors
        });
        return;
      }

      const { email, code } = req.body;

      // Verify code
      const session = await AuthCrud.verifyLoginCode(email, code);
      if (!session) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
        return;
      }

      // Get user
      const user = await UserCrud.findById(session.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Activate user if not already active
      if (user.status !== UserStatus.ACTIVE) {
        await UserCrud.update(user._id, { status: UserStatus.ACTIVE });
      }

      // Generate JWT token
      const token = AuthCrud.generateAuthToken(user._id);

      // Update last login
      await UserCrud.updateLastLogin(user._id);

      // Delete login session
      await AuthCrud.deleteLoginSession(session._id);

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            email: user.email,
            status: user.status
          },
          token
        }
      });
    } catch (error) {
      console.error('Auth verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify authentication'
      });
    }
  };

  resendCode = async (req: Request<{}, {}, IAuthRegister>, res: Response): Promise<void> => {
    try {
      const validation = this.validateRequest(req);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          errors: validation.errors
        });
        return;
      }

      const { email } = req.body;

      const session = await AuthCrud.regenerateLoginCode(email);
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'User not found or session expired'
        });
        return;
      }

      await emailService.resendVerificationCode(email, session.loginCode);

      res.json({
        success: true,
        message: 'New code sent to your email'
      });
    } catch (error) {
      console.error('Resend code error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend code'
      });
    }
  };
}
