import { UrlStore } from './urlRepository';
import { UrlRecord } from '../types';

export class MemoryRepository implements UrlStore {
  private readonly records = new Map<string, UrlRecord>();
  private nextId = 1;

  async create(shortCode: string, originalUrl: string): Promise<UrlRecord> {
    if (this.records.has(shortCode)) {
      const error = new Error('Short code already exists') as Error & { code: string };
      error.code = '23505';
      throw error;
    }
    const record: UrlRecord = { id: this.nextId++, shortCode, originalUrl, clicks: 0, createdAt: new Date() };
    this.records.set(shortCode, record);
    return record;
  }

  async findByCode(shortCode: string): Promise<UrlRecord | null> {
    return this.records.get(shortCode) ?? null;
  }

  async incrementClicks(shortCode: string): Promise<void> {
    const record = this.records.get(shortCode);
    if (record) record.clicks += 1;
  }
}