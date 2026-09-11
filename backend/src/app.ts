import cors from 'cors';
import express, { Request, Response } from 'express';
import morgan from 'morgan';
import { z } from 'zod';
import { config } from './config';
import { UrlService } from './services/urlService';

const createSchema = z.object({ originalUrl: z.string().url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Only HTTP and HTTPS URLs are supported') });
const codeSchema = z.string().regex(/^[A-Za-z0-9]{6}$/, 'Short code must contain 6 latin letters or digits');

export function createApp(service: UrlService): express.Application {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  app.post('/api/shorten', async (request: Request, response: Response) => {
    const parsed = createSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: 'Введите корректный URL с протоколом http:// или https://' });
    try {
      const record = await service.create(parsed.data.originalUrl);
      return response.status(201).json({ shortCode: record.shortCode, shortUrl: `${config.publicUrl}/${record.shortCode}` });
    } catch (error) {
      console.error('POST /api/shorten failed:', error);
      if (error instanceof Error && error.message === 'Original URL cannot point to the short link service') {
        return response.status(400).json({ error: 'Нельзя создавать ссылку на этот сервис' });
      }
      const isDatabaseUnavailable = typeof error === 'object' && error !== null && 'code' in error && error.code === 'ECONNREFUSED';
      return response.status(500).json({ error: isDatabaseUnavailable ? 'PostgreSQL недоступен на localhost:5432. Запустите PostgreSQL или включите STORAGE_MODE=memory для локальной разработки.' : 'Не удалось создать короткую ссылку.' });
    }
  });

  app.get('/api/stats/:shortCode', async (request: Request<{ shortCode: string }>, response: Response) => {
    const shortCode = String(request.params.shortCode);
    if (!codeSchema.safeParse(shortCode).success) return response.status(404).json({ error: 'Короткая ссылка не найдена' });
    try {
      const record = await service.getCachedOrStored(shortCode);
      if (!record) return response.status(404).json({ error: 'Короткая ссылка не найдена' });
      return response.json({ originalUrl: record.originalUrl, shortCode: record.shortCode, clicks: record.clicks, createdAt: record.createdAt });
    } catch { return response.status(500).json({ error: 'Не удалось получить статистику' }); }
  });

  app.get('/:shortCode', async (request: Request<{ shortCode: string }>, response: Response) => {
    const shortCode = String(request.params.shortCode);
    if (!codeSchema.safeParse(shortCode).success) return response.status(404).json({ error: 'Короткая ссылка не найдена' });
    try {
      const record = await service.getCachedOrStored(shortCode);
      if (!record) return response.status(404).json({ error: 'Короткая ссылка не найдена' });
      await service.incrementClicks(record.shortCode);
      return response.redirect(record.originalUrl);
    } catch { return response.status(500).json({ error: 'Не удалось выполнить перенаправление' }); }
  });

  return app;
}
