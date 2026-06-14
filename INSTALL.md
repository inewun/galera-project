# Локальный запуск

Проект состоит из React/Vite фронтенда и FastAPI backend. Рабочий backend находится в `server_py/`.

## Требования

- Node.js + npm
- Python 3.11+
- Доступный OpenProject instance и API key

## Установка

```bash
npm i
cd client
npm i
cd ..
python3 -m venv .venv
.venv/bin/python -m pip install -r server_py/requirements.txt
```

Или одной командой из корня:

```bash
npm run install:all
```

## Настройка `.env`

Файл `.env` лежит в корне репозитория:

```bash
OP_BASE_URL=https://your-openproject.example
OP_API_KEY=your_api_key
PORT=4000
CLIENT_ORIGIN=http://localhost:3100
AUTH_ENABLED=false
WRITE_ENABLED=false
SESSION_SECRET=change_me_later
```

`CLIENT_ORIGIN` используется CORS middleware Python backend. Vite proxy `/api` уже направлен на
`http://localhost:4000`, менять его не нужно.

## Dev-запуск

```bash
npm run dev
```

Это поднимает:

- FastAPI backend: `http://localhost:4000`
- Vite frontend: `http://localhost:3100`

Проверка backend:

```bash
curl http://localhost:4000/api/health
```

## Данные иерархии

Python backend читает и пишет общий файл:

```text
data/hierarchy.json
```

Иерархия хранится в общем файле `data/hierarchy.json`.

## Production

Сначала собрать frontend:

```bash
cd client
npm run build
```

Затем запустить FastAPI с `NODE_ENV=production`; backend будет отдавать `client/dist` через
`StaticFiles` и SPA fallback:

```bash
NODE_ENV=production .venv/bin/python -m uvicorn app.main:app --app-dir server_py --host 0.0.0.0 --port 4000
```

## Docker

Для контейнерного запуска используйте:

```bash
docker compose up -d --build
```

Подробная инструкция: [`DOCKER.md`](DOCKER.md).
