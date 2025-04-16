import { BubblemapsService } from '../../services/bubblemaps.service';
import { TokenAnalysisModel, ITokenAnalysis, ITokenAnalysisDocument, IHolder, IHolderLink, ITokenLink } from './token.model';
import { SupportedChain } from '../../config/bubblemaps';
import { ApiError } from '../../errors/api-error';

export class TokenAnalysisCrud {
  private static bubblemapsService = BubblemapsService.getInstance();

  /**
   * Get token analysis, fetching new data if needed
   */
  static async getAnalysis(address: string, chain: string): Promise<ITokenAnalysisDocument> {
    // Normalize address to lowercase
    address = address.toLowerCase();

    // Find existing analysis
    let analysis = await TokenAnalysisModel.findOne({ address, chain }).exec();

    // If analysis exists and is up to date, return it
    if (analysis && !analysis.needsUpdate()) {
      return analysis;
    }

    // Fetch fresh data from Bubblemaps
    try {
      const tokenData = await this.bubblemapsService.analyzeToken(address, chain);

      const holders: IHolder[] = tokenData.topHolders.map(holder => ({
        address: holder.address,
        name: holder.name,
        amount: holder.amount,
        percentage: holder.percentage,
        isContract: holder.isContract,
        transactionCount: holder.transactionCount,
        transferCount: holder.transferCount,
      }));

      const holderLinks: IHolderLink[] = tokenData.holderLinks || [];
      const relatedTokens: ITokenLink[] = tokenData.relatedTokens || [];

      if (!analysis) {
        // Create new analysis
        analysis = new TokenAnalysisModel({
          address,
          chain,
          name: tokenData.tokenInfo.name,
          symbol: tokenData.tokenInfo.symbol,
          version: tokenData.tokenInfo.version,
          isNFT: tokenData.tokenInfo.isNFT,
          decentralizationScore: tokenData.decentralizationScore,
          supplyDistribution: {
            percentInCEX: tokenData.supply.percentInCEX,
            percentInContracts: tokenData.supply.percentInContracts,
          },
          holders,
          holderLinks,
          relatedTokens,
          lastAnalysis: new Date(),
          nextUpdateDue: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h cache
        });
      } else {
        // Update existing analysis
        analysis.name = tokenData.tokenInfo.name;
        analysis.symbol = tokenData.tokenInfo.symbol;
        analysis.version = tokenData.tokenInfo.version;
        analysis.isNFT = tokenData.tokenInfo.isNFT;
        analysis.decentralizationScore = tokenData.decentralizationScore;
        analysis.supplyDistribution = {
          percentInCEX: tokenData.supply.percentInCEX,
          percentInContracts: tokenData.supply.percentInContracts,
        };
        analysis.holders = holders;
        analysis.holderLinks = holderLinks;
        analysis.relatedTokens = relatedTokens;
        analysis.lastAnalysis = new Date();
        analysis.nextUpdateDue = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Add current state to history before updating
        analysis.addToHistory();
      }

      await analysis.save();
      return analysis;
    } catch (error) {
      // If analysis exists, mark error but return cached data
      if (analysis) {
        analysis.lastError = {
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        };
        await analysis.save();
        return analysis;
      }
      throw error;
    }
  }

  /**
   * Get analysis by ID
   */
  static async getById(id: string): Promise<ITokenAnalysisDocument | null> {
    return TokenAnalysisModel.findById(id).exec();
  }

  /**
   * Find analysis by address and chain
   */
  static async findByAddress(address: string, chain: string): Promise<ITokenAnalysisDocument | null> {
    return TokenAnalysisModel.findOne({ 
      address: address.toLowerCase(), 
      chain 
    }).exec();
  }

  /**
   * Update screenshot URL
   */
  static async updateScreenshot(id: string, screenshotUrl: string): Promise<void> {
    await TokenAnalysisModel.findByIdAndUpdate(id, {
      $set: {
        screenshotUrl,
        screenshotLastUpdate: new Date()
      }
    }).exec();
  }

  /**
   * Get tokens that need updating
   */
  static async getTokensNeedingUpdate(limit: number = 10): Promise<ITokenAnalysisDocument[]> {
    return TokenAnalysisModel.find({
      nextUpdateDue: { $lte: new Date() }
    })
    .sort({ nextUpdateDue: 1 })
    .limit(limit)
    .exec();
  }

  /**
   * Get recent analyses
   */
  static async getRecentAnalyses(limit: number = 10): Promise<ITokenAnalysisDocument[]> {
    return TokenAnalysisModel.find()
      .sort({ lastAnalysis: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Delete old analyses
   */
  static async deleteOldAnalyses(daysOld: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    await TokenAnalysisModel.deleteMany({
      updatedAt: { $lt: cutoffDate }
    }).exec();
  }

  /**
   * Force update analysis
   */
  static async forceUpdate(address: string, chain: string): Promise<ITokenAnalysisDocument> {
    const analysis = await this.findByAddress(address, chain);
    if (!analysis) {
      throw new ApiError('Analysis not found', 404);
    }

    analysis.nextUpdateDue = new Date(0); // Set to past date to force update
    await analysis.save();

    return this.getAnalysis(address, chain);
  }
}
