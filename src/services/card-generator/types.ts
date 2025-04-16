export interface CardData {
  decentralizationScore: number;
  supply: {
    percentInCEX: number;
    percentInContracts: number;
  };
  tokenInfo: {
    name: string;
    symbol: string;
    chain: string;
    address: string;
  };
  likes?: number;
}

export interface CardOptions {
  width: number;
  height: number;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  font: string;
}

export interface CacheConfig {
  ttl: number;  // Time to live in seconds
  checkPeriod: number;  // Cleanup period in seconds
}

export interface GeneratedCard {
  buffer: Buffer;
  mimeType: string;
  cacheKey: string;
} 