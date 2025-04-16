import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D, Image } from 'canvas';
import { CardData, CardOptions, GeneratedCard } from '../types';
import { CardCache } from '../cache/card-cache';
import path from 'path';

export class CardGenerator {
  private static instance: CardGenerator;
  private cache: CardCache;
  private defaultOptions: CardOptions = {
    width: 400,
    height: 300,
    backgroundColor: '#ffffff',
    textColor: '#000000',
    accentColor: '#0066ff',
    font: 'Arial'
  };

  private constructor(cache: CardCache) {
    this.cache = cache;
    this.initializeFonts();
  }

  public static getInstance(cache: CardCache): CardGenerator {
    if (!CardGenerator.instance) {
      CardGenerator.instance = new CardGenerator(cache);
    }
    return CardGenerator.instance;
  }

  private initializeFonts() {
    // Register fonts if needed
    try {
      registerFont(path.join(__dirname, '../assets/fonts/Inter-Regular.ttf'), { family: 'Inter' });
      registerFont(path.join(__dirname, '../assets/fonts/Inter-Bold.ttf'), { family: 'Inter', weight: 'bold' });
    } catch (error) {
      console.warn('Failed to load custom fonts, falling back to system fonts:', error);
    }
  }

  public async generateCard(data: CardData, options: Partial<CardOptions> = {}): Promise<GeneratedCard> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const canvas = createCanvas(mergedOptions.width, mergedOptions.height);
    const ctx = canvas.getContext('2d');

    // Set background
    ctx.fillStyle = mergedOptions.backgroundColor;
    ctx.fillRect(0, 0, mergedOptions.width, mergedOptions.height);

    // Draw decentralization score
    this.drawDecentralizationScore(ctx, data.decentralizationScore, mergedOptions);

    // Draw supply distribution
    this.drawSupplyDistribution(ctx, data.supply, mergedOptions);

    // Draw token info
    this.drawTokenInfo(ctx, data.tokenInfo, mergedOptions);

    // Draw likes if available
    if (data.likes !== undefined) {
      this.drawLikes(ctx, data.likes, mergedOptions);
    }

    // Draw Bubblemaps logo
    await this.drawLogo(ctx, mergedOptions);

    // Generate buffer
    const buffer = canvas.toBuffer('image/png');

    // Create cache key
    const cacheKey = this.cache.generateCacheKey(data.tokenInfo.chain, data.tokenInfo.address);

    return {
      buffer,
      mimeType: 'image/png',
      cacheKey
    };
  }

  private drawDecentralizationScore(ctx: CanvasRenderingContext2D, score: number, options: CardOptions) {
    // Draw score text
    ctx.font = `bold 24px ${options.font}`;
    ctx.fillStyle = options.textColor;
    ctx.fillText(`Decentralization Score`, 20, 40);
    ctx.fillText(`${score.toFixed(2)}%`, 20, 70);

    // Draw progress bar
    const barWidth = options.width - 40;
    const barHeight = 10;
    const barY = 80;

    // Background
    ctx.fillStyle = '#eee';
    ctx.fillRect(20, barY, barWidth, barHeight);

    // Progress
    ctx.fillStyle = options.accentColor;
    ctx.fillRect(20, barY, barWidth * (score / 100), barHeight);
  }

  private drawSupplyDistribution(ctx: CanvasRenderingContext2D, supply: CardData['supply'], options: CardOptions) {
    ctx.font = `18px ${options.font}`;
    ctx.fillStyle = options.textColor;
    
    // Draw CEX percentage
    ctx.fillText(`${supply.percentInCEX.toFixed(2)}% in CEX`, 20, 130);
    
    // Draw Contracts percentage
    ctx.fillText(`${supply.percentInContracts.toFixed(2)}% in Contracts`, 20, 160);
  }

  private drawTokenInfo(ctx: CanvasRenderingContext2D, tokenInfo: CardData['tokenInfo'], options: CardOptions) {
    ctx.font = `14px ${options.font}`;
    ctx.fillStyle = '#666666';
    
    const shortAddress = `${tokenInfo.address.slice(0, 6)}...${tokenInfo.address.slice(-4)}`;
    ctx.fillText(`${tokenInfo.chain} • ${shortAddress}`, 20, options.height - 30);
  }

  private drawLikes(ctx: CanvasRenderingContext2D, likes: number, options: CardOptions) {
    ctx.font = `16px ${options.font}`;
    ctx.fillStyle = '#ff4444';
    ctx.fillText(`♥ ${likes}`, options.width - 60, 30);
  }

  private async drawLogo(ctx: CanvasRenderingContext2D, options: CardOptions) {
    try {
      const logo = await loadImage(path.join(__dirname, '../assets/images/bubblemaps-logo.png'));
      ctx.drawImage(logo as unknown as Image, options.width - 120, options.height - 40, 100, 20);
    } catch (error) {
      console.warn('Failed to load Bubblemaps logo:', error);
      // Fallback to text
      ctx.font = `12px ${options.font}`;
      ctx.fillStyle = '#666666';
      ctx.fillText('Powered by Bubblemaps', options.width - 120, options.height - 20);
    }
  }
} 