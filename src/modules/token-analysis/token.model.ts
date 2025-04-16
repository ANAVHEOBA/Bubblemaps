import { Document } from 'mongoose';
import { SupportedChain } from '../../config/bubblemaps';

export interface IHolder {
  address: string;
  name?: string;
  amount: number;
  percentage: number;
  isContract: boolean;
  transactionCount: number;
  transferCount: number;
}

export interface IHolderLink {
  sourceAddress: string;
  targetAddress: string;
  sourceName?: string;
  targetName?: string;
  forwardAmount: number;
  backwardAmount: number;
}

export interface ITokenLink {
  address: string;
  name: string;
  symbol: string;
  decimals?: number;
}

export interface ISupplyDistribution {
  percentInCEX: number;
  percentInContracts: number;
}

export interface IAnalysisHistoryEntry {
  timestamp: Date;
  decentralizationScore: number;
  supplyDistribution: ISupplyDistribution;
  topHoldersCount: number;
}

export interface ILastError {
  message: string;
  timestamp: Date;
}

export interface ITokenAnalysis {
  // Token identification
  address: string;
  chain: SupportedChain;
  name: string;
  symbol: string;
  version: number;
  isNFT: boolean;

  // Current analysis state
  decentralizationScore: number;
  supplyDistribution: ISupplyDistribution;
  holders: IHolder[];
  holderLinks: IHolderLink[];
  relatedTokens: ITokenLink[];

  // Metadata
  lastAnalysis: Date;
  nextUpdateDue: Date;
  analysisHistory: IAnalysisHistoryEntry[];

  // Screenshot data
  screenshotUrl?: string;
  screenshotLastUpdate?: Date;

  // Error tracking
  lastError?: ILastError;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface ITokenAnalysisDocument extends ITokenAnalysis, Document {
  needsUpdate(): boolean;
  addToHistory(): void;
}

export { TokenAnalysisModel } from './token.schema';
