# Docker установка Galera Gantt

Эта схема запускает один контейнер с FastAPI backend и собранным React/Vite frontend. Backend отдаёт `client/dist` сам, отдельный nginx внутри контейнера не нужен.

## Что хранится снаружи контейнера

- `.env` в корне проекта: ключи OpenProject и настройки.
- `data/` в корне проекта: иерархия, локальные заявки и SQLite-архив согласований.

Контейнер можно пересобирать без потери данных, пока сохраняется папка `data/`.

## Требования

- Docker Engine
- Docker Compose plugin: команда `docker compose`
- Доступ контейнера к OpenProject по `OP_BASE_URL`

## 1. Подготовить `.env`

Создать `.env` из примера:

```bash
cp .env.example .env
```

Минимально заполнить:

```env
OP_BASE_URL=https://op.example.ru
OP_API_KEY=your_openproject_api_key
PORT=4000
CLIENT_ORIGIN=https://galera-gantt.ru
AUTH_ENABLED=false
WRITE_ENABLED=false
SESSION_SECRET=change_me_later
APPROVALS_SOURCE=op

OP_APPROVAL_STATUS_FIELD=customField1
OP_APPROVAL_STATUS_NONE_HREF=/api/v3/custom_options/1
OP_APPROVAL_STATUS_PENDING_HREF=/api/v3/custom_options/2
OP_APPROVAL_STATUS_APPROVED_HREF=/api/v3/custom_options/3
OP_APPROVAL_STATUS_REJECTED_HREF=/api/v3/custom_options/4
OP_APPROVAL_PROPOSED_DUE_FIELD=customField3
OP_APPROVAL_COMMENT_FIELD=customField4
OP_APPROVAL_REQUESTED_AT_FIELD=customField5
OP_APPROVAL_REQUESTED_BY_FIELD=customField6
```

Для реального согласования переносов должно быть `WRITE_ENABLED=true`. При `WRITE_ENABLED=false` Galera Gantt только читает заявки из OpenProject и не меняет даты задач.

Если на сервере уже занят порт `4000`, поменять левую часть проброса в `docker-compose.yml`, например `4010:4000`.

## 2. Подготовить данные

Папка `data/` должна существовать:

```bash
mkdir -p data
sudo chown -R 100:101 data
```

Контейнер пишет в эту папку пользователем `galera` с UID `100` и GID `101`. Без `chown` сохранение структуры и архива согласований может падать с `Permission denied`.

Если переносите существующий production, сохранить туда:

```text
data/hierarchy.json
data/approval_requests.json
data/approval_archive.sqlite3
```

## 3. Собрать и запустить

```bash
docker compose up -d --build
```

Проверить статус:

```bash
docker compose ps
docker compose logs -f galera-gantt
curl http://127.0.0.1:4000/api/health
```

Приложение будет доступно на:

```text
http://SERVER_IP:4000
```

## 4. Обновление

```bash
git pull
docker compose up -d --build
```

Данные в `data/` и `.env` не перезаписываются.

## 5. Остановка

```bash
docker compose down
```

Чтобы удалить контейнеры, но оставить данные, достаточно этой команды. Папка `data/` останется на хосте.

## 6. Backup

Перед обновлениями и миграциями сохранять:

```bash
tar -czf galera-gantt-backup-$(date +%F).tar.gz .env data/
```

Минимально важные файлы:

```text
.env
data/hierarchy.json
data/approval_requests.json
data/approval_archive.sqlite3
```

## 7. Caddy reverse proxy

Если Caddy стоит на хосте, контейнер можно оставить на локальном порту `4000`, а Caddy направить на него:

```caddyfile
galera-gantt.ru {
    reverse_proxy 127.0.0.1:4000
}
```

После изменения Caddyfile:

```bash
sudo systemctl reload caddy
```

## 8. Полезные команды

Перезапуск:

```bash
docker compose restart galera-gantt
```

Логи:

```bash
docker compose logs --tail=200 galera-gantt
```

Зайти внутрь контейнера:

```bash
docker compose exec galera-gantt sh
```

Проверить архив SQLite:

```bash
docker compose exec galera-gantt python - <<'PY'
import sqlite3
conn = sqlite3.connect('/app/data/approval_archive.sqlite3')
print(conn.execute('select count(*) from approval_archive').fetchone()[0])
PY
```
