import { Router, Request, Response, NextFunction } from 'express';
import { TokenController } from './token.controller';
import { validateRequest } from '../../middleware/validate-request';
import { body, param, query } from 'express-validator';
import { SUPPORTED_CHAINS } from '../../config/bubblemaps';
import { RequestHandler } from 'express-serve-static-core';

const router = Router();

// Validation rules
const chainValidation = param('chain')
  .isIn(SUPPORTED_CHAINS)
  .withMessage(`Chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`);

const addressValidation = param('address')
  .matches(/^0x[a-fA-F0-9]{40}$/)
  .withMessage('Invalid token address format');

// Get token analysis
router.get(
  '/:chain/:address',
  [chainValidation, addressValidation] as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await TokenController.getAnalysis(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// Force update analysis
router.post(
  '/:chain/:address/update',
  [chainValidation, addressValidation] as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await TokenController.forceUpdate(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// Get recent analyses
router.get(
  '/recent',
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit must be between 1 and 50')
  ] as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await TokenController.getRecent(req, res);
    } catch (error) {
      next(error);
    }
  }
);

// Update screenshot URL
router.post(
  '/:id/screenshot',
  [
    param('id').isMongoId().withMessage('Invalid analysis ID'),
    body('screenshotUrl')
      .isURL()
      .withMessage('Invalid screenshot URL')
  ] as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await TokenController.updateScreenshot(req, res);
    } catch (error) {
      next(error);
    }
  }
);

export { router as tokenRouter };
