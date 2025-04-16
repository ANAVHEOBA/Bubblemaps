import { Router, Request, Response, NextFunction } from 'express';
import { AuthController } from './auth.controller';
import { validateRequest } from '../../middleware/validate-request';
import { IAuthRegister, IAuthVerify } from './auth.model';
import { RequestHandler } from 'express-serve-static-core';

const router = Router();
const authController = new AuthController();

// Auth routes
router.post(
  '/auth/initiate',
  AuthController.emailValidation as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request<{}, any, IAuthRegister>, res: Response, next: NextFunction) => {
    try {
      await authController.initiateAuth(req, res);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/auth/verify',
  AuthController.verificationValidation as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request<{}, any, IAuthVerify>, res: Response, next: NextFunction) => {
    try {
      await authController.verifyAuth(req, res);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/auth/resend-code',
  AuthController.emailValidation as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request<{}, any, IAuthRegister>, res: Response, next: NextFunction) => {
    try {
      await authController.resendCode(req, res);
    } catch (error) {
      next(error);
    }
  }
);

export const authRouter = router;
