import { Telegraf, Context } from 'telegraf';
import { Message } from 'telegraf/types';
import { UserCrud } from '../modules/user/user.crud';
import { UserStatus } from '../types/user.types';
import { emailService } from '../services/email.service';
import { environment } from '../config/environment';
import { AuthCrud } from '../modules/auth/auth.crud';
import { TokenAnalysisCrud } from '../modules/token-analysis/token.crud';
import { SUPPORTED_CHAINS } from '../config/bubblemaps';
import { ApiError } from '../errors/api-error';
import { CardGenerator } from './card-generator/generators/card-generator';
import { CardCache } from './card-generator/cache/card-cache';
import { CacheConfig } from './card-generator/types';
import { BubbleMapGenerator } from './bubble-map-generator/generators/bubble-map-generator';
import { MarketDataService } from './market-data/market-data.service';
import { IMarketData } from './market-data/types/market-data.types';

interface UserSession {
  state: 'START' | 'AWAITING_EMAIL' | 'AWAITING_VERIFICATION';
  email?: string;
}

export class TelegramService {
  private static instance: TelegramService;
  private bot: Telegraf;
  private userSessions: Map<number, any>;
  private marketDataService: MarketDataService;

  private constructor(bot: Telegraf) {
    this.bot = bot;
    this.userSessions = new Map();
    this.marketDataService = MarketDataService.getInstance({
      cacheDuration: 60 // 60 seconds cache
    });
    this.setupCommands();
  }

  public static getInstance(bot?: Telegraf): TelegramService {
    if (!TelegramService.instance) {
      if (!bot) {
        throw new Error('Bot instance must be provided when creating TelegramService');
      }
      TelegramService.instance = new TelegramService(bot);
    }
    return TelegramService.instance;
  }

  private setupCommands(): void {
    console.log('Setting up bot commands...');
    
    // Debug middleware to log all updates
    this.bot.use((ctx, next) => {
      console.log('Received update:', ctx.update);
      return next();
    });

    // Start command
    this.bot.command('start', async (ctx) => {
      console.log('Start command received');
      if (!ctx.from) {
        console.log('No from field in context');
        return;
      }
      await this.handleStart(ctx);
    });
    
    // Help command
    this.bot.command('help', (ctx) => {
      ctx.reply(
        'Available commands:\n' +
        '/start - Start using the bot\n' +
        '/help - Show this help message\n' +
        '/status - Check your account status\n' +
        '/cancel - Cancel current operation\n' +
        '\nToken Analysis:\n' +
        '/analyze <chain> <address> - Analyze a token\n' +
        '/links <chain> <address> - View holder relationships\n' +
        '/related <chain> <address> - View related tokens\n' +
        '/recent - Show recent token analyses\n' +
        '/update <chain> <address> - Force update token analysis\n' +
        '\nMarket Data:\n' +
        '/price <address> - Get token price and 24h change\n' +
        '/market <address> - Get detailed market data\n' +
        `\nSupported chains: ${SUPPORTED_CHAINS.join(', ')}`
      );
    });
    
    // Status command
    this.bot.command('status', async (ctx) => {
      console.log('Status command received');
      if (!ctx.from) {
        console.log('No from field in context');
        return;
      }
      await this.handleStatus(ctx);
    });

    // Cancel command
    this.bot.command('cancel', async (ctx) => {
      console.log('Cancel command received');
      if (!ctx.from) {
        console.log('No from field in context');
        return;
      }
      await this.handleCancel(ctx);
    });

    // Add token analysis commands
    this.bot.command('analyze', this.handleAnalyzeCommand.bind(this));
    this.bot.command('links', this.handleLinksCommand.bind(this));
    this.bot.command('related', this.handleRelatedCommand.bind(this));
    this.bot.command('recent', this.handleRecentCommand.bind(this));
    this.bot.command('update', this.handleUpdateCommand.bind(this));

    // Add market data commands
    this.bot.command('price', this.handlePriceCommand.bind(this));
    this.bot.command('market', this.handleMarketCommand.bind(this));

    // Error handler
    this.bot.catch((err: any) => {
      console.error('Telegram bot error:', err);
    });

    console.log('Bot commands setup completed');
  }

  private setupMessageHandlers(): void {
    console.log('Setting up message handlers...');
    
    // Handle regular messages based on session state
    this.bot.on('text', async (ctx) => {
      if (!ctx.from || !ctx.message) {
        console.log('Missing from or message field in context');
        return;
      }

      console.log('Text message received:', ctx.message.text);
      const userId = ctx.from.id;
      const session = this.userSessions.get(userId) || { state: 'START' };
      console.log('User session:', session);

      switch (session.state) {
        case 'AWAITING_EMAIL':
          await this.handleEmailSubmission(ctx);
          break;
        case 'AWAITING_VERIFICATION':
          await this.handleVerificationCode(ctx);
          break;
        default:
          await ctx.reply('Use /start to begin registration or /help for available commands.');
      }
    });

    console.log('Message handlers setup completed');
  }

  private async handleStart(ctx: Context): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Could not identify your Telegram ID. Please try again.');
        return;
      }

      const telegramId = ctx.from.id.toString();
      
      // Check if user already exists
      const existingUser = await UserCrud.findByTelegramId(telegramId);
      
      if (existingUser) {
        await ctx.reply(
          `Welcome back! 🎉\n\n` +
          `Your account is already linked with ${existingUser.email}\n` +
          `Use /status to check your account details.`
        );
        return;
      }

      // Start registration process
      this.userSessions.set(ctx.from.id, { state: 'AWAITING_EMAIL' });
      
      await ctx.reply(
        `Welcome to Bubblemaps! 🌟\n\n` +
        `Let's create your account. Please enter your email address.`
      );
    } catch (error) {
      console.error('Error in start command:', error);
      await ctx.reply('Sorry, something went wrong. Please try again later.');
    }
  }

  private async handleEmailSubmission(ctx: Context): Promise<void> {
    try {
      if (!ctx.from || !ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Could not process your message. Please try again.');
        return;
      }

      const email = ctx.message.text.toLowerCase();
      const telegramId = ctx.from.id.toString();

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await ctx.reply('Please enter a valid email address.');
        return;
      }

      // Check if email is already taken
      const existingUser = await UserCrud.findByEmail(email);
      if (existingUser) {
        await ctx.reply('This email is already registered. Please use a different email address.');
        return;
      }

      // Create new user
      const user = await UserCrud.create({
        email,
        telegramId,
        status: UserStatus.PENDING
      });

      // Send verification code
      await emailService.sendVerificationCode(email, user.verificationCode!);

      // Update session state
      this.userSessions.set(ctx.from.id, {
        state: 'AWAITING_VERIFICATION',
        email
      });

      await ctx.reply(
        `Great! I've sent a verification code to ${email}.\n` +
        `Please enter the 6-digit code to verify your account.\n\n` +
        `You can use /cancel to start over.`
      );
    } catch (error) {
      console.error('Error in email submission:', error);
      await ctx.reply('Sorry, something went wrong. Please try again later.');
    }
  }

  private async handleVerificationCode(ctx: Context): Promise<void> {
    try {
      if (!ctx.from || !ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Could not process your message. Please try again.');
        return;
      }

      const code = ctx.message.text.trim();
      const userId = ctx.from.id;
      const session = this.userSessions.get(userId);

      if (!session?.email) {
        await ctx.reply('Session expired. Please use /start to begin again.');
        return;
      }

      // Verify the code
      const user = await UserCrud.verifyEmail(session.email, code);

      if (!user) {
        await ctx.reply(
          'Invalid or expired verification code.\n' +
          'Please try again or use /start to request a new code.'
        );
        return;
      }

      // Clear session
      this.userSessions.delete(userId);

      await ctx.reply(
        `🎉 Account verified successfully!\n\n` +
        `Welcome to Bubblemaps. Your account is now active.\n` +
        `Use /status to check your account details or /help to see available commands.`
      );
    } catch (error) {
      console.error('Error in verification:', error);
      await ctx.reply('Sorry, something went wrong. Please try again later.');
    }
  }

  private async handleCancel(ctx: Context): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Could not identify your Telegram ID. Please try again.');
        return;
      }

      const userId = ctx.from.id;
      this.userSessions.delete(userId);
      await ctx.reply(
        'Current operation cancelled.\n' +
        'Use /start to begin again or /help to see available commands.'
      );
    } catch (error) {
      console.error('Error in cancel command:', error);
      await ctx.reply('Sorry, something went wrong. Please try again later.');
    }
  }

  private async handleStatus(ctx: Context): Promise<void> {
    try {
      if (!ctx.from) {
        await ctx.reply('Could not identify your Telegram ID. Please try again.');
        return;
      }

      const telegramId = ctx.from.id.toString();
      const user = await UserCrud.findByTelegramId(telegramId);
      
      if (!user) {
        await ctx.reply(
          'No account found. Use /start to create your account.'
        );
        return;
      }

      const message = `Account Status:\n\n` +
        `Email: ${user.email}\n` +
        `Status: ${user.status}\n` +
        `Member since: ${new Date(user.createdAt).toLocaleDateString()}`;

      await ctx.reply(message);
    } catch (error) {
      console.error('Error in status command:', error);
      await ctx.reply('Sorry, something went wrong. Please try again later.');
    }
  }

  private async handleAnalyzeCommand(ctx: Context): Promise<void> {
    try {
      const message = ctx.message as Message.TextMessage;
      const args = message.text.split(' ').slice(1);

      if (args.length !== 2) {
        ctx.reply('Usage: /analyze <chain> <address>\nExample: /analyze ethereum 0x1234...');
        return;
      }

      const [chain, address] = args;

      if (!SUPPORTED_CHAINS.includes(chain as any)) {
        ctx.reply(`Unsupported chain. Please use one of: ${SUPPORTED_CHAINS.join(', ')}`);
        return;
      }

      await ctx.reply('Analyzing token... Please wait.');
      
      try {
        const analysis = await TokenAnalysisCrud.getAnalysis(address, chain);
        
        const response = [
          `🔍 Token Analysis for ${analysis.name} (${analysis.symbol})`,
          `Chain: ${analysis.chain}`,
          `Address: ${analysis.address}`,
          `\nDecentralization Score: ${analysis.decentralizationScore.toFixed(2)}`,
          '\nSupply Distribution:',
          `- In CEX: ${analysis.supplyDistribution.percentInCEX.toFixed(2)}%`,
          `- In Contracts: ${analysis.supplyDistribution.percentInContracts.toFixed(2)}%`,
          '\nTop Holders:',
          ...analysis.holders.slice(0, 5).map((holder, i) => 
            `${i + 1}. ${holder.name || holder.address} (${holder.percentage.toFixed(2)}%)`
          ),
          `\nLast Updated: ${analysis.lastAnalysis.toLocaleString()}`
        ].join('\n');

        await ctx.reply(response);
        
        // Generate and send card
        await this.sendAnalysisCard(ctx, analysis);
      } catch (error) {
        this.handleAnalysisError(ctx, error, chain, address);
      }
    } catch (error) {
      console.error('Error in analyze command:', error);
      await ctx.reply('An unexpected error occurred. Please try again later.');
    }
  }

  private async sendAnalysisCard(ctx: Context, analysis: any): Promise<void> {
    try {
      // Initialize card generator with cache
      const cacheConfig: CacheConfig = {
        ttl: 24 * 60 * 60, // 24 hours
        checkPeriod: 60 * 60 // 1 hour
      };
      const cardCache = CardCache.getInstance(cacheConfig);
      const cardGenerator = CardGenerator.getInstance(cardCache);

      // Prepare card data
      const cardData = {
        decentralizationScore: analysis.decentralizationScore,
        supply: {
          percentInCEX: analysis.supplyDistribution.percentInCEX,
          percentInContracts: analysis.supplyDistribution.percentInContracts
        },
        tokenInfo: {
          name: analysis.name,
          symbol: analysis.symbol,
          chain: analysis.chain,
          address: analysis.address
        },
        likes: 0 // Optional, can be added later if we implement likes
      };

      // Generate card
      const card = await cardGenerator.generateCard(cardData);

      // Send card as photo
      await ctx.replyWithPhoto({ source: card.buffer });

      // Update screenshot URL in analysis if needed
      if (!analysis.screenshotUrl) {
        await TokenAnalysisCrud.updateScreenshot(analysis._id, card.cacheKey);
      }
    } catch (error) {
      console.error('Error generating analysis card:', error);
      // Don't throw the error, just log it since this is a non-critical feature
    }
  }

  private async handleLinksCommand(ctx: Context): Promise<void> {
    try {
      const message = ctx.message as Message.TextMessage;
      const args = message.text.split(' ').slice(1);

      if (args.length !== 2) {
        ctx.reply('Usage: /links <chain> <address>\nExample: /links ethereum 0x1234...');
        return;
      }

      const [chain, address] = args;

      if (!SUPPORTED_CHAINS.includes(chain as any)) {
        ctx.reply(`Unsupported chain. Please use one of: ${SUPPORTED_CHAINS.join(', ')}`);
        return;
      }

      await ctx.reply('Fetching holder relationships... Please wait.');
      
      try {
        const analysis = await TokenAnalysisCrud.getAnalysis(address, chain);
        
        if (!analysis.holderLinks || analysis.holderLinks.length === 0) {
          await ctx.reply('No significant holder relationships found for this token.');
          return;
        }

        // Generate text response
        const response = [
          `🔗 Holder Relationships for ${analysis.name} (${analysis.symbol})`,
          `Chain: ${analysis.chain}`,
          `Address: ${analysis.address}`,
          '\nTop Relationships:',
          ...analysis.holderLinks.slice(0, 10).map((link, i) => 
            `${i + 1}. ${link.sourceName || link.sourceAddress} ↔️ ${link.targetName || link.targetAddress}\n` +
            `   Forward: ${link.forwardAmount.toFixed(2)}, Backward: ${link.backwardAmount.toFixed(2)}`
          ),
          `\nLast Updated: ${analysis.lastAnalysis.toLocaleString()}`
        ].join('\n');

        await ctx.reply(response);

        // Generate and send bubble map visualization
        await this.sendBubbleMap(ctx, analysis);
      } catch (error) {
        this.handleAnalysisError(ctx, error, chain, address);
      }
    } catch (error) {
      console.error('Error in links command:', error);
      await ctx.reply('An unexpected error occurred. Please try again later.');
    }
  }

  private async sendBubbleMap(ctx: Context, analysis: any): Promise<void> {
    try {
      // Create a map of addresses to indices for link mapping
      const addressToIndex = new Map<string, number>();
      const nodes = analysis.holders.map((holder: any, index: number) => {
        addressToIndex.set(holder.address.toLowerCase(), index);
        return {
          address: holder.address.toLowerCase(),
          amount: holder.amount,
          is_contract: holder.isContract,
          name: holder.name || `Holder ${index + 1}`,
          percentage: holder.percentage,
          transaction_count: holder.transactionCount,
          transfer_count: holder.transferCount
        };
      });

      // Filter out links where both source and target exist in nodes
      const links = analysis.holderLinks
        .filter((link: any) => {
          const sourceIndex = addressToIndex.get(link.sourceAddress.toLowerCase());
          const targetIndex = addressToIndex.get(link.targetAddress.toLowerCase());
          return sourceIndex !== undefined && targetIndex !== undefined;
        })
        .map((link: any) => ({
          source: addressToIndex.get(link.sourceAddress.toLowerCase())!,
          target: addressToIndex.get(link.targetAddress.toLowerCase())!,
          forward: link.forwardAmount,
          backward: link.backwardAmount
        }));

      // Prepare bubble map data
      const bubbleMapData = {
        version: 4,
        chain: analysis.chain,
        token_address: analysis.address,
        dt_update: analysis.lastAnalysis.toISOString(),
        full_name: analysis.name,
        symbol: analysis.symbol,
        is_X721: false,
        metadata: {
          max_amount: Math.max(...nodes.map((n: any) => n.amount)),
          min_amount: Math.min(...nodes.map((n: any) => n.amount))
        },
        nodes,
        links,
        token_links: []
      };

      // Generate bubble map
      const bubbleMapGenerator = BubbleMapGenerator.getInstance();
      const bubbleMap = await bubbleMapGenerator.generateBubbleMap(bubbleMapData);

      // Send visualization
      await ctx.replyWithPhoto({ source: bubbleMap.buffer });

      // Update screenshot URL in analysis if needed
      if (!analysis.screenshotUrl) {
        await TokenAnalysisCrud.updateScreenshot(analysis._id, bubbleMap.cacheKey);
      }
    } catch (error) {
      console.error('Error generating bubble map:', error);
      await ctx.reply('Could not generate visualization. Text analysis is still available above.');
    }
  }

  private async handleRelatedCommand(ctx: Context): Promise<void> {
    try {
      const message = ctx.message as Message.TextMessage;
      const args = message.text.split(' ').slice(1);

      if (args.length !== 2) {
        ctx.reply('Usage: /related <chain> <address>\nExample: /related ethereum 0x1234...');
        return;
      }

      const [chain, address] = args;

      if (!SUPPORTED_CHAINS.includes(chain as any)) {
        ctx.reply(`Unsupported chain. Please use one of: ${SUPPORTED_CHAINS.join(', ')}`);
        return;
      }

      await ctx.reply('Fetching related tokens... Please wait.');
      
      try {
        const analysis = await TokenAnalysisCrud.getAnalysis(address, chain);
        
        if (!analysis.relatedTokens || analysis.relatedTokens.length === 0) {
          await ctx.reply('No related tokens found.');
          return;
        }

        const response = [
          `🔄 Related Tokens for ${analysis.name} (${analysis.symbol})`,
          `Chain: ${analysis.chain}`,
          `Address: ${analysis.address}`,
          '\nRelated Tokens:',
          ...analysis.relatedTokens.map((token, i) => 
            `${i + 1}. ${token.name} (${token.symbol})\n` +
            `   Address: ${token.address}`
          ),
          `\nLast Updated: ${analysis.lastAnalysis.toLocaleString()}`
        ].join('\n');

        await ctx.reply(response);
      } catch (error) {
        this.handleAnalysisError(ctx, error, chain, address);
      }
    } catch (error) {
      console.error('Error in related command:', error);
      await ctx.reply('An unexpected error occurred. Please try again later.');
    }
  }

  private handleAnalysisError(ctx: Context, error: any, chain: string, address: string): void {
    if (error instanceof ApiError) {
      if (error.statusCode === 401) {
        ctx.reply('⚠️ Authentication Error: This feature requires a verified Bubblemaps account.\n\nPlease use /start to create and verify your account first.');
      } else if (error.statusCode === 400 && error.message.includes('Data not available')) {
        ctx.reply(
          '⚠️ Token Analysis Not Available\n\n' +
          'This token has not been analyzed by Bubblemaps yet. This could mean:\n' +
          '1. The token is new or has low trading volume\n' +
          '2. The token needs to be added to Bubblemaps database\n' +
          '3. The token address might be incorrect\n\n' +
          'You can verify token availability by checking:\n' +
          `https://app.bubblemaps.io/${chain}/${address}`
        );
      } else {
        ctx.reply(`❌ Analysis failed: ${error.message}`);
      }
    } else {
      console.error('Unexpected error:', error);
      ctx.reply('An unexpected error occurred. Please try again later.');
    }
  }

  private async handleRecentCommand(ctx: Context): Promise<void> {
    try {
      const analyses = await TokenAnalysisCrud.getRecentAnalyses(5);
      
      if (analyses.length === 0) {
        ctx.reply('No recent analyses found.');
        return;
      }

      const response = [
        '📊 Recent Token Analyses:',
        '',
        ...analyses.map(analysis => 
          `${analysis.name} (${analysis.symbol})\n` +
          `Chain: ${analysis.chain}\n` +
          `Score: ${analysis.decentralizationScore.toFixed(2)}\n` +
          `Updated: ${analysis.lastAnalysis.toLocaleString()}\n`
        )
      ].join('\n');

      ctx.reply(response);
    } catch (error) {
      console.error('Error in recent command:', error);
      ctx.reply('Error fetching recent analyses. Please try again later.');
    }
  }

  private async handleUpdateCommand(ctx: Context): Promise<void> {
    try {
      const message = ctx.message as Message.TextMessage;
      const args = message.text.split(' ').slice(1);

      if (args.length !== 2) {
        ctx.reply('Usage: /update <chain> <address>\nExample: /update ethereum 0x1234...');
        return;
      }

      const [chain, address] = args;

      if (!SUPPORTED_CHAINS.includes(chain as any)) {
        ctx.reply(`Unsupported chain. Please use one of: ${SUPPORTED_CHAINS.join(', ')}`);
        return;
      }

      await ctx.reply('Forcing update... Please wait.');
      
      const analysis = await TokenAnalysisCrud.forceUpdate(address, chain);
      
      const response = [
        `✅ Updated analysis for ${analysis.name} (${analysis.symbol})`,
        `Chain: ${analysis.chain}`,
        `Address: ${analysis.address}`,
        `\nNew Decentralization Score: ${analysis.decentralizationScore.toFixed(2)}`,
        `Last Updated: ${analysis.lastAnalysis.toLocaleString()}`
      ].join('\n');

      await ctx.reply(response);
    } catch (error) {
      console.error('Error in update command:', error);
      if (error instanceof ApiError && error.message.includes('not found')) {
        ctx.reply('Token analysis not found. Please use /analyze first.');
      } else {
        ctx.reply('Error updating analysis. Please try again later.');
      }
    }
  }

  private async handlePriceCommand(ctx: Context): Promise<void> {
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Could not process your message. Please try again.');
        return;
      }

      const parts = ctx.message.text.split(' ');
      if (parts.length !== 2) {
        await ctx.reply('Please provide a token address.\nUsage: /price <address>');
        return;
      }

      const address = parts[1];
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        await ctx.reply('Invalid token address format. Please provide a valid Ethereum address.');
        return;
      }

      try {
        const marketData = await this.marketDataService.getTokenMarketData(address);
        if (!marketData) {
          await ctx.reply('Could not fetch price data for this token. The token might not be listed on DEXScreener.');
          return;
        }

        const formatNumber = (num: number) => {
          if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
          if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
          if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
          return `$${num.toFixed(2)}`;
        };

        const priceChange24h = marketData.priceChange24h >= 0 ? `+${marketData.priceChange24h.toFixed(2)}` : marketData.priceChange24h.toFixed(2);
        const emoji = marketData.priceChange24h >= 0 ? '📈' : '📉';

        // Escape special characters for MarkdownV2
        const escapeMarkdown = (text: string) => {
          return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
        };

        const message = [
          `🪙 *${escapeMarkdown(marketData.name)} \\(${escapeMarkdown(marketData.symbol)}\\)*`,
          `💰 Price: ${escapeMarkdown(formatNumber(marketData.price))}`,
          `${emoji} 24h Change: ${escapeMarkdown(priceChange24h)}%`,
          `💎 Market Cap: ${escapeMarkdown(formatNumber(marketData.marketCap))}`,
          `📊 24h Volume: ${escapeMarkdown(formatNumber(marketData.volume24h))}`,
          `💧 Liquidity: ${escapeMarkdown(formatNumber(marketData.liquidity))}`,
          `🔄 24h Transactions:`,
          `   • Buys: ${escapeMarkdown(marketData.transactions24h.buys.toString())}`,
          `   • Sells: ${escapeMarkdown(marketData.transactions24h.sells.toString())}`,
          `   • Total: ${escapeMarkdown(marketData.transactions24h.total.toString())}`,
          `⛓ Chain: ${escapeMarkdown(marketData.chain)}`,
          `🏦 DEX: ${escapeMarkdown(marketData.dex)}`,
          `🕒 Last Updated: ${escapeMarkdown(marketData.lastUpdated.toLocaleString())}`
        ].join('\n');

        await ctx.replyWithMarkdownV2(message);
      } catch (error) {
        if (error instanceof Error) {
          await ctx.reply(`❌ ${error.message}`);
        } else {
          await ctx.reply('Sorry, something went wrong while fetching the price data.');
        }
      }
    } catch (error) {
      console.error('Error in price command:', error);
      await ctx.reply('An unexpected error occurred. Please try again later.');
    }
  }

  private async handleMarketCommand(ctx: Context): Promise<void> {
    try {
      if (!ctx.message || !('text' in ctx.message)) {
        await ctx.reply('Could not process your message. Please try again.');
        return;
      }

      const parts = ctx.message.text.split(' ');
      if (parts.length !== 2) {
        await ctx.reply('Please provide a token address.\nUsage: /market <address>');
        return;
      }

      const address = parts[1];
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        await ctx.reply('Invalid token address format. Please provide a valid Ethereum address.');
        return;
      }

      try {
        const marketData = await this.marketDataService.getTokenMarketData(address);

        if (!marketData) {
          await ctx.reply('Could not fetch market data for this token. The token might not be listed on DEXScreener.');
          return;
        }

        const formatNumber = (num: number) => {
          if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
          if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
          if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
          return `$${num.toFixed(2)}`;
        };

        const priceChange24h = marketData.priceChange24h >= 0 ? `+${marketData.priceChange24h.toFixed(2)}` : marketData.priceChange24h.toFixed(2);
        
        const message = [
          `🪙 *${marketData.name} (${marketData.symbol})*`,
          `💰 Price: $${marketData.price.toFixed(8)}`,
          `📈 24h Change: ${priceChange24h}%`,
          `💎 Market Cap: ${formatNumber(marketData.marketCap)}`,
          `📊 24h Volume: ${formatNumber(marketData.volume24h)}`,
          `💧 Liquidity: ${formatNumber(marketData.liquidity)}`,
          `🔄 24h Transactions:`,
          `   • Buys: ${marketData.transactions24h.buys}`,
          `   • Sells: ${marketData.transactions24h.sells}`,
          `   • Total: ${marketData.transactions24h.total}`,
          `⛓ Chain: ${marketData.chain}`,
          `🏦 DEX: ${marketData.dex}`,
          `🕒 Last Updated: ${marketData.lastUpdated.toLocaleString()}`
        ].join('\n');

        await ctx.replyWithMarkdownV2(message.replace(/[.!]/g, '\\$&'));
      } catch (error) {
        console.error('Error in market command:', error);
        await ctx.reply('An error occurred while fetching market data. Please try again later.');
      }
    } catch (error) {
      console.error('Error in market command:', error);
      await ctx.reply('An error occurred while processing your request. Please try again later.');
    }
  }
}

// Update the initialization function
export function initializeTelegramBot(bot: Telegraf<Context>): void {
  console.log('Initializing Telegram bot service...');
  TelegramService.getInstance(bot);
  console.log('Telegram bot service initialized');
}
