import mongoose, { Schema } from 'mongoose';
import { SUPPORTED_CHAINS } from '../../config/bubblemaps';
import { ITokenAnalysisDocument, IHolder, IHolderLink, ITokenLink } from './token.model';

// Holder information schema
const HolderSchema = new Schema<IHolder>({
  address: { type: String, required: true },
  name: { type: String },
  amount: { type: Number, required: true },
  percentage: { type: Number, required: true },
  isContract: { type: Boolean, required: true },
  transactionCount: { type: Number, required: true },
  transferCount: { type: Number, required: true },
}, { _id: false });

// Holder link schema
const HolderLinkSchema = new Schema<IHolderLink>({
  sourceAddress: { type: String, required: true },
  targetAddress: { type: String, required: true },
  sourceName: { type: String },
  targetName: { type: String },
  forwardAmount: { type: Number, required: true },
  backwardAmount: { type: Number, required: true },
}, { _id: false });

// Token link schema
const TokenLinkSchema = new Schema<ITokenLink>({
  address: { type: String, required: true },
  name: { type: String, required: true },
  symbol: { type: String, required: true },
  decimals: { type: Number },
}, { _id: false });

// Supply distribution schema
const SupplyDistributionSchema = new Schema({
  percentInCEX: { type: Number, required: true },
  percentInContracts: { type: Number, required: true },
}, { _id: false });

// Analysis history entry schema
const AnalysisHistoryEntrySchema = new Schema({
  timestamp: { type: Date, required: true },
  decentralizationScore: { type: Number, required: true },
  supplyDistribution: { type: SupplyDistributionSchema, required: true },
  topHoldersCount: { type: Number, required: true },
}, { _id: false });

// Main token analysis schema
const TokenAnalysisSchema = new Schema<ITokenAnalysisDocument>({
  // Token identification
  address: { 
    type: String, 
    required: true,
    lowercase: true 
  },
  chain: { 
    type: String, 
    required: true,
    enum: SUPPORTED_CHAINS 
  },
  name: { 
    type: String, 
    required: true 
  },
  symbol: { 
    type: String, 
    required: true 
  },
  version: {
    type: Number,
    required: true,
    min: 4,
    max: 5
  },
  isNFT: {
    type: Boolean,
    required: true,
    default: false
  },

  // Current analysis state
  decentralizationScore: { 
    type: Number, 
    required: true,
    min: 0,
    max: 100 
  },
  supplyDistribution: { 
    type: SupplyDistributionSchema, 
    required: true 
  },
  holders: {
    type: [HolderSchema],
    required: true,
    validate: [
      {
        validator: function(holders: IHolder[]) {
          return holders.length <= 150;
        },
        message: 'Holders array cannot exceed 150 entries'
      }
    ]
  },
  holderLinks: {
    type: [HolderLinkSchema],
    required: true,
    default: [],
    validate: [
      {
        validator: function(links: IHolderLink[]) {
          return links.length <= 1000;
        },
        message: 'Holder links array cannot exceed 1000 entries'
      }
    ]
  },
  relatedTokens: {
    type: [TokenLinkSchema],
    required: true,
    default: [],
  },

  // Metadata
  lastAnalysis: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  nextUpdateDue: { 
    type: Date, 
    required: true,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
  },
  analysisHistory: {
    type: [AnalysisHistoryEntrySchema],
    default: [],
    validate: [
      {
        validator: function(history: any[]) {
          return history.length <= 30;
        },
        message: 'Analysis history cannot exceed 30 entries'
      }
    ]
  },

  // Screenshot/visualization data
  screenshotUrl: { 
    type: String 
  },
  screenshotLastUpdate: { 
    type: Date 
  },

  // Error tracking
  lastError: {
    message: { type: String },
    timestamp: { type: Date }
  }
}, {
  timestamps: true
});

// Create indexes
TokenAnalysisSchema.index({ address: 1, chain: 1 }, { unique: true });
TokenAnalysisSchema.index({ nextUpdateDue: 1 });
TokenAnalysisSchema.index({ 'holders.address': 1 });
TokenAnalysisSchema.index({ 'holderLinks.sourceAddress': 1, 'holderLinks.targetAddress': 1 });

// Add methods to check if analysis needs update
TokenAnalysisSchema.methods.needsUpdate = function(this: ITokenAnalysisDocument): boolean {
  return Date.now() >= this.nextUpdateDue.getTime();
};

// Add method to update analysis history
TokenAnalysisSchema.methods.addToHistory = function(this: ITokenAnalysisDocument): void {
  this.analysisHistory.unshift({
    timestamp: this.lastAnalysis,
    decentralizationScore: this.decentralizationScore,
    supplyDistribution: this.supplyDistribution,
    topHoldersCount: this.holders.length
  });

  // Keep only last 30 entries
  if (this.analysisHistory.length > 30) {
    this.analysisHistory = this.analysisHistory.slice(0, 30);
  }
};

export const TokenAnalysisModel = mongoose.model<ITokenAnalysisDocument>('TokenAnalysis', TokenAnalysisSchema);
