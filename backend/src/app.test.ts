import request from 'supertest';
import { createApp } from './app';
import { MemoryRepository } from './repositories/memoryRepository';
import { UrlService } from './services/urlService';

describe('API validation', () => {
  const service = { create: jest.fn(), getCachedOrStored: jest.fn(), incrementClicks: jest.fn() } as unknown as UrlService;
  const app = createApp(service);

  it('rejects non-http URLs', async () => {
    const response = await request(app).post('/api/shorten').send({ originalUrl: 'javascript:alert(1)' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for unknown code', async () => {
    (service.getCachedOrStored as jest.Mock).mockResolvedValue(null);
    const response = await request(app).get('/api/stats/abc123');
    expect(response.status).toBe(404);
  });

  it('creates a short link', async () => {
    (service.create as jest.Mock).mockResolvedValue({ shortCode: 'abc123' });
    const response = await request(app).post('/api/shorten').send({ originalUrl: 'https://example.com/article' });
    expect(response.status).toBe(201);
    expect(response.body.shortCode).toBe('abc123');
  });

  it('redirects and increments clicks', async () => {
    (service.getCachedOrStored as jest.Mock).mockResolvedValue({ shortCode: 'abc123', originalUrl: 'https://example.com/article' });
    const response = await request(app).get('/abc123');
    expect(response.status).toBe(302);
    expect(service.incrementClicks).toHaveBeenCalledWith('abc123');
  });
});

describe('URL storage behavior', () => {
  it('creates a link, redirects, and records a click with the real service', async () => {
    const repository = new MemoryRepository();
    const service = new UrlService(repository, null, 'http://go.linkloom.localhost:3000');
    const app = createApp(service);

    const createResponse = await request(app)
      .post('/api/shorten')
      .send({ originalUrl: 'https://example.com/integration' });
    const shortCode = createResponse.body.shortCode as string;
    const redirectResponse = await request(app).get(`/${shortCode}`);
    const statsResponse = await request(app).get(`/api/stats/${shortCode}`);

    expect(createResponse.status).toBe(201);
    expect(shortCode).toMatch(/^[A-Za-z0-9]{6}$/);
    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.headers.location).toBe('https://example.com/integration');
    expect(statsResponse.status).toBe(200);
    expect(statsResponse.body).toMatchObject({
      shortCode,
      originalUrl: 'https://example.com/integration',
      clicks: 1,
    });
  });

  it('rejects duplicate short codes in memory storage', async () => {
    const repository = new MemoryRepository();
    await repository.create('abc123', 'https://example.com/first');
    await expect(repository.create('abc123', 'https://example.com/second')).rejects.toMatchObject({ code: '23505' });
  });

  it('rejects links pointing to the short link service', async () => {
    const repository = new MemoryRepository();
    const service = new UrlService(repository, null, 'http://go.linkloom.localhost:3000');
    await expect(service.create('http://go.linkloom.localhost:3000/abc123')).rejects.toThrow('short link service');
  });

  it('keeps click increments in Redis and returns them from cached stats', async () => {
    const repository = new MemoryRepository();
    const findByCode = jest.spyOn(repository, 'findByCode');
    const cache = new Map<string, string>();
    const redis = {
      get: jest.fn(async (key: string) => cache.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => { cache.set(key, value); return 'OK'; }),
      eval: jest.fn(async (_script: string, _keyCount: number, key: string, _ttl: number) => {
        const value = JSON.parse(cache.get(key) as string) as { clicks: number };
        value.clicks += 1;
        cache.set(key, JSON.stringify(value));
        return value.clicks;
      }),
    } as never;
    const service = new UrlService(repository, redis);
    const created = await service.create('https://example.com/article');
    await service.incrementClicks(created.shortCode);
    const cached = await service.getCachedOrStored(created.shortCode);
    expect(cached).toMatchObject({ shortCode: created.shortCode, clicks: 1, originalUrl: created.originalUrl });
    expect(findByCode).not.toHaveBeenCalled();
  });

  it('returns identical stats for two consecutive cached requests', async () => {
    const repository = new MemoryRepository();
    const findByCode = jest.spyOn(repository, 'findByCode');
    const cache = new Map<string, string>();
    const redis = {
      get: jest.fn(async (key: string) => cache.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => { cache.set(key, value); return 'OK'; }),
      eval: jest.fn(async (_script: string, _keyCount: number, key: string, _ttl: number) => {
        const value = JSON.parse(cache.get(key) as string) as { clicks: number };
        value.clicks += 1;
        cache.set(key, JSON.stringify(value));
        return value.clicks;
      }),
    } as never;
    const service = new UrlService(repository, redis);
    const created = await service.create('https://example.com/article');
    const app = createApp(service);

    const firstResponse = await request(app).get(`/api/stats/${created.shortCode}`);
    const secondResponse = await request(app).get(`/api/stats/${created.shortCode}`);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body).toEqual(firstResponse.body);
    expect(secondResponse.body).toMatchObject({
      shortCode: created.shortCode,
      originalUrl: created.originalUrl,
      clicks: 0,
    });
    expect(findByCode).not.toHaveBeenCalled();
  });

  it('increments cached clicks without PostgreSQL on redirects', async () => {
    const repository = new MemoryRepository();
    const incrementClicks = jest.spyOn(repository, 'incrementClicks');
    const cache = new Map<string, string>();
    const redis = {
      get: jest.fn(async (key: string) => cache.get(key) ?? null),
      set: jest.fn(async (key: string, value: string) => { cache.set(key, value); return 'OK'; }),
      eval: jest.fn(async (_script: string, _keyCount: number, key: string, _ttl: number) => {
        const value = JSON.parse(cache.get(key) as string) as { clicks: number };
        value.clicks += 1;
        cache.set(key, JSON.stringify(value));
        return value.clicks;
      }),
    } as never;
    const service = new UrlService(repository, redis);
    const created = await service.create('https://example.com/article');
    const app = createApp(service);

    const firstRedirect = await request(app).get(`/${created.shortCode}`);
    const secondRedirect = await request(app).get(`/${created.shortCode}`);
    const stats = await request(app).get(`/api/stats/${created.shortCode}`);

    expect(firstRedirect.status).toBe(302);
    expect(secondRedirect.status).toBe(302);
    expect(stats.body.clicks).toBe(2);
    expect(incrementClicks).not.toHaveBeenCalled();
  });
});
