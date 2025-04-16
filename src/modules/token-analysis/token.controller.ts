import { Request, Response } from 'express';
import { TokenAnalysisCrud } from './token.crud';
import { ApiError } from '../../errors/api-error';
import { SUPPORTED_CHAINS } from '../../config/bubblemaps';

export class TokenController {
  /**
   * Get token analysis
   */
  static async getAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { address, chain } = req.params;

      if (!address) {
        throw new ApiError('Token address is required', 400);
      }

      if (!chain || !SUPPORTED_CHAINS.includes(chain as any)) {
        throw new ApiError(`Chain must be one of: ${SUPPORTED_CHAINS.join(', ')}`, 400);
      }

      const analysis = await TokenAnalysisCrud.getAnalysis(address, chain);
      
      res.json({
        success: true,
        data: {
          tokenInfo: {
            name: analysis.name,
            symbol: analysis.symbol,
            address: analysis.address,
            chain: analysis.chain,
            version: analysis.version,
            isNFT: analysis.isNFT
          },
          analysis: {
            decentralizationScore: analysis.decentralizationScore,
            supplyDistribution: analysis.supplyDistribution,
            lastUpdate: analysis.lastAnalysis,
            nextUpdate: analysis.nextUpdateDue
          },
          holders: analysis.holders.slice(0, 10).map(holder => ({
            ...holder,
            transactionCount: holder.transactionCount,
            transferCount: holder.transferCount
          })),
          screenshotUrl: analysis.screenshotUrl
        }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get holder relationships
   */
  static async getHolderLinks(req: Request, res: Response): Promise<void> {
    try {
      const { address, chain } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string || '20', 10), 100);
      
      const analysis = await TokenAnalysisCrud.getAnalysis(address, chain);
      
      res.json({
        success: true,
        data: {
          tokenInfo: {
            name: analysis.name,
            symbol: analysis.symbol,
            address: analysis.address,
            chain: analysis.chain
          },
          holderLinks: analysis.holderLinks.slice(0, limit),
          lastUpdate: analysis.lastAnalysis
        }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get related tokens
   */
  static async getRelatedTokens(req: Request, res: Response): Promise<void> {
    try {
      const { address, chain } = req.params;
      
      const analysis = await TokenAnalysisCrud.getAnalysis(address, chain);
      
      res.json({
        success: true,
        data: {
          tokenInfo: {
            name: analysis.name,
            symbol: analysis.symbol,
            address: analysis.address,
            chain: analysis.chain
          },
          relatedTokens: analysis.relatedTokens,
          lastUpdate: analysis.lastAnalysis
        }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Force update analysis
   */
  static async forceUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { address, chain } = req.params;
      
      const analysis = await TokenAnalysisCrud.forceUpdate(address, chain);
      
      res.json({
        success: true,
        message: 'Analysis updated successfully',
        data: {
          lastUpdate: analysis.lastAnalysis,
          nextUpdate: analysis.nextUpdateDue
        }
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get recent analyses
   */
  static async getRecent(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 50);
      const analyses = await TokenAnalysisCrud.getRecentAnalyses(limit);
      
      res.json({
        success: true,
        data: analyses.map(analysis => ({
          name: analysis.name,
          symbol: analysis.symbol,
          address: analysis.address,
          chain: analysis.chain,
          decentralizationScore: analysis.decentralizationScore,
          lastUpdate: analysis.lastAnalysis,
          isNFT: analysis.isNFT
        }))
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Update screenshot URL
   */
  static async updateScreenshot(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { screenshotUrl } = req.body;

      if (!screenshotUrl) {
        throw new ApiError('Screenshot URL is required', 400);
      }

      await TokenAnalysisCrud.updateScreenshot(id, screenshotUrl);
      
      res.json({
        success: true,
        message: 'Screenshot URL updated successfully'
      });
    } catch (error) {
      if (error instanceof ApiError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
}
