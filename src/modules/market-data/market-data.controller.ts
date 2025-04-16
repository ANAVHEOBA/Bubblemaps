import { Request, Response } from 'express';
import { MarketDataService } from '../../services/market-data/market-data.service';
import { IMarketDataRequest, IMultipleMarketDataRequest } from './market-data.model';

export class MarketDataController {
  private marketDataService: MarketDataService;

  constructor() {
    // Initialize market data service with default options
    this.marketDataService = MarketDataService.getInstance({
      cacheDuration: 60 // 60 seconds cache
    });
  }

  public getTokenMarketData = async (req: Request<{}, {}, IMarketDataRequest>, res: Response) => {
    try {
      const { address } = req.body;
      const marketData = await this.marketDataService.getTokenMarketData(address);

      return res.json({
        success: true,
        data: {
          marketData
        }
      });
    } catch (error) {
      console.error('Error fetching market data:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch market data'
      });
    }
  };

  public getMultipleTokensMarketData = async (
    req: Request<{}, {}, IMultipleMarketDataRequest>,
    res: Response
  ) => {
    try {
      const { addresses } = req.body;
      const marketData = await this.marketDataService.getMultipleTokensMarketData(addresses);

      return res.json({
        success: true,
        data: marketData
      });
    } catch (error) {
      console.error('Error fetching multiple tokens market data:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch multiple tokens market data'
      });
    }
  };
} 