# Linkloom

MVP сервиса сокращения ссылок с базовой аналитикой. Проект разделен на TypeScript backend на Express и React frontend, использует PostgreSQL для хранения данных и Redis для кеширования URL на 1 час.

## Стек

- Node.js, Express, TypeScript, Zod, Morgan
- PostgreSQL 16
- Redis 7
- React 19, Vite
- Docker Compose

## Быстрый запуск через Docker

1. Скопируйте `.env.example` в `.env` при необходимости.
2. Запустите `docker compose up`.
3. Откройте http://localhost:5173.

! ТРЕБУЕТ УСТАНОВКУ ОТДЕЛЬНОГО ДОКЕРА В PATH !

## Локальный запуск

Для быстрого локального запуска достаточно Node.js 22+: без `STORAGE_MODE` приложение использует временное in-memory хранилище. Для постоянного хранения установите PostgreSQL и укажите `STORAGE_MODE=postgres`. Redis для локального запуска необязателен; кеш включается отдельно через `REDIS_ENABLED=true`. ПРИМЕЧАНИЕ: Могут быть ошибки при использовании Redis.

```bash
npm install
npm run dev
```

В Windows скрипт использует `npm.cmd`, поэтому `npm run dev` не вызывает ошибку PowerShell `EACCES` из-за политики выполнения `npm.ps1`. Если PostgreSQL и Redis не установлены локально, запустите их через `docker compose up postgres redis`, затем повторите `npm run dev`.

Схему базы данных можно применить командой `psql "$DATABASE_URL" -f database/init.sql`. API будет доступен на http://localhost:3000, frontend на http://localhost:5173. Новые короткие ссылки получают адрес вида `http://go.linkloom.localhost:3000/abc123`: `.localhost` автоматически указывает на этот компьютер. В режиме `memory` данные сбрасываются после перезапуска backend.

## API

Создание ссылки:
np
```bash
curl -X POST http://localhost:3000/api/shorten -H "Content-Type: application/json" -d '{"originalUrl":"https://example.com/article"}'
```

Статистика:

```bash
curl http://localhost:3000/api/stats/abc123
```

Редирект: `GET http://go.linkloom.localhost:3000/abc123`.

## Переменные окружения

`PORT` — порт API; `DATABASE_URL` — строка подключения PostgreSQL; `REDIS_URL` — строка подключения Redis; `REDIS_ENABLED` — включить Redis-кеш (`true`/`false`); `PUBLIC_URL` — адрес коротких ссылок, например `https://go.example.com`; `VITE_API_URL` — адрес API для frontend.
