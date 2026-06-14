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
git clone <repo-url> galera-gantt
cd galera-gantt
cp .env.example .env
mkdir -p data
docker compose up -d --build
```

## Настройка .env
Минимально нужны:
``` bash
OP_BASE_URL=https://op.example.ru     # Ваш сайт или ip
OP_API_KEY=your_openproject_api_key   # Ключ из OP Администратора
PORT=4000 
CLIENT_ORIGIN=http://localhost:4000
AUTH_ENABLED=false
WRITE_ENABLED=false
SESSION_SECRET=change_me_later
APPROVALS_SOURCE=op
Для согласования через OpenProject custom fields заполнить OP_APPROVAL_* в .env.
```

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
Дмитрий Никитин - **teamlead** & architect & docs
Артём Фадеев - **db** & backend & docs
Геннадий Братчиков - **backend**
Карим Ненахов - **speaker** & backend
Ростислав Никонов - **QA** & docs
Кирилл Попов - **frontend**
