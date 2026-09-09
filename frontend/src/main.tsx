import { FormEvent, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type ShortenResult = { shortCode: string; shortUrl: string };
type Stats = { originalUrl: string; shortCode: string; clicks: number; createdAt: string };
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'Произошла ошибка');
  return data;
}

function App() {
  const [url, setUrl] = useState('');
  const [code, setCode] = useState('');
  const [shortenResult, setShortenResult] = useState<ShortenResult | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState<'shorten' | 'stats' | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function shorten(event: FormEvent) {
    event.preventDefault(); setBusy('shorten'); setError(''); setShortenResult(null);
    try { setShortenResult(await request<ShortenResult>('/api/shorten', { method: 'POST', body: JSON.stringify({ originalUrl: url }) })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сократить ссылку'); }
    finally { setBusy(null); }
  }

  async function loadStats(event: FormEvent) {
    event.preventDefault(); setBusy('stats'); setError(''); setStats(null);
    try { setStats(await request<Stats>(`/api/stats/${code.trim()}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось получить статистику'); }
    finally { setBusy(null); }
  }

  async function copyLink() {
    if (!shortenResult) return;
    await navigator.clipboard.writeText(shortenResult.shortUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark">➚</span><span>linkloom</span></a><span className="status"><i /> сервис онлайн</span></header>
    <main>
      <section className="intro"><p className="overline">link intelligence / 01</p><h1>Ссылки, которые<br /><em>работают</em> на вас.</h1><p className="intro-copy">Сокращайте URL, делитесь ими и наблюдайте за каждым переходом в одном чистом интерфейсе.</p></section>
      <section className="workspace">
        <article className="panel panel-main"><div className="panel-index">01 <span>создать ссылку</span></div><h2>Сделайте длинное<br />короче.</h2><form onSubmit={shorten}><label htmlFor="url">Исходный URL</label><div className="input-line"><input id="url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/your-long-link" /><button className="button button-dark" disabled={busy !== null}>{busy === 'shorten' ? '...' : 'Сократить ➚'}</button></div></form>{shortenResult && <div className="result"><span className="result-label">готово</span><a href={shortenResult.shortUrl} target="_blank" rel="noreferrer">{shortenResult.shortUrl} ➚</a><button className="copy-button" onClick={copyLink} type="button">{copied ? 'Скопировано' : 'Копировать'}</button></div>}</article>
        <article className="panel panel-stats"><div className="panel-index">02 <span>аналитика</span></div><h2>Знайте, что<br /><em>происходит.</em></h2><form onSubmit={loadStats}><label htmlFor="code">Короткий код</label><div className="input-line"><input id="code" type="text" required pattern="[A-Za-z0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value)} placeholder="abc123" /><button className="button button-accent" disabled={busy !== null}>{busy === 'stats' ? '...' : 'Проверить'}</button></div></form>{stats && <div className="stats-result"><p><span>оригинальный URL</span><a href={stats.originalUrl} target="_blank" rel="noreferrer">{stats.originalUrl}</a></p><div className="metrics"><div><strong>{stats.clicks}</strong><span>переходов</span></div><div><strong>{new Date(stats.createdAt).toLocaleDateString('ru-RU')}</strong><span>создано</span></div></div></div>}</article>
      </section>
      {error && <p className="error" role="alert">{error}</p>}
    </main><footer><span>shortlink / mvp</span><span>built for clarity</span></footer>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
