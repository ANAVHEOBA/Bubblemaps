import { Telegraf, session } from 'telegraf';
import { environment } from './environment';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as fs from 'fs';
import * as path from 'path';

const LOCK_FILE = path.join(process.cwd(), 'telegram-bot.lock');

// Check for existing bot instance
function checkLock(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8');
      try {
        // Check if process is still running
        process.kill(parseInt(pid), 0);
        // If the process exists but it's our own process, it's okay
        if (parseInt(pid) === process.pid) {
          return true;
        }
        console.error(`Bot is already running with PID ${pid}`);
        return false;
      } catch (e) {
        // Process not running, safe to delete lock file
        fs.unlinkSync(LOCK_FILE);
      }
    }
    // Create lock file with current PID
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    return true;
  } catch (error) {
    console.error('Error checking lock file:', error);
    return false;
  }
}

// Remove lock file on exit
export function removeLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf8');
      // Only remove the lock file if it belongs to our process
      if (parseInt(pid) === process.pid) {
        fs.unlinkSync(LOCK_FILE);
        console.log('Lock file removed');
      }
    }
  } catch (error) {
    console.error('Error removing lock file:', error);
  }
}

// Bot configuration
export const telegramConfig = {
  commands: [
    { command: 'start', description: 'Start registration or check account' },
    { command: 'help', description: 'Show available commands' },
    { command: 'status', description: 'Check your account status' },
    { command: 'cancel', description: 'Cancel current operation' }
  ],
  messages: {
    welcome: 'Welcome to Bubblemaps! 🌟',
    error: 'Sorry, something went wrong. Please try again later.',
    notRegistered: 'No account found. Use /start to create your account.',
    emailPrompt: 'Please enter your email address to create an account.',
    invalidEmail: 'Please enter a valid email address.',
    emailTaken: 'This email is already registered. Please use a different email.',
    verificationSent: 'A verification code has been sent to your email.',
    verificationInvalid: 'Invalid or expired verification code. Please try again.',
    verificationSuccess: '🎉 Account verified successfully!',
    sessionExpired: 'Your session has expired. Please use /start to begin again.',
    cancelled: 'Operation cancelled. Use /start to begin again.'
  }
} as const;

// Validate bot token
if (!environment.telegram.botToken) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
}

// Bot options
const botOptions: any = {
  handlerTimeout: environment.telegram.timeout || 90_000, // Use configured timeout
  telegram: {
    apiRoot: 'https://api.telegram.org', // Explicitly set API root
  }
};

// Add proxy if configured
if (environment.telegram.proxyUrl) {
  console.log('Using proxy for Telegram bot:', environment.telegram.proxyUrl);
  botOptions.telegram.agent = new HttpsProxyAgent(environment.telegram.proxyUrl);
}

console.log('Creating Telegram bot instance...');
export const bot = new Telegraf(environment.telegram.botToken, botOptions);

// Add basic error handling
bot.catch((err: any) => {
  console.error('Telegram bot error:', err);
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
    console.error('Network error occurred. Check your internet connection or proxy settings.');
  }
  if (err.response?.error_code === 401) {
    console.error('Authentication failed. Check your bot token.');
  }
  if (err.response?.error_code === 429) {
    console.error('Rate limit exceeded. Please wait before retrying.');
  }
});

// Debug logging middleware with timing
bot.use(async (ctx, next) => {
  const start = Date.now();
  console.log('Processing update:', ctx.update?.update_id);
  try {
    await next();
    const ms = Date.now() - start;
    console.log('Response time:', ms, 'ms');
  } catch (error) {
    console.error('Error in bot middleware:', error);
    const ms = Date.now() - start;
    console.log('Error response time:', ms, 'ms');
    throw error; // Re-throw to be caught by error handler
  }
});

// Session handling
bot.use(session());

// Set bot commands with retry
const setCommands = async (retries = environment.telegram.retryAttempts, delay = environment.telegram.retryDelay): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Setting up bot commands (attempt ${i + 1}/${retries})...`);
      await bot.telegram.setMyCommands(telegramConfig.commands);
      console.log('Bot commands set successfully');
      return;
    } catch (error) {
      console.error(`Failed to set bot commands (attempt ${i + 1}/${retries}):`, error);
      if (i < retries - 1) {
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('Failed to set bot commands after all retries');
};

// Initialize bot
export async function initializeBot(): Promise<void> {
  if (!checkLock()) {
    throw new Error('Another bot instance is already running');
  }

  try {
    // Test the connection
    const botInfo = await bot.telegram.getMe();
    console.log('Bot connection test successful:', botInfo.username);
    
    // Set commands
    await setCommands();
  } catch (error) {
    removeLock();
    console.error('Error during bot initialization:', error);
    throw error;
  }
}

// Enable graceful stop
process.once('SIGINT', () => {
  console.log('Stopping bot (SIGINT)...');
  removeLock();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('Stopping bot (SIGTERM)...');
  removeLock();
  bot.stop('SIGTERM');
});
