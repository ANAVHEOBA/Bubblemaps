import { environment } from './environment';

export const SUPPORTED_CHAINS = ['eth', 'bsc', 'ftm', 'avax', 'cro', 'arbi', 'poly', 'base', 'sol', 'sonic'] as const;
export type SupportedChain = typeof SUPPORTED_CHAINS[number];

export const bubblemapsConfig = {
  apiKey: environment.bubblemaps.apiKey,
  legacyApiUrl: 'https://api-legacy.bubblemaps.io',
  apiUrl: environment.bubblemaps.apiUrl,
  
  endpoints: {
    // Legacy API endpoints
    mapData: '/map-data',
    mapMetadata: '/map-metadata',
    
    // Main API endpoints
    tokenInfo: '/token',
    bubbleMap: '/bubble-map',
    marketData: '/market-data',
    decentralizationScore: '/decentralization-score',
  },
  
  headers: {
    'Content-Type': 'application/json',
  },

  // Add API key to headers only if it exists
  getHeaders() {
    return environment.bubblemaps.apiKey 
      ? {
          ...this.headers,
          'Authorization': `Bearer ${environment.bubblemaps.apiKey}`
        }
      : this.headers;
  }
} as const;
