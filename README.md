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
Минимально нужны:
``` bash
OP_BASE_URL=https://op.example.ru     # Адрес OpenProject, откуда backend берёт задачи, пользователей, группы и проекты
OP_API_KEY=your_openproject_api_key   # API-ключ пользователя OpenProject. Через него Galera Gantt читает данные OP и, если разрешено, пишет изменения согласований.
PORT=4000                             # Порт, на котором запускается FastAP
CLIENT_ORIGIN=http://localhost:4000   # Origin фронтенда для CORS. Можно поставить домен, например https://galera-gantt.ru
AUTH_ENABLED=false                    # Заглушка для авторазации
WRITE_ENABLED=false                   # Разрешает backend писать изменения в OpenProject
SESSION_SECRET=change_me_later        # Заглушка для авторазации
APPROVALS_SOURCE=op                    
```
Для согласования через OpenProject custom fields заполнить OP_APPROVAL_* в .env.


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
