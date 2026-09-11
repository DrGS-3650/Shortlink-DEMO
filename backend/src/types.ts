export interface UrlRecord {
  id: number;
  shortCode: string;
  originalUrl: string;
  clicks: number;
  createdAt: Date;
}

export interface CachedUrl {
  shortCode: string;
  originalUrl: string;
  clicks: number;
  createdAt: string;
}
