import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { logger, morganStream } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { WsChargeService } from './services/wscharge.service';
import routes from './routes';

// Validar variables de entorno requeridas
const requiredEnvVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const API_VERSION = process.env.API_VERSION || 'v1';

// ==================== MIDDLEWARE ====================

// Security
app.use(helmet());

// CORS
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
  credentials: true,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', { stream: morganStream }));

// ==================== ROUTES ====================

app.get('/', (req, res) => {
  res.json({
    name: 'Power Bank API',
    version: API_VERSION,
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use(`/api/${API_VERSION}`, routes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// ==================== SERVER SETUP ====================

const httpServer = createServer(app);

// Initialize WsCharge Service (Socket.io for cabinet communication)
const wsChargeService = new WsChargeService(httpServer);
logger.info('WsCharge Service initialized');

// Make wsChargeService accessible globally
(global as any).wsChargeService = wsChargeService;

// ==================== START SERVER ====================

// Only start server if not in serverless environment (Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  httpServer.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔌 WsCharge WebSocket available at ws://localhost:${PORT}/wscharge`);
    logger.info(`📋 API available at http://localhost:${PORT}/api/${API_VERSION}`);
  });
}

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error });
  process.exit(1);
});

export default app;
