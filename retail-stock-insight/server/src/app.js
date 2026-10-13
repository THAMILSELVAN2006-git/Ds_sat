import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { loadAllData } from './services/csvLoader.js';
import apiRouter from './routes/api.js';
import { errorHandler, notFoundHandler } from './middleware/index.js';

const app = express();

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
}));
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── ROUTES ────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── ERROR HANDLERS ────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── STARTUP ───────────────────────────────────────────────────────────────
async function start() {
  try {
    await loadAllData();
    if (process.env.NODE_ENV !== 'test') {
      app.listen(config.port, () => {
        console.log(`\n✅ Retail Stock Insight API running at http://localhost:${config.port}`);
        console.log(`   Currency: ${config.currencyCode || '(not specified)'}`);
        console.log(`   Environment: ${config.nodeEnv}\n`);
      });
    }
  } catch (err) {
    console.error('❌ Fatal startup error:', err.message);
    process.exit(1);
  }
}

start();

export default app;
