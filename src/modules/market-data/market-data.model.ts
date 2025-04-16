import { IMarketData } from '../../services/market-data/types/market-data.types';
import { body } from 'express-validator';

export interface IMarketDataRequest {
  address: string;
}

export interface IMultipleMarketDataRequest {
  addresses: string[];
}

export interface IMarketDataResponse {
  marketData: IMarketData | null;
}

export class MarketDataValidation {
  static getMarketData = [
    body('address')
      .isString()
      .notEmpty()
      .withMessage('Token address is required')
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Invalid token address format')
  ];

  static getMultipleMarketData = [
    body('addresses')
      .isArray()
      .withMessage('Addresses must be an array')
      .notEmpty()
      .withMessage('At least one address is required'),
    body('addresses.*')
      .isString()
      .matches(/^0x[a-fA-F0-9]{40}$/)
      .withMessage('Invalid token address format')
  ];
} 