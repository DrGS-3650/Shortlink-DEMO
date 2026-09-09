import request from 'supertest';
import { createApp } from './app';
import { UrlService } from './services/urlService';

const service = { create: jest.fn(), getCachedOrStored: jest.fn(), incrementClicks: jest.fn() } as unknown as UrlService;
const app = createApp(service);

describe('API validation', () => {
  it('rejects non-http URLs', async () => {
    const response = await request(app).post('/api/shorten').send({ originalUrl: 'javascript:alert(1)' });
    expect(response.status).toBe(400);
  });

  it('returns 404 for unknown code', async () => {
    (service.getCachedOrStored as jest.Mock).mockResolvedValue(null);
    const response = await request(app).get('/api/stats/abc123');
    expect(response.status).toBe(404);
  });
});
