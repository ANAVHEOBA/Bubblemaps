import express from 'express';
import cors from 'cors';
import { authRouter } from './modules/auth/auth.router';
import { tokenRouter } from './modules/token-analysis/token.router';
import marketDataRouter from './modules/market-data/market-data.router';
import { errorMiddleware } from './middleware/error.middleware';
import { environment } from './config/environment';

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/tokens', tokenRouter);
app.use('/api/market-data', marketDataRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: environment.nodeEnv });
});

// Error handling
app.use(errorMiddleware);

export default app;
