export interface IMarketData {
  name: string;
  symbol: string;
  address: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  liquidity: number;
  lastUpdated: Date;
  chain: string;
  dex: string;
  transactions24h: {
    buys: number;
    sells: number;
    total: number;
  };
}

export interface IMarketDataOptions {
  cacheDuration?: number;
}

export interface IDEXScreenerToken {
  address: string;
  name: string;
  symbol: string;
}

export interface IDEXScreenerPair {
  baseToken: IDEXScreenerToken;
  quoteToken: IDEXScreenerToken;
  priceUsd: string;
  priceNative: string;
  pairAddress: string;
  chainId: string;
  dexId: string;
  liquidity: {
    base: number;
    quote: number;
    usd: number;
  };
  volume: {
    h1: number;
    h24: number;
    h6: number;
    m5: number;
  };
  priceChange: {
    h1: number;
    h24: number;
    h6: number;
    m5: number;
  };
  txns: {
    h1: { buys: number; sells: number };
    h24: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    m5: { buys: number; sells: number };
  };
  marketCap: number;
  fdv: number;
}

export interface IDEXScreenerResponse {
  pairs: IDEXScreenerPair[];
} 