import { SimulationNodeDatum } from 'd3';

export interface BubbleMapNode extends SimulationNodeDatum {
  address: string;
  amount: number;
  is_contract: boolean;
  name: string;
  percentage: number;
  transaction_count: number;
  transfer_count: number;
  radius?: number; // Calculated based on percentage
}

export interface BubbleMapLink {
  source: number | BubbleMapNode;
  target: number | BubbleMapNode;
  forward: number;
  backward: number;
  width?: number; // Calculated based on total flow
}

export interface TokenLink {
  address: string;
  name: string;
  symbol: string;
  decimals?: number;
  links: any[]; // Specific token link structure
}

export interface BubbleMapData {
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
  nodes: BubbleMapNode[];
  links: BubbleMapLink[];
  token_links: TokenLink[];
}

export interface BubbleMapOptions {
  width: number;
  height: number;
  minNodeSize: number;
  maxNodeSize: number;
  minLinkWidth: number;
  maxLinkWidth: number;
  colors: {
    contract: string;
    wallet: string;
    burn: string;
    cex: string;
    link: string;
  };
  fontFamily: string;
  backgroundColor: string;
}

export interface GeneratedBubbleMap {
  buffer: Buffer;
  mimeType: string;
  cacheKey: string;
} 