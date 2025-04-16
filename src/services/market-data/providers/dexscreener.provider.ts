import axios from 'axios';
import { IMarketData } from '../types/market-data.types';

export class DexScreenerProvider {
  private static instance: DexScreenerProvider;
  private readonly baseUrl = 'https://api.dexscreener.com/latest';

  private constructor() {}

  public static getInstance(): DexScreenerProvider {
    if (!DexScreenerProvider.instance) {
      DexScreenerProvider.instance = new DexScreenerProvider();
    }
    return DexScreenerProvider.instance;
  }

  private getBestPair(pairs: any[]): any {
    if (!pairs || pairs.length === 0) return null;
    return pairs.reduce((best, current) => {
      const bestLiquidity = parseFloat(best.liquidity?.usd || '0');
      const currentLiquidity = parseFloat(current.liquidity?.usd || '0');
      return currentLiquidity > bestLiquidity ? current : best;
    });
  }

  public async getTokenData(address: string): Promise<IMarketData | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/dex/tokens/${address}`);
      const pairs = response.data.pairs;
      if (!pairs || pairs.length === 0) return null;

      const bestPair = this.getBestPair(pairs);
      if (!bestPair) return null;

      return {
        name: bestPair.baseToken.name,
        symbol: bestPair.baseToken.symbol,
        address: bestPair.baseToken.address,
        price: parseFloat(bestPair.priceUsd || '0'),
        priceChange24h: parseFloat(bestPair.priceChange.h24 || '0'),
        marketCap: parseFloat(bestPair.marketCap || '0'),
        volume24h: parseFloat(bestPair.volume.h24 || '0'),
        liquidity: parseFloat(bestPair.liquidity.usd || '0'),
        lastUpdated: new Date(bestPair.pairCreatedAt),
        chain: bestPair.chainId,
        dex: bestPair.dexId,
        transactions24h: {
          buys: bestPair.txns.h24.buys,
          sells: bestPair.txns.h24.sells,
          total: bestPair.txns.h24.buys + bestPair.txns.h24.sells,
        },
      };
    } catch (error) {
      console.error('Error fetching token data from DEXScreener:', error);
      return null;
    }
  }

  public async getMultipleTokensData(addresses: string[]): Promise<Record<string, IMarketData | null>> {
    const results = await Promise.all(
      addresses.map(async (address) => ({
        address,
        data: await this.getTokenData(address),
      }))
    );

    return results.reduce(
      (acc, { address, data }) => ({
        ...acc,
        [address]: data,
      }),
      {}
    );
  }
} 