import { Pool } from 'pg';
import Redis from 'ioredis';
import { createApp } from './app';
import { config } from './config';
import { UrlRepository } from './repositories/urlRepository';
import { MemoryRepository } from './repositories/memoryRepository';
import { UrlService } from './services/urlService';

const pool = new Pool({ connectionString: config.databaseUrl });
const redis = config.redisEnabled ? new Redis(config.redisUrl) : null;
if (!redis) console.log('Redis cache disabled. Set REDIS_ENABLED=true to enable it.');
redis?.on('error', (error: Error) => console.warn('Redis connection unavailable:', error.message || 'connection failed'));
pool.on('error', (error: Error) => console.warn('PostgreSQL pool error:', error.message));
const repository = config.storageMode === 'memory' ? new MemoryRepository() : new UrlRepository(pool);
if (config.storageMode === 'memory') console.warn('Using in-memory storage. Set STORAGE_MODE=postgres for PostgreSQL persistence.');
const service = new UrlService(repository, redis, config.publicUrl);
const app = createApp(service);

const server = app.listen(config.port, () => console.log(`ShortLink API listening on port ${config.port}`));
server.on('error', (error: NodeJS.ErrnoException) => {
	if (error.code === 'EADDRINUSE') {
		console.error(`Port ${config.port} is already in use. Stop the existing API or start with another PORT.`);
	} else {
		console.error('Failed to start the API:', error);
	}
	process.exitCode = 1;
});
