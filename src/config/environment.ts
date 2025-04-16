import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const environment = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'bubblemaps_db',
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default_jwt_secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    proxyUrl: process.env.TELEGRAM_PROXY_URL || '',
    timeout: parseInt(process.env.TELEGRAM_TIMEOUT || '60000', 10),
    retryAttempts: parseInt(process.env.TELEGRAM_RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.TELEGRAM_RETRY_DELAY || '5000', 10),
    handlerTimeout: parseInt(process.env.TELEGRAM_HANDLER_TIMEOUT || '90000', 10),
  },
  
  email: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
  },

  bubblemaps: {
    apiKey: process.env.BUBBLEMAPS_API_KEY || '',
    apiUrl: process.env.BUBBLEMAPS_API_URL || 'https://api.bubblemaps.io/v1',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
} as const;

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'TELEGRAM_BOT_TOKEN',
  'EMAIL_USER',
  'EMAIL_PASSWORD',
  'BUBBLEMAPS_API_KEY',
] as const;

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
