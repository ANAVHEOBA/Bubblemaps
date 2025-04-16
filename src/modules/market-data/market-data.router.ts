import { Router, Request, Response, NextFunction } from 'express';
import { MarketDataController } from './market-data.controller';
import { MarketDataValidation } from './market-data.model';
import { validateRequest } from '../../middleware/validate-request';
import { RequestHandler } from 'express-serve-static-core';
import { IMarketDataRequest, IMultipleMarketDataRequest } from './market-data.model';

const router = Router();
const controller = new MarketDataController();

router.post(
  '/token',
  MarketDataValidation.getMarketData as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request<{}, any, IMarketDataRequest>, res: Response, next: NextFunction) => {
    try {
      await controller.getTokenMarketData(req, res);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/tokens',
  MarketDataValidation.getMultipleMarketData as RequestHandler[],
  validateRequest as RequestHandler,
  async (req: Request<{}, any, IMultipleMarketDataRequest>, res: Response, next: NextFunction) => {
    try {
      await controller.getMultipleTokensMarketData(req, res);
    } catch (error) {
      next(error);
    }
  }
);

export default router; 