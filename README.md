# Galera Gantt

Galera Gantt - веб-интерфейс для просмотра задач OpenProject в разрезах структуры компании, планирования работ и согласования переносов сроков.

## Что входит
* FastAPI backend в server_py/.
* React/Vite frontend в client/.
* Docker-сборка: Dockerfile, docker-compose.yml.
* Runtime-данные вне git: .env, data/.

## Основные модули
* `Главная`: сводные показатели.
* `Планировщик работ`: срезы по проектам, задачам групп и задачам людей.
* `Структура`: департаменты, отделы и иерархия групп.
* `Согласование`: заявки на перенос сроков, архив и отчётность.

## Быстрый запуск через Docker
``` bash
git clone https://github.com/inewun/galera-project galera-gantt
cd galera-gantt
cp .env.example .env
mkdir -p data
docker compose up -d --build
```

## Настройка .env
`.env` лежит в корне проекта. Backend читает его при старте, но переменные окружения сервера или контейнера имеют приоритет над файлом.

Рабочий шаблон:
```env
OP_BASE_URL=https://op.example.ru
OP_API_KEY=your_openproject_api_key
PORT=4000
CLIENT_ORIGIN=http://localhost:4000
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

Что означает каждая строка:
* `OP_BASE_URL`: адрес OpenProject без слеша в конце.
* `OP_API_KEY`: API-ключ пользователя OpenProject. Нужен для чтения задач, проектов, групп и для записи согласований, если она включена.
* `PORT`: внутренний порт FastAPI. В Docker по умолчанию открыт как `4000:4000`.
* `CLIENT_ORIGIN`: адрес фронтенда для CORS. В production обычно домен приложения, например `https://galera-gantt.ru`.
* `AUTH_ENABLED`: сейчас служебный флаг, авторизация приложения не включена.
* `WRITE_ENABLED`: `false` запрещает запись в OpenProject; для реального согласования переносов нужно `true`.
* `SESSION_SECRET`: служебный секрет для будущей авторизации, задайте длинную случайную строку.
* `APPROVALS_SOURCE`: `op` читает заявки из custom fields OpenProject, `local` использует локальный mock-store.
* `OP_APPROVAL_STATUS_FIELD`: custom field OpenProject "Статус согласования".
* `OP_APPROVAL_STATUS_*_HREF`: ссылки на варианты списка статуса: нет заявки, ожидает, согласовано, не согласовано.
* `OP_APPROVAL_PROPOSED_DUE_FIELD`: custom field "Предлагаемая дата окончания".
* `OP_APPROVAL_COMMENT_FIELD`: custom field "Комментарий согласования".
* `OP_APPROVAL_REQUESTED_AT_FIELD`: custom field "Дата запроса согласования".
* `OP_APPROVAL_REQUESTED_BY_FIELD`: custom field "Инициатор согласования".

Для текущей production-настройки Galera Gantt значения `OP_APPROVAL_*` уже проверены через API OpenProject и совпадают с шаблоном выше. В новой установке их нужно сверить по своей схеме OpenProject.

Проверить schema custom fields можно так:
```bash
set -a
. ./.env
set +a
curl -u "apikey:${OP_API_KEY}" "${OP_BASE_URL}/api/v3/work_packages/schemas/PROJECT_ID-TYPE_ID"
```

Где `PROJECT_ID-TYPE_ID` - id проекта и id типа задачи в OpenProject, например `1-1`. В ответе ищите поля с названиями custom fields и их ключи вида `customField1`, `customField3`, а для списка статусов - href вариантов `/api/v3/custom_options/...`.

Если на сервере уже занят порт `4000`, либо остановите старый сервис, либо поменяйте проброс в `docker-compose.yml`, например `4010:4000`.

## Runtime-данные
Папка data/, в ней создаются и используются:
``` bash
data/hierarchy.json
data/approval_requests.json
data/approval_archive.sqlite3
```
Для backup сохранять:
``` bash
tar -czf galera-gantt-backup-$(date +%F).tar.gz .env data/
```

## Dev-запуск без Docker
Установка:
```
npm run install:all
```
Запуск:
```
npm run dev
```

## Проверки
```
python3 -m compileall server_py
cd client && npx tsc --noEmit
cd client && npx vite build
docker compose build galera-gantt
```

# Команда Galera2006

Дмитрий Никитин - **teamlead** & architect & docs & ideas

Геннадий Братчиков - **backend** & ideas

Артём Фадеев - **db** & backend & docs & ideas

Карим Ненахов - **speaker** & backend

Ростислав Никонов - **QA** & docs

Кирилл Попов - **frontend**
