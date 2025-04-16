import axios from 'axios';
import { bubblemapsConfig, SUPPORTED_CHAINS, SupportedChain } from '../config/bubblemaps';
import { ApiError } from '../errors/api-error';

export interface MapMetadata {
  decentralisation_score: number;
  identified_supply: {
    percent_in_cexs: number;
    percent_in_contracts: number;
  };
  dt_update: string;
  ts_update: number;
  status: 'OK' | 'KO';
  message?: string;
}

export interface MapNode {
  address: string;
  amount: number;
  is_contract: boolean;
  name: string;
  percentage: number;
  transaction_count: number;
  transfer_X721_count: number | null;
  transfer_count: number;
}

export interface MapLink {
  backward: number;
  forward: number;
  source: number;
  target: number;
}

export interface TokenLink {
  address: string;
  decimals?: number;
  name: string;
  symbol: string;
  links: MapLink[];
}

export interface MapData {
  version: number;
  chain: string;
  token_address: string;
  dt_update: string;
  full_name: string;
  symbol: string;
  is_X721: boolean;
  metadata: {
    max_amount: number;
    min_amount: number;
  };
  nodes: MapNode[];
  links: MapLink[];
  token_links: TokenLink[];
}

export class BubblemapsService {
  private static instance: BubblemapsService;

  private constructor() {}

  static getInstance(): BubblemapsService {
    if (!BubblemapsService.instance) {
      BubblemapsService.instance = new BubblemapsService();
    }
    return BubblemapsService.instance;
  }

  /**
   * Validates if a chain is supported
   */
  private validateChain(chain: string): asserts chain is SupportedChain {
    if (!SUPPORTED_CHAINS.includes(chain as SupportedChain)) {
      throw new ApiError('Invalid chain parameter', 400);
    }
  }

  /**
   * Get map metadata for a token
   */
  async getMapMetadata(tokenAddress: string, chain: string): Promise<MapMetadata> {
    this.validateChain(chain);
    
    try {
      const response = await axios.get<MapMetadata>(
        `${bubblemapsConfig.legacyApiUrl}${bubblemapsConfig.endpoints.mapMetadata}`,
        {
          params: {
            token: tokenAddress,
            chain,
          },
          headers: bubblemapsConfig.getHeaders(),
        }
      );

      if (response.data.status === 'KO') {
        throw new ApiError(response.data.message || 'Failed to fetch map metadata', 400);
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new ApiError(
          error.response?.data?.message || 'Failed to fetch map metadata',
          error.response?.status || 500
        );
      }
      throw error;
    }
  }

  /**
   * Get map data for a token
   */
  async getMapData(tokenAddress: string, chain: string): Promise<MapData> {
    this.validateChain(chain);
    
    try {
      const response = await axios.get<MapData>(
        `${bubblemapsConfig.legacyApiUrl}${bubblemapsConfig.endpoints.mapData}`,
        {
          params: {
            token: tokenAddress,
            chain,
          },
          headers: bubblemapsConfig.getHeaders(),
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new ApiError('Data not available for this token', 400);
        }
        throw new ApiError(
          error.response?.data?.message || 'Failed to fetch map data',
          error.response?.status || 500
        );
      }
      throw error;
    }
  }

  /**
   * Get comprehensive token analysis including relationships
   */
  async analyzeToken(tokenAddress: string, chain: string) {
    this.validateChain(chain);
    
    const [mapData, mapMetadata] = await Promise.all([
      this.getMapData(tokenAddress, chain),
      this.getMapMetadata(tokenAddress, chain),
    ]);

    // Convert node indices to addresses in links
    const holderLinks = mapData.links.map(link => ({
      sourceAddress: mapData.nodes[link.source].address,
      targetAddress: mapData.nodes[link.target].address,
      sourceName: mapData.nodes[link.source].name,
      targetName: mapData.nodes[link.target].name,
      forwardAmount: link.forward,
      backwardAmount: link.backward,
    }));

    return {
      tokenInfo: {
        name: mapData.full_name,
        symbol: mapData.symbol,
        address: mapData.token_address,
        chain: mapData.chain,
        lastUpdate: mapData.dt_update,
        version: mapData.version,
        isNFT: mapData.is_X721,
      },
      decentralizationScore: mapMetadata.decentralisation_score,
      supply: {
        percentInCEX: mapMetadata.identified_supply.percent_in_cexs,
        percentInContracts: mapMetadata.identified_supply.percent_in_contracts,
      },
      topHolders: mapData.nodes.slice(0, 10).map(node => ({
        address: node.address,
        name: node.name,
        percentage: node.percentage,
        amount: node.amount,
        isContract: node.is_contract,
        transactionCount: node.transaction_count,
        transferCount: node.transfer_count,
      })),
      holderLinks: holderLinks.slice(0, 20), // Top 20 relationships
      relatedTokens: mapData.token_links.map(token => ({
        address: token.address,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
      })),
    };
  }
}
