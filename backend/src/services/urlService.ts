import { randomBytes } from 'node:crypto';
import { Redis } from 'ioredis';
import { UrlStore } from '../repositories/urlRepository';
import { CachedUrl, UrlRecord } from '../types';

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CACHE_TTL_SECONDS = 60 * 60;

export class UrlService {
  constructor(private readonly repository: UrlStore, private readonly redis: Redis | null, private readonly publicUrl?: string) {}

  async create(originalUrl: string): Promise<UrlRecord> {
    if (this.publicUrl && new URL(originalUrl).origin === new URL(this.publicUrl).origin) {
      throw new Error('Original URL cannot point to the short link service');
    }
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const shortCode = this.generateCode();
      try {
        const record = await this.repository.create(shortCode, originalUrl);
        await this.setCache(record);
        return record;
      } catch (error) {
        if (!this.isUniqueViolation(error) || attempt === 4) throw error;
      }
    }
    throw new Error('Could not generate a unique short code');
  }

  async getCachedOrStored(shortCode: string): Promise<UrlRecord | null> {
    if (!this.redis) return this.repository.findByCode(shortCode);
    let cached: string | null = null;
    try {
      cached = await this.redis.get(this.cacheKey(shortCode));
    } catch (error) {
      console.warn('Redis unavailable; reading URL from PostgreSQL', this.getErrorMessage(error));
    }
    if (cached) {
      const value = JSON.parse(cached) as CachedUrl;
      return { id: 0, shortCode: value.shortCode, originalUrl: value.originalUrl, clicks: value.clicks, createdAt: new Date(value.createdAt) };
    }
    const record = await this.repository.findByCode(shortCode);
    if (record) {
      await this.setCache(record);
    }
    return record;
  }

  async incrementClicks(shortCode: string): Promise<void> {
    if (this.redis) {
      try {
        const cached = await this.redis.get(this.cacheKey(shortCode));
        if (cached) {
          const value = JSON.parse(cached) as CachedUrl;
          value.clicks += 1;
          await this.redis.set(this.cacheKey(shortCode), JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
          return;
        }
      } catch (error) {
        console.warn('Redis unavailable; incrementing clicks in PostgreSQL', this.getErrorMessage(error));
      }
    }
    await this.repository.incrementClicks(shortCode);
  }

  private generateCode(): string {
    const bytes = randomBytes(6);
    return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  }

  private cacheKey(shortCode: string): string { return `url:${shortCode}`; }
  private async setCache(record: UrlRecord): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(this.cacheKey(record.shortCode), JSON.stringify({ shortCode: record.shortCode, originalUrl: record.originalUrl, clicks: record.clicks, createdAt: record.createdAt.toISOString() }), 'EX', CACHE_TTL_SECONDS);
    } catch (error) {
      console.warn('Redis unavailable; continuing without cache', this.getErrorMessage(error));
    }
  }

  private getErrorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
  private isUniqueViolation(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'; }
}
