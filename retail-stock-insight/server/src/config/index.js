import 'dotenv/config';
import { fileURLToPath } from 'url';

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },
  currencyCode: process.env.CURRENCY_CODE || '',
  dataDir: fileURLToPath(new URL('../../data/', import.meta.url)),
  nodeEnv: process.env.NODE_ENV || 'development',
};
