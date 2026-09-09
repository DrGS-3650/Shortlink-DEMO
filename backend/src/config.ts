import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://shortlink:shortlink@localhost:5432/shortlink',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  redisEnabled: process.env.REDIS_ENABLED === 'true',
  storageMode: process.env.STORAGE_MODE ?? 'memory',
  publicUrl: process.env.PUBLIC_URL ?? 'http://go.linkloom.localhost:3000',
};
