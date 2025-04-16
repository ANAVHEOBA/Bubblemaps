import NodeCache from 'node-cache';
import { CacheConfig, GeneratedCard } from '../types';

export class CardCache {
  private static instance: CardCache;
  private cache: NodeCache;

  private constructor(config: CacheConfig) {
    this.cache = new NodeCache({
      stdTTL: config.ttl,
      checkperiod: config.checkPeriod,
    });
  }

  public static getInstance(config: CacheConfig): CardCache {
    if (!CardCache.instance) {
      CardCache.instance = new CardCache(config);
    }
    return CardCache.instance;
  }

  public generateCacheKey(chain: string, address: string): string {
    return `card:${chain}:${address.toLowerCase()}`;
  }

  public async get(key: string): Promise<GeneratedCard | undefined> {
    return this.cache.get<GeneratedCard>(key);
  }

  public async set(key: string, card: GeneratedCard): Promise<boolean> {
    return this.cache.set(key, card);
  }

  public async delete(key: string): Promise<boolean> {
    return this.cache.del(key) > 0;
  }

  public async clear(): Promise<void> {
    this.cache.flushAll();
  }

  public getStats() {
    return this.cache.getStats();
  }
} 