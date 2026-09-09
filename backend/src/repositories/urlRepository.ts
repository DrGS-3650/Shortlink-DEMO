import { Pool } from 'pg';
import { UrlRecord } from '../types';

export interface UrlStore {
  create(shortCode: string, originalUrl: string): Promise<UrlRecord>;
  findByCode(shortCode: string): Promise<UrlRecord | null>;
  incrementClicks(shortCode: string): Promise<void>;
}

export class UrlRepository implements UrlStore {
  constructor(private readonly pool: Pool) {}

  async create(shortCode: string, originalUrl: string): Promise<UrlRecord> {
    const result = await this.pool.query(
      `INSERT INTO urls (short_code, original_url) VALUES ($1, $2)
       RETURNING id, short_code AS "shortCode", original_url AS "originalUrl", clicks, created_at AS "createdAt"`,
      [shortCode, originalUrl],
    );
    return result.rows[0] as UrlRecord;
  }

  async findByCode(shortCode: string): Promise<UrlRecord | null> {
    const result = await this.pool.query(
      `SELECT id, short_code AS "shortCode", original_url AS "originalUrl", clicks, created_at AS "createdAt"
       FROM urls WHERE short_code = $1`,
      [shortCode],
    );
    return (result.rows[0] as UrlRecord | undefined) ?? null;
  }

  async incrementClicks(shortCode: string): Promise<void> {
    await this.pool.query('UPDATE urls SET clicks = clicks + 1 WHERE short_code = $1', [shortCode]);
  }
}
