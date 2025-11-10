import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { logger, morganStream } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { WsChargeService } from './services/wscharge.service';
import { cabinetMonitorService } from './services/cabinetMonitor.service';
import { wsChargeSyncService } from './services/wschargeSyncService';
import routes from './routes';

// Validar variables de entorno requeridas
const requiredEnvVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_ANON_KEY'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Variable de entorno requerida faltante: ${envVar}`);
    process.exit(1);
  }
}

const app: express.Express = express();
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
logger.info('Servicio WsCharge inicializado');

// Make wsChargeService accessible globally
(global as any).wsChargeService = wsChargeService;

// Initialize Cabinet Monitor Service (cron job for offline detection)
// Initialize WsCharge Sync Service (syncs cabinet status from WsCharge API)
// Only start in non-serverless environments
if (!process.env.VERCEL) {
  cabinetMonitorService.start();
  logger.info('Servicio de monitoreo de gabinetes iniciado');

  wsChargeSyncService.start();
  logger.info('Servicio de sincronización WsCharge iniciado');
}

// ==================== START SERVER ====================

// Only start server if not in serverless environment (Vercel)
// Railway, Render, and local development should start the server
const isServerless = process.env.VERCEL === '1';

if (!isServerless) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔌 WsCharge WebSocket available at ws://0.0.0.0:${PORT}/wscharge`);
    logger.info(`📋 API available at http://0.0.0.0:${PORT}/api/${API_VERSION}`);

    // Log Railway-specific info if available
    if (process.env.RAILWAY_ENVIRONMENT) {
      logger.info(`🚂 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT}`);
      if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        logger.info(`🌐 Public URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
      }
    }
  });
} else {
  logger.warn('⚠️  Running in serverless mode (Vercel) - WebSocket features disabled');
}

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', () => {
  logger.info('Señal SIGTERM recibida: cerrando servidor HTTP');
  cabinetMonitorService.stop();
  wsChargeSyncService.stop();
  httpServer.close(() => {
    logger.info('Servidor HTTP cerrado');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('Señal SIGINT recibida: cerrando servidor HTTP');
  cabinetMonitorService.stop();
  wsChargeSyncService.stop();
  httpServer.close(() => {
    logger.info('Servidor HTTP cerrado');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Rechazo no manejado en:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Excepción no capturada:', { error });
  process.exit(1);
});

export default app;
