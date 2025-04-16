import { IMarketData, IMarketDataOptions } from './types/market-data.types';
import { DexScreenerProvider } from './providers/dexscreener.provider';
import NodeCache from 'node-cache';

export class MarketDataService {
  private static instance: MarketDataService;
  private readonly cache: NodeCache;
  private readonly cacheDuration: number;
  private readonly dexScreenerProvider: DexScreenerProvider;

  private constructor(options: IMarketDataOptions) {
    this.cacheDuration = options.cacheDuration || 60; // 60 seconds default
    this.cache = new NodeCache({ stdTTL: this.cacheDuration });
    this.dexScreenerProvider = DexScreenerProvider.getInstance();
  }

  public static getInstance(options: IMarketDataOptions): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService(options);
    }
    return MarketDataService.instance;
  }

  private getCacheKey(type: string, address: string): string {
    return `${type}:${address.toLowerCase()}`;
  }

  public async getTokenMarketData(address: string): Promise<IMarketData | null> {
    const cacheKey = this.getCacheKey('marketData', address);
    const cachedData = this.cache.get<IMarketData>(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }

    try {
      const marketData = await this.dexScreenerProvider.getTokenData(address);
      
      if (marketData) {
        this.cache.set(cacheKey, marketData);
      }
      
      return marketData;
    } catch (error) {
      console.error('Error fetching market data:', error);
      return null;
    }
  }

  public async getMultipleTokensMarketData(addresses: string[]): Promise<Record<string, IMarketData | null>> {
    return this.dexScreenerProvider.getMultipleTokensData(addresses);
  }
} 