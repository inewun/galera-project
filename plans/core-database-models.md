# Core Database Models — Galera Planner

## Содержание

1. [Общая архитектура моделей](#1-общая-архитектура-моделей)
2. [Enum Strategy](#2-enum-strategy)
3. [OrganizationUnit](#3-organizationunit)
4. [Employee](#4-employee)
5. [PlanItem](#5-planitem)
6. [PlanLink](#6-planlink)
7. [ExternalIssueLink](#7-externalissuelink)
8. [DeadlineChangeRequest](#8-deadlinechangerequest)
9. [EventLog](#9-eventlog)
10. [Indexing Strategy](#10-indexing-strategy)
11. [Plan-Fact через EventLog](#11-plan-fact-через-eventlog)
12. [Независимость month/week/day](#12-независимость-monthweekday)
13. [ER-структура](#13-er-структура)
14. [Вывод: готовность к MVP](#14-вывод-готовность-к-mvp)

---

## 1. Общая архитектура моделей

### 1.1 Принципы

1. **SQLAlchemy 2.0 style** — используется `Mapped`, `mapped_column()`, аннотации типов.
2. **Базовый класс** — уже существует [`Base`](backend/app/db/base.py:1) от `DeclarativeBase`.
3. **Бизнес-логика не выносится в модели** — модели только описывают структуру таблиц и relationships. Валидация, расчёты, синхронизация — в слое [`services`](backend/app/services/).
4. **Все модели — плоские таблицы** без наследования SQLAlchemy, кроме [`PlanItem`](#5-planitem), где используется single-table inheritance с дискриминатором.
5. **Разделение моделей по файлам** — каждая модель в отдельном файле внутри [`backend/app/models/`](backend/app/models/).

### 1.2 Схема namespacing

```
backend/app/models/
├── __init__.py
├── base.py              # уже есть — DeclarativeBase
├── healthcheck.py       # уже есть — служебная модель
├── organization_unit.py
├── employee.py
├── plan_item.py
├── plan_link.py
├── external_issue_link.py
├── deadline_change_request.py
└── event_log.py
```

---

## 2. Enum Strategy

### 2.1 Предлагаемый подход: `str + Enum` с PostgreSQL native enum

Все enum'ы наследуются от `(str, enum.Enum)` и хранятся в PostgreSQL как нативный `ENUM`-тип.

**Почему native enum:**
- строгая валидация на уровне БД
- читаемые значения в таблицах
- поддержка миграций через Alembic при добавлении новых значений

**Для MVP используется 4 enum'а:**

| Enum | Значения | Назначение |
|------|----------|------------|
| `PlanItemType` | `month`, `week`, `day` | Тип PlanItem |
| `PlanStatus` | `draft`, `active`, `completed`, `cancelled` | Статус PlanItem |
| `ExternalSystemType` | `openproject`, `jira` | Тип внешней системы |
| `DeadlineChangeStatus` | `pending`, `approved`, `rejected`, `cancelled` | Статус заявки на изменение срока |
| `EventType` | `plan_created`, `deadline_changed`, `status_changed`, `approval_requested`, `approval_approved`, `approval_rejected`, `external_link_added`, `external_link_removed`, `plan_item_deleted` | Тип события в EventLog |

### 2.2 Расположение

Все enum'ы определяются в отдельном файле:

```
backend/app/models/enums.py
```

И импортируются оттуда во все модели.

### 2.3 Пример реализации (SQLAlchemy 2.0 style)

```python
# backend/app/models/enums.py

import enum


class PlanItemType(str, enum.Enum):
    MONTH = "month"
    WEEK = "week"
    DAY = "day"


class PlanStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ExternalSystemType(str, enum.Enum):
    OPENPROJECT = "openproject"
    JIRA = "jira"


class DeadlineChangeStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class EventType(str, enum.Enum):
    PLAN_CREATED = "plan_created"
    DEADLINE_CHANGED = "deadline_changed"
    STATUS_CHANGED = "status_changed"
    APPROVAL_REQUESTED = "approval_requested"
    APPROVAL_APPROVED = "approval_approved"
    APPROVAL_REJECTED = "approval_rejected"
    EXTERNAL_LINK_ADDED = "external_link_added"
    EXTERNAL_LINK_REMOVED = "external_link_removed"
    PLAN_ITEM_DELETED = "plan_item_deleted"
```

---

## 3. OrganizationUnit

### 3.1 Назначение

Представляет организационную единицу: **Department** (верхний уровень) или **Team** (вложенная единица). Поддерживает иерархию через self-referencing foreign key.

### 3.2 Поля

| Поле | Тип SQLAlchemy | Nullable | По умолчанию | Описание |
|------|---------------|----------|-------------|----------|
| `id` | `Mapped[int]`, PK, autoincrement | NO | — | Первичный ключ |
| `name` | `Mapped[str]`, `VARCHAR(255)` | NO | — | Название (например, "Департамент разработки", "Team Alpha") |
| `parent_id` | `Mapped[int | None]`, FK → `organization_unit.id` | YES | `NULL` | Ссылка на родительскую единицу. `NULL` = корневой уровень (Department) |
| `level` | `Mapped[str]`, `VARCHAR(20)` | NO | — | Значение из enum `OrganizationLevel`: `department` или `team`. НЕ вычисляется, а хранится явно |
| `is_active` | `Mapped[bool]` | NO | `True` | Мягкое удаление/деактивация |
| `created_at` | `Mapped[datetime]` | NO | `func.now()` | Дата создания |
| `updated_at` | `Mapped[datetime]` | NO | `func.now()`, onupdate | Дата обновления |

### 3.3 Relationships

```python
# Parent organisation (department → team)
parent: Mapped[OrganizationUnit | None] = relationship(
    back_populates="children", remote_side="OrganizationUnit.id"
)

# Child units (team → department)
children: Mapped[list[OrganizationUnit]] = relationship(
    back_populates="parent"
)

# Employees in this unit
employees: Mapped[list[Employee]] = relationship(
    back_populates="organization_unit"
)
```

### 3.4 Foreign Keys

```
organization_unit.parent_id → organization_unit.id
    ON DELETE: SET NULL (при удалении родителя дети остаются)
    ON UPDATE: CASCADE
```

### 3.5 Индексы

- `parent_id` — для поиска дочерних единиц
- `level` — для фильтрации по типу единицы
- `is_active` — для фильтрации активных

---

## 4. Employee

### 4.1 Назначение

Представляет сотрудника, привязанного к организационной единице. Используется как ответственный за PlanItem и как автор действий в EventLog.

### 4.2 Поля

| Поле | Тип SQLAlchemy | Nullable | По умолчанию | Описание |
|------|---------------|----------|-------------|----------|
| `id` | `Mapped[int]`, PK, autoincrement | NO | — | Первичный ключ |
| `external_id` | `Mapped[str]`, `VARCHAR(255)` | NO | — | ID из OpenProject (соответствует user ID в OpenProject) |
| `full_name` | `Mapped[str]`, `VARCHAR(255)` | NO | — | Полное имя |
| `email` | `Mapped[str | None]`, `VARCHAR(255)` | YES | `NULL` | Email |
| `organization_unit_id` | `Mapped[int]`, FK → `organization_unit.id` | NO | — | Организационная единица |
| `role` | `Mapped[str]`, `VARCHAR(50)` | NO | `member` | Роль: `manager` или `member` |
| `is_active` | `Mapped[bool]` | NO | `True` | Мягкое удаление/деактивация |
| `created_at` | `Mapped[datetime]` | NO | `func.now()` | Дата создания |
| `updated_at` | `Mapped[datetime]` | NO | `func.now()`, onupdate | Дата обновления |

### 4.3 Relationships

```python
organization_unit: Mapped[OrganizationUnit] = relationship(
    back_populates="employees"
)

# PlanItem's assigned to this employee (as responsible)
responsible_plans: Mapped[list[PlanItem]] = relationship(
    back_populates="responsible_employee", foreign_keys=[...]
)
```

### 4.4 Foreign Keys

```
employee.organization_unit_id → organization_unit.id
    ON DELETE: RESTRICT (нельзя удалить юнит с сотрудниками)
    ON UPDATE: CASCADE
```

### 4.5 Индексы

- `external_id` — уникальный, для связи с OpenProject
- `organization_unit_id` — для поиска сотрудников в юните
- `email` — опционально, для поиска

---

## 5. PlanItem

### 5.1 Назначение

**Центральная модель системы.** Представляет единицу планирования. Делится на 3 типа через single-table inheritance: `month`, `week`, `day`.

### 5.2 Почему Single-Table Inheritance, а не отдельные таблицы

| Критерий | Single Table | Joined Table | Отдельные таблицы |
|----------|-------------|-------------|-------------------|
| Простота MVP | ✅ | ❌ (джойны) | ❌ (дублирование) |
| PlanLink (связи между типами) | ✅ (один FK) | ✅ | ❌ (полиморфные FK) |
| EventLog (ссылка на PlanItem) | ✅ (один FK) | ✅ | ❌ (полиморфные FK) |
| DeadlineChangeRequest | ✅ (один FK) | ✅ | ❌ (полиморфные FK) |
| Расширение полей для каждого типа | ❌ (общие поля) | ✅ | ✅ |

**Решение для MVP:** **Single-Table Inheritance** с дискриминатором `type`.

**Обоснование:**
- все 3 типа имеют 95% одинаковых полей
- PlanLink, EventLog, DeadlineChangeRequest ссылаются на PlanItem — проще один FK
- при усложнении можно перейти на Joined Table, но это будет не на MVP
- если появятся уникальные поля для month/week/day — добавляем nullable-колонки

### 5.3 Поля

| Поле | Тип SQLAlchemy | Nullable | По умолчанию | Описание |
|------|---------------|----------|-------------|----------|
| `id` | `Mapped[int]`, PK, autoincrement | NO | — | Первичный ключ |
| `type` | `Mapped[PlanItemType]`, дискриминатор | NO | — | `month`, `week` или `day` |
| `title` | `Mapped[str]`, `VARCHAR(255)` | NO | — | Название плана |
| `description` | `Mapped[str | None]`, `TEXT` | YES | `NULL` | Описание |
| `status` | `Mapped[PlanStatus]` | NO | `draft` | Статус |
| `responsible_employee_id` | `Mapped[int]`, FK → `employee.id` | NO | — | Ответственный сотрудник |
| `organization_unit_id` | `Mapped[int]`, FK → `organization_unit.id` | NO | — | Организационная единица (для агрегации) |
| `planned_start_date` | `Mapped[date | None]` | YES | `NULL` | Плановая дата начала |
| `planned_end_date` | `Mapped[date | None]` | YES | `NULL` | Плановая дата окончания |
| `actual_end_date` | `Mapped[date | None]` | YES | `NULL` | Фактическая дата завершения (заполняется после) |
| `is_archived` | `Mapped[bool]` | NO | `False` | Архивный флаг |
| `created_at` | `Mapped[datetime]` | NO | `func.now()` | Дата создания |
| `updated_at` | `Mapped[datetime]` | NO | `func.now()`, onupdate | Дата обновления |

### 5.4 Relationships

```python
responsible_employee: Mapped[Employee] = relationship(
    back_populates="responsible_plans",
    foreign_keys=[responsible_employee_id]
)

organization_unit: Mapped[OrganizationUnit] = relationship()

# Связи с другими планами (через PlanLink)
source_links: Mapped[list[PlanLink]] = relationship(
    back_populates="source_plan", foreign_keys=[PlanLink.source_plan_id]
)
target_links: Mapped[list[PlanLink]] = relationship(
    back_populates="target_plan", foreign_keys=[PlanLink.target_plan_id]
)

# Внешние ссылки (OpenProject/JIRA)
external_links: Mapped[list[ExternalIssueLink]] = relationship(
    back_populates="plan_item"
)

# Запросы на изменение сроков
deadline_requests: Mapped[list[DeadlineChangeRequest]] = relationship(
    back_populates="plan_item"
)

# События (EventLog)
events: Mapped[list[EventLog]] = relationship(
    back_populates="plan_item"
)
```

### 5.5 Foreign Keys

```
plan_item.responsible_employee_id → employee.id
    ON DELETE: RESTRICT

plan_item.organization_unit_id → organization_unit.id
    ON DELETE: RESTRICT
```

### 5.6 Важно: работа с датами для разных типов

- **Month**: `planned_start_date` = первый день месяца, `planned_end_date` = последний день месяца
- **Week**: `planned_start_date` = понедельник, `planned_end_date` = воскресенье
- **Day**: `planned_start_date` = дата, `planned_end_date` = та же дата

_Правила валидации дат — в сервисном слое, не в модели._

---

## 6. PlanLink

### 6.1 Назначение

Обеспечивает **опциональные связи** между PlanItem разных или одного типа. Связь many-to-many через промежуточную модель с метаданными.

### 6.2 Архитектурное решение

Не используется стандартная `relationship(secondary=...)` для many-to-many. Вместо этого — **отдельная модель** `PlanLink`. Это даёт:

- возможность хранить метаданные связи (например, `link_type`: `parent_child`, `related`)
- контроль lifecycle каждой связи отдельно
- возможность добавлять/удалять связи независимо от планов
- явные FK для индексирования

### 6.3 Поля

| Поле | Тип SQLAlchemy | Nullable | По умолчанию | Описание |
|------|---------------|----------|-------------|----------|
| `id` | `Mapped[int]`, PK, autoincrement | NO | — | Первичный ключ |
| `source_plan_id` | `Mapped[int]`, FK → `plan_item.id` | NO | — | Ссылка на исходный план |
| `target_plan_id` | `Mapped[int]`, FK → `plan_item.id` | NO | — | Ссылка на связанный план |
| `link_type` | `Mapped[str]`, `VARCHAR(50)` | NO | `related` | Тип связи: `parent_child`, `related` |
| `created_at` | `Mapped[datetime]` | NO | `func.now()` | Дата создания |

### 6.4 Relationships

```python
source_plan: Mapped[PlanItem] = relationship(
    back_populates="source_links", foreign_keys=[source_plan_id]
)

target_plan: Mapped[PlanItem] = relationship(
    back_populates="target_links", foreign_keys=[target_plan_id]
)
```

### 6.5 Foreign Keys

```
plan_link.source_plan_id → plan_item.id    ON DELETE: CASCADE
plan_link.target_plan_id → plan_item.id    ON DELETE: CASCADE
```

### 6.6 Индексы

- `source_plan_id + target_plan_id` — **уникальный composite index** (чтобы не было дублирующих связей)
- `source_plan_id` — поиск исходящих связей
- `target_plan_id` — поиск входящих связей

---

## 7. ExternalIssueLink

### 7.1 Назначение

Хранит ссылки на внешние системы: OpenProject Work Packages и JIRA Issues. Один PlanItem может иметь **несколько ссылок** на разные системы и несколько ссылок на одну систему.

### 7.2 Ключевое решение: multiple mappings

Каждый PlanItem может быть связан с:

- 0..N Work Packages в OpenProject
- 0..N Issues в JIRA

Foreign key на PlanItem не уникальный.

### 7.3 Поля

| Поле | Тип SQLAlchemy | Nullable | По умолчанию | Описание |
|------|---------------|----------|-------------|----------|
| `id` | `Mapped[int]`, PK, autoincrement | NO | — | Первичный ключ |
| `plan_item_id` | `Mapped[int]`, FK → `plan_item.id` | NO | — | Ссылка на план |
| `system_type` | `Mapped[ExternalSystemType]` | NO | — | `openproject` или `jira` |
| `external_issue_id` | `Mapped[str]`, `VARCHAR(255)` | NO | — | ID задачи во внешней системе (например, OP#1234, JIRA-567) |
| `external_project_id` | `Mapped[str | None]`, `VARCHAR(255)` | YES | `NULL` | ID проекта во внешней системе (опционально) |
| `external_url` | `Mapped[str | None]`, `TEXT` | YES | `NULL` | Полный URL для перехода |
| `sync_status` | `Mapped[str]`, `VARCHAR(50)` | NO | `pending` | Статус синхронизации: `pending`, `synced`, `failed` |
| `last_synced_at` | `Mapped[datetime | None]` | YES | `NULL` | Время последней синхронизации |
| `metadata_json` | `Mapped[dict | None]`, `JSONB` | YES | `NULL` | Дополнительные метаданные (JSON) |
| `created_at` | `Mapped[datetime]` | NO | `func.now()` | Дата создания |
| `updated_at` | `Mapped[datetime]` | NO | `func.now()`, onupdate | Дата обновления |

### 7.4 Relationships

```python
plan_item: Mapped[PlanItem] = relationship(
    back_populates="external_links"
)
```

### 7.5 Foreign Keys

```
external_issue_link.plan_item_id → plan_item.id
    ON DELETE: CASCADE
```

### 7.6 Индексы

- `plan_item_id` — для поиска всех ссылок плана
- `(system_type, external_issue_id)` — для поиска по внешней задаче
- `sync_status` — для фоновой синхронизации

---

## 8. DeadlineChangeRequest

### 8.1 Назначение

Реализует workflow согласования изменения сроков. Архитектура требует, чтобы изменение срока было процессом, а не прямой записью в БД.

### 8.2 Поля

| Поле | Тип SQLAlchemy | Nullable | По умолчанию | Описание |
|------|---------------|----------|-------------|----------|
| `id` | `Mapped[int]`, PK, autoincrement | NO | — | Первичный ключ |
| `plan_item_id` | `Mapped[int]`, FK → `plan_item.id` | NO | — | План, срок которого предлагается изменить |
| `requested_by_employee_id` | `Mapped[int]`, FK → `employee.id` | NO | — | Кто запросил изменение |
| `reviewed_by_employee_id` | `Mapped[int | None]`, FK → `employee.id` | YES | `NULL` | Кто рассмотрел (менеджер). Заполняется при approve/reject |
| `old_end_date` | `Mapped[date | None]` | YES | `NULL` | Предыдущая дата (до изменения) |
| `new_end_date` | `Mapped[date]` | NO | — | Предлагаемая новая дата |
| `reason` | `Mapped[str | None]`, `TEXT` | YES | `NULL` | Причина изменения |
| `review_comment` | `Mapped[str | None]`, `TEXT` | YES | `NULL` | Комментарий менеджера при рассмотрении |
| `status` | `Mapped[DeadlineChangeStatus]` | NO | `pending` | Статус заявки |
| `created_at` | `Mapped[datetime]` | NO | `func.now()` | Дата создания |
| `updated_at` | `Mapped[datetime]` | NO | `func.now()`, onupdate | Дата обновления |
| `reviewed_at` | `Mapped[datetime | None]` | YES | `NULL` | Когда рассмотрена |

### 8.3 Relationships

```python
plan_item: Mapped[PlanItem] = relationship(
    back_populates="deadline_requests"
)

requester: Mapped[Employee] = relationship(
    foreign_keys=[requested_by_employee_id]
)

reviewer: Mapped[Employee | None] = relationship(
    foreign_keys=[reviewed_by_employee_id]
)
```

### 8.4 Foreign Keys

```
deadline_change_request.plan_item_id → plan_item.id
    ON DELETE: CASCADE

deadline_change_request.requested_by_employee_id → employee.id
    ON DELETE: RESTRICT

deadline_change_request.reviewed_by_employee_id → employee.id
    ON DELETE: SET NULL
```

### 8.5 Индексы

- `plan_item_id` — все заявки по одному плану
- `status` — фильтрация по статусу (например, все pending)
- `requested_by_employee_id` — заявки сотрудника

---

## 9. EventLog

### 9.1 Назначение

Аудит всех изменений в системе. Является основой для **plan-fact аналитики**. Каждое изменение фиксируется как событие, включая старое и новое значение.

### 9.2 Поля

| Поле | Тип SQLAlchemy | Nullable | По умолчанию | Описание |
|------|---------------|----------|-------------|----------|
| `id` | `Mapped[int]`, PK, autoincrement | NO | — | Первичный ключ |
| `event_type` | `Mapped[EventType]` | NO | — | Тип события |
| `plan_item_id` | `Mapped[int | None]`, FK → `plan_item.id` | YES | `NULL` | Связанный план (если применимо) |
| `employee_id` | `Mapped[int]`, FK → `employee.id` | NO | — | Автор действия |
| `old_value` | `Mapped[dict | None]`, `JSONB` | YES | `NULL` | Предыдущее состояние (JSON) |
| `new_value` | `Mapped[dict | None]`, `JSONB` | YES | `NULL` | Новое состояние (JSON) |
| `reason` | `Mapped[str | None]`, `TEXT` | YES | `NULL` | Причина (если указана) |
| `metadata_json` | `Mapped[dict | None]`, `JSONB` | YES | `NULL` | Дополнительные данные (например, кто approve, ссылка на DeadlineChangeRequest) |
| `created_at` | `Mapped[datetime]` | NO | `func.now()` | Время события |

### 9.3 Relationships

```python
plan_item: Mapped[PlanItem | None] = relationship(
    back_populates="events"
)

employee: Mapped[Employee] = relationship()
```

### 9.4 Foreign Keys

```
event_log.plan_item_id → plan_item.id
    ON DELETE: SET NULL (событие остаётся даже если план удалён)

event_log.employee_id → employee.id
    ON DELETE: RESTRICT
```

### 9.5 Индексы

- `plan_item_id` — все события по одному плану
- `event_type` — фильтр по типу события
- `employee_id` — действия сотрудника
- `created_at` — сортировка по времени
- `(plan_item_id, created_at)` — составной индекс для аналитики

---

## 10. Indexing Strategy

### 10.1 Общие принципы

1. **Все Foreign Key** — индексируются (автоматически в PostgreSQL не индексируются FK, вручную создаём индексы)
2. **Composite index** для частых запросов с фильтрацией по двум полям
3. **Partial index** для часто фильтруемых булевых полей (например, `is_active = true`)
4. **JSONB** — индексы GIN при необходимости (не для MVP)

### 10.2 Сводная таблица индексов

| Модель | Поле | Тип индекса | Назначение |
|--------|------|-------------|------------|
| `OrganizationUnit` | `parent_id` | B-tree | Поиск детей |
| `OrganizationUnit` | `level` | B-tree | Фильтр по уровню |
| `OrganizationUnit` | `is_active` | Partial B-tree `WHERE is_active = true` | Активные юниты |
| `Employee` | `external_id` | UNIQUE B-tree | Связь с OpenProject |
| `Employee` | `organization_unit_id` | B-tree | Сотрудники юнита |
| `Employee` | `email` | B-tree | Поиск по email |
| `Employee` | `is_active` | Partial B-tree `WHERE is_active = true` | Активные сотрудники |
| `PlanItem` | `type` | B-tree | Фильтр по типу (month/week/day) |
| `PlanItem` | `status` | B-tree | Фильтр по статусу |
| `PlanItem` | `responsible_employee_id` | B-tree | Планы сотрудника |
| `PlanItem` | `organization_unit_id` | B-tree | Планы юнита |
| `PlanItem` | `planned_start_date` | B-tree | Поиск по дате |
| `PlanItem` | `planned_end_date` | B-tree | Поиск по дате |
| `PlanItem` | `type + status` | Composite B-tree | Частый фильтр: все active month-планы |
| `PlanLink` | `source_plan_id + target_plan_id` | UNIQUE Composite | Предотвращение дублирования |
| `PlanLink` | `source_plan_id` | B-tree | Исходящие связи |
| `PlanLink` | `target_plan_id` | B-tree | Входящие связи |
| `ExternalIssueLink` | `plan_item_id` | B-tree | Ссылки плана |
| `ExternalIssueLink` | `(system_type, external_issue_id)` | Composite B-tree | Поиск по внешней задаче |
| `ExternalIssueLink` | `sync_status` | B-tree | Фоновая синхронизация |
| `DeadlineChangeRequest` | `plan_item_id` | B-tree | Заявки по плану |
| `DeadlineChangeRequest` | `status` | B-tree | Все pending заявки |
| `DeadlineChangeRequest` | `requested_by_employee_id` | B-tree | Заявки сотрудника |
| `EventLog` | `plan_item_id + created_at` | Composite B-tree | История плана по времени |
| `EventLog` | `event_type` | B-tree | Фильтр по типу события |
| `EventLog` | `employee_id` | B-tree | Действия сотрудника |
| `EventLog` | `created_at` | B-tree | Сортировка по времени |

---

## 11. Plan-Fact через EventLog

### 11.1 Принцип

**Plan-fact аналитика строится по EventLog, а не по текущему состоянию PlanItem.**

### 11.2 Как это работает

**Шаг 1. Создание плана** → событие `plan_created`
- `old_value = NULL`
- `new_value = {"title": "...", "planned_end_date": "2026-05-30", "status": "draft"}`
- Это **original plan** — точка отсчёта.

**Шаг 2. Изменение срока через approval** → события:
1. Создание `DeadlineChangeRequest` → событие `approval_requested`
2. Менеджер approves → событие `approval_approved`
3. Обновление `PlanItem.planned_end_date` → событие `deadline_changed`
   - `old_value = {"planned_end_date": "2026-05-30"}`
   - `new_value = {"planned_end_date": "2026-06-15"}`

**Шаг 3. Завершение плана** → событие `status_changed`
- `old_value = {"status": "active", "actual_end_date": null}`
- `new_value = {"status": "completed", "actual_end_date": "2026-06-20"}`

### 11.3 Как строится аналитика

Для любого PlanItem можно построить:

1. **Original deadline** — найти первое событие `plan_created` → `new_value.planned_end_date`
2. **Все изменения сроков** — найти все события `deadline_changed` → список `old_value → new_value`
3. **Final deadline** — последнее значение `planned_end_date` из событий (или текущее из PlanItem)
4. **Actual completion date** — найти событие `status_changed` с `new_value.status = "completed"` → `new_value.actual_end_date`
5. **Количество изменений** — `COUNT(deadline_changed)` для этого PlanItem
6. **Deviation** = `actual_end_date - final_planned_end_date`

### 11.4 Преимущества подхода

- **Историчность** — не теряется ни одно изменение
- **Аудируемость** — всегда известно кто, когда и почему изменил
- **Восстановимость** — можно восстановить состояние на любую дату
- **Прозрачность** — менеджеры видят всю цепочку решений

---

## 12. Независимость month/week/day

### 12.1 Как избежать жёсткой иерархии

**Проблема:** month → week → day выглядит как иерархия, но архитектура требует независимости.

**Решение: дискриминатор + опциональные связи через PlanLink**

### 12.2 Механизм

1. **Одна таблица `plan_item`** — тип определяется полем `type` (`month`, `week`, `day`).
2. **Иерархии нет на уровне схемы БД** — FK на саму таблицу отсутствует.
3. **Связи между уровнями — через `PlanLink`** — опционально.
4. **Любой PlanItem может существовать без связей.**
5. **Тип — это атрибут, а не класс в иерархии наследования** (никакого полиморфизма на уровне БД).

### 12.3 Допустимые сценарии

| Сценарий | Возможность |
|----------|-------------|
| Month без week/day | ✅ Нет `PlanLink` — только month |
| Week без month parent | ✅ `PlanLink` не создаётся |
| Day без week parent | ✅ `PlanLink` не создаётся |
| Month → Week → Day | ✅ Через `PlanLink` с `link_type = "parent_child"` |
| Month → Day (без week) | ✅ Прямая связь через `PlanLink` |
| Week относится к двум month | ✅ Через `PlanLink` (но бизнес-логика может запретить) |

### 12.4 Правила синхронизации (не в моделях!)

Изменения между уровнями — **только через backend services**. Например:

- Если менеджер меняет дату в month — сервис **может** (но не обязан) предложить обновить связанные week.
- Если день переносится — сервис **может** обновить агрегированные данные week.
- Это **бизнес-логика**, которая живёт в [`services/`](backend/app/services/), а не в моделях.

---

## 13. ER-структура

### 13.1 Текстовое представление

```
┌──────────────────────────────────┐
│        OrganizationUnit          │
├──────────────────────────────────┤
│ PK │ id                  int     │──────┐
│    │ name                varchar │      │ parent_id (self-ref)
│    │ parent_id           int  ?  │◀─────┘
│    │ level               varchar │
│    │ is_active           bool    │
│    │ created_at          datetime│
│    │ updated_at          datetime│
└──────────────────────────────────┘
         │
         │ 1:N (organization_unit_id)
         ▼
┌──────────────────────────────────┐
│            Employee              │
├──────────────────────────────────┤
│ PK │ id                  int     │
│    │ external_id         varchar │ ─── OpenProject user ID
│    │ full_name           varchar │
│    │ email               varchar?│
│ FK │ organization_unit_id int    │──→ OrganizationUnit
│    │ role                varchar │
│    │ is_active           bool    │
│    │ created_at          datetime│
│    │ updated_at          datetime│
└──────────────────────────────────┘
         │
         │ 1:N (responsible_employee_id)
         ▼
┌──────────────────────────────────┐
│            PlanItem              │
├──────────────────────────────────┤
│ PK │ id                  int     │
│    │ type                enum    │── month | week | day
│    │ title               varchar │
│    │ description         text  ? │
│    │ status              enum    │── draft | active | completed | cancelled
│ FK │ responsible_employee_id int │──→ Employee
│ FK │ organization_unit_id   int │──→ OrganizationUnit
│    │ planned_start_date  date  ? │
│    │ planned_end_date    date  ? │
│    │ actual_end_date     date  ? │
│    │ is_archived         bool    │
│    │ created_at          datetime│
│    │ updated_at          datetime│
└──────────────────────────────────┘
     │              │              │
     │ 1:N          │ 1:N          │ 1:N
     ▼              ▼              ▼
┌──────────┐ ┌──────────────┐ ┌────────────────────┐
│ PlanLink │ │ ExternalIssue│ │ DeadlineChange     │
│          │ │ Link         │ │ Request            │
├──────────┤ ├──────────────┤ ├────────────────────┤
│PK id     │ │PK id         │ │PK id               │
│FK src_id │ │FK plan_id    │ │FK plan_item_id     │
│FK tgt_id │ │   system_type│ │FK requested_by     │
│   l_type │ │   issue_id   │ │FK reviewed_by   ?  │
└──────────┘ │   project_id?│ │   old_end_date  ?  │
             │   url       ?│ │   new_end_date     │
             │ sync_status  │ │   reason         ? │
             │ metadata ?   │ │   review_comment?  │
             └──────────────┘ │   status           │
                              └────────────────────┘

┌──────────────────────────────────┐
│            EventLog              │
├──────────────────────────────────┤
│ PK │ id                  int     │
│    │ event_type          enum    │
│ FK │ plan_item_id        int  ?  │──→ PlanItem (nullable!)
│ FK │ employee_id         int     │──→ Employee
│    │ old_value           jsonb ? │
│    │ new_value           jsonb ? │
│    │ reason              text  ? │
│    │ metadata_json       jsonb ? │
│    │ created_at          datetime│
└──────────────────────────────────┘
```

### 13.2 Сводка FK связей

| Откуда | Куда | Nullable | ON DELETE |
|--------|------|----------|-----------|
| `organization_unit.parent_id` | `organization_unit.id` | ✅ YES | `SET NULL` |
| `employee.organization_unit_id` | `organization_unit.id` | NO | `RESTRICT` |
| `plan_item.responsible_employee_id` | `employee.id` | NO | `RESTRICT` |
| `plan_item.organization_unit_id` | `organization_unit.id` | NO | `RESTRICT` |
| `plan_link.source_plan_id` | `plan_item.id` | NO | `CASCADE` |
| `plan_link.target_plan_id` | `plan_item.id` | NO | `CASCADE` |
| `external_issue_link.plan_item_id` | `plan_item.id` | NO | `CASCADE` |
| `deadline_change_request.plan_item_id` | `plan_item.id` | NO | `CASCADE` |
| `deadline_change_request.requested_by_employee_id` | `employee.id` | NO | `RESTRICT` |
| `deadline_change_request.reviewed_by_employee_id` | `employee.id` | ✅ YES | `SET NULL` |
| `event_log.plan_item_id` | `plan_item.id` | ✅ YES | `SET NULL` |
| `event_log.employee_id` | `employee.id` | NO | `RESTRICT` |

---

## 14. Вывод: готовность к MVP

### 14.1 Модель подходит для MVP?

**Да, полностью.**

**Почему:**
1. **Single-table PlanItem** — минимизирует сложность миграций и кода
2. **EventLog как аудит** — сразу даёт plan-fact аналитику
3. **PlanLink — опциональные связи** — не требуются для минимального сценария
4. **ExternalIssueLink** — готов к OpenProject и JIRA, но не блокирует MVP если интеграция позже
5. **DeadlineChangeRequest** — даёт полноценный approval workflow
6. **Отсутствие бизнес-логики в моделях** — соответствует архитектурному принципу

### 14.2 Что можно вынести из MVP

Если нужно ускорить MVP, первые кандидаты на вынос:

1. **DeadlineChangeRequest** — заменить на прямое обновление даты + EventLog (упрощение)
2. **PlanLink** — без связей между планами MVP может работать
3. **ExternalIssueLink (JIRA)** — только OpenProject в MVP

### 14.3 Рекомендуемая очерёдность реализации в Code mode

| Очередь | Модель | Почему сначала |
|---------|--------|---------------|
| **1** | `enums.py` | Базовый тип — импортируется всеми |
| **2** | `OrganizationUnit` | Нет зависимостей от других моделей |
| **3** | `Employee` | Зависит только от OrganizationUnit |
| **4** | `PlanItem` | Зависит от Employee и OrganizationUnit |
| **5** | `EventLog` | Зависит от PlanItem и Employee. Может быть реализован параллельно с PlanItem |
| **6** | `DeadlineChangeRequest` | Зависит от PlanItem и Employee |
| **7** | `PlanLink` | Зависит от PlanItem. Наименее критичен |
| **8** | `ExternalIssueLink` | Зависит от PlanItem. Нужен для интеграции |

**Рекомендация:** реализовать модели 1-5 как первый блок, затем 6-8 как второй блок.

### 14.4 Что остаётся за рамками моделей (будет в services)

- Валидация дат для month/week/day
- Синхронизация между уровнями при изменении
- Логика approval workflow
- Синхронизация с OpenProject API
- Синхронизация с JIRA API
- Построение plan-fact отчётов
- Уведомления
