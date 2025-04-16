import app from './app';
import { environment } from './config/environment';
import { connectDatabase } from './config/database';
import { bot, initializeBot, removeLock } from './config/telegram';
import { initializeTelegramBot } from './services/telegram.service';

const MAX_RETRIES = environment.telegram.retryAttempts;
const RETRY_DELAY = environment.telegram.retryDelay;
const STARTUP_TIMEOUT = environment.telegram.timeout;

let isLaunched = false;

async function startTelegramBot(retryCount = 0): Promise<void> {
  try {
    console.log(`Attempting to start Telegram bot (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
    
    // Initialize bot and test connection
    await initializeBot();
    
    // Initialize bot handlers
    initializeTelegramBot(bot);

    // If we're already receiving updates, consider the bot launched
    bot.use((ctx, next) => {
      isLaunched = true;
      return next();
    });

    // Start the bot with timeout
    await Promise.race([
      (async () => {
        try {
          await bot.launch();
          isLaunched = true;
          console.log('Telegram bot started successfully');
        } catch (error) {
          if (!isLaunched) {
            throw error;
          } else {
            console.log('Bot is already running and processing updates');
          }
        }
      })(),
      new Promise((_, reject) => {
        const timeoutId = setTimeout(() => {
          if (!isLaunched) {
            removeLock();
            reject(new Error('Telegram bot startup timeout'));
          }
        }, STARTUP_TIMEOUT);

        // Clear timeout if bot is launched
        const interval = setInterval(() => {
          if (isLaunched) {
            clearTimeout(timeoutId);
            clearInterval(interval);
          }
        }, 100);
      })
    ]);

  } catch (error) {
    console.error('Failed to start Telegram bot:', error);
    
    if (!isLaunched) {
      removeLock();
      
      if (retryCount < MAX_RETRIES - 1) {
        console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return startTelegramBot(retryCount + 1);
      }
      throw error;
    } else {
      console.log('Bot is already running, continuing with current instance');
    }
  }
}

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    console.log('Successfully connected to MongoDB.');

    // Start Express server first
    const server = app.listen(environment.port, () => {
      console.log(`Server is running on port ${environment.port}`);
      console.log(`Environment: ${environment.nodeEnv}`);
    });

    // Then try to start Telegram bot
    try {
      await startTelegramBot();
    } catch (error) {
      if (!isLaunched) {
        console.error('Failed to start Telegram bot after all retries.');
        console.error('Server will continue running without Telegram bot functionality.');
      }
    }

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down gracefully...');
      
      // Stop accepting new connections
      server.close(() => {
        console.log('HTTP server closed');
      });

      // Stop Telegram bot
      try {
        if (isLaunched) {
          await bot.stop('SIGTERM');
          console.log('Telegram bot stopped');
        }
      } catch (error) {
        console.error('Error stopping Telegram bot:', error);
      }

      // Exit after a timeout to ensure cleanup
      setTimeout(() => {
        console.log('Forcing exit...');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Ensure unhandled rejections don't crash the server
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});

startServer();
