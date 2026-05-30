# Galera Planner Architecture

## 1. Project Overview

Galera Planner is a planning and coordination system built around OpenProject.

The system adds organizational planning, deadline approval workflows, plan-fact analytics, and integrations with external systems such as JIRA.

OpenProject acts as the main user interface.

All business logic is implemented in a separate Python backend service.

The architecture follows strict separation of responsibilities between UI and backend logic.

---

# 2. Core Architectural Principle

The system is built around the following rule:

```text
Backend executes and stores business logic.
Ruby plugin only displays data and calls backend API.
```

This rule is mandatory for all future development.

Business logic must never be implemented inside the OpenProject plugin.

---

# 3. High-Level Architecture

```text
OpenProject
    ↓
Ruby Plugin (UI only)
    ↓ HTTP API
Python FastAPI Backend
    ↓
PostgreSQL
```

External integrations:

```text
Python Backend
    ↓ REST API
OpenProject REST API

Python Backend
    ↓ REST API
JIRA REST API
```

---

# 4. System Components

## 4.1 OpenProject

OpenProject is the main user-facing application.

Users work entirely inside OpenProject UI.

The plugin extends OpenProject without modifying its core behavior.

### OpenProject Rules

* OpenProject must continue working if the plugin is disabled
* OpenProject core must not be modified
* Plugin failures must not crash OpenProject
* Galera business data must not be stored inside OpenProject database

---

## 4.2 Ruby Plugin (OpenProject Plugin)

The Ruby plugin is a thin UI layer running inside OpenProject.

The plugin is responsible only for user interaction and displaying data.

### Plugin Responsibilities

The plugin may:

* create pages inside OpenProject
* add menu items
* render forms and tables
* send HTTP requests to backend
* display backend responses
* display validation errors
* display reports and analytics received from backend

### Plugin Restrictions

The plugin must NOT:

* contain business logic
* calculate planning data
* implement approval workflows
* directly connect to PostgreSQL
* directly connect to JIRA
* store Galera entities inside OpenProject DB
* modify OpenProject core
* duplicate backend logic

### Plugin Failure Behavior

If backend is unavailable:

* OpenProject must continue working
* plugin must show readable error message
* plugin must not crash OpenProject

Example message:

```text
Galera backend is unavailable.
Please contact administrator.
```

---

## 4.3 Python Backend (FastAPI)

The backend is the core of the entire system.

All domain logic is implemented here.

### Technologies

* Python
* FastAPI
* SQLAlchemy
* Alembic
* PostgreSQL

### Backend Responsibilities

The backend is responsible for:

* planning logic
* month/week/day planning
* approval workflows
* event logging
* plan-fact analytics
* integrations
* synchronization logic
* notification logic
* validation rules
* permissions and workflow rules
* integration with OpenProject API
* integration with JIRA API

### Backend Rules

The backend must:

* expose REST API
* work independently from OpenProject plugin
* support API-first architecture
* remain deployable as standalone service
* isolate all business logic from UI layer

---

## 4.4 PostgreSQL

Galera Planner uses a separate PostgreSQL database.

This database is completely independent from OpenProject database.

### PostgreSQL Stores

The database stores:

* planning entities
* links between plans
* links to OpenProject tasks
* links to JIRA issues
* approval requests
* event log
* history of changes
* reports and analytics data
* synchronization metadata

### Database Rules

The plugin must never access PostgreSQL directly.

Correct flow:

```text
Ruby Plugin → HTTP API → Python Backend → PostgreSQL
```

Incorrect flow:

```text
Ruby Plugin → PostgreSQL
Ruby Plugin → OpenProject DB → Galera data
```

---

## 4.5 JIRA

JIRA integration is implemented after MVP.

Integration happens only through backend.

### JIRA Integration Rules

* integration only through REST API
* plugin must not communicate with JIRA directly
* all synchronization logic belongs to backend
* links are stored in mapping tables
* one plan entity may have multiple external links

Example:

```text
PlanItem
  → OpenProject Work Package
  → JIRA Issue
```

---

# 5. API-First Architecture

The entire system follows API-first architecture.

All backend functionality must be accessible through REST API.

The Ruby plugin interacts only through public backend endpoints.

### Why API-First Is Required

This allows:

* backend testing without UI
* future standalone frontend
* future mobile applications
* independent deployment
* isolated business logic
* easier integration testing

---

# 6. Planning Model

The system operates across two independent dimensions.

---

## 6.1 Organizational Structure

Organizational hierarchy:

```text
Department
    ↓
Team
    ↓
Employee
```

### Rules

* department contains teams
* team contains employees
* planning and analytics work on all levels
* responsibility may belong to any level

Examples:

```text
Task assigned to employee
Task assigned to team
Task assigned to department
```

---

## 6.2 Planning Levels

Planning levels:

```text
Month
Week
Day
```

These are independent planning entities.

They are NOT subclasses of the same task.

Each planning entity has:

* own dates
* own lifecycle
* own status
* own responsibility
* own approvals
* own history

### Important Rule

Month/week/day must remain independent.

Allowed:

```text
Month without week breakdown
Week without month parent
Day without week parent
```

Relationships between levels are optional.

### Planning Rules

Changing one level must NOT automatically overwrite another level.

All cross-level synchronization must happen through backend logic.

---

# 7. Planning Entities

Core entity:

```text
PlanItem
```

Possible types:

```text
month
week
day
```

Each PlanItem contains:

* title
* description
* status
* responsible entity
* dates
* links
* approval state
* history

---

# 8. Event Log and History

The system must support complete change history.

Simple overwriting of dates is forbidden.

Every important change creates an event.

---

## 8.1 Event Log Rules

Each event stores:

* event type
* author
* timestamp
* old value
* new value
* reason
* related entity

---

## 8.2 Example Events

Examples:

* plan created
* deadline changed
* approval requested
* approval accepted
* approval rejected
* status changed
* OpenProject task linked
* JIRA issue linked

---

## 8.3 Plan-Fact Principle

Plan-fact analytics must be built from history.

Not only from current state.

The system must show:

* original deadline
* changed deadlines
* final deadline
* actual completion date
* number of changes
* deviation from plan

---

# 9. Approval Workflow

Deadline change is a process.

Not a direct field update.

---

## 9.1 Workflow

Workflow example:

1. Employee creates deadline change request
2. Backend stores request
3. Backend creates event log record
4. Manager reviews request
5. Manager:

   * approves
   * rejects
   * modifies conditions
6. Backend stores decision
7. Backend updates actual deadline only after approval

---

## 9.2 Plugin Role

Plugin responsibilities:

* display approval forms
* display requests
* send actions to backend

Plugin must not execute approval logic itself.

---

# 10. OpenProject Integration

OpenProject integration is performed through REST API.

The backend communicates with OpenProject.

The plugin does not directly manipulate OpenProject internal database.

### Backend Integration Responsibilities

Backend may:

* retrieve projects
* retrieve work packages
* retrieve users
* synchronize dates
* create links to work packages

---

# 11. Failure Tolerance

The system must tolerate failures.

---

## 11.1 Backend Failure

If backend is unavailable:

* OpenProject continues working
* plugin shows error message
* no OpenProject crash

---

## 11.2 PostgreSQL Failure

If PostgreSQL is unavailable:

* backend handles error safely
* plugin receives readable response
* no UI crash

---

## 11.3 JIRA Failure

If JIRA is unavailable:

* core planning still works
* OpenProject integration still works
* synchronization errors are isolated

---

# 12. Deployment Model

Deployment structure:

```text
OpenProject Container
Ruby Plugin

Python Backend Container

PostgreSQL Container
```

Optional future services:

```text
Notification Service
Background Workers
Synchronization Workers
Analytics Service
```

---

# 13. Future Scalability

Architecture must support:

* multiple integrations
* multiple plugins
* independent frontend
* additional planning levels
* analytics expansion
* background processing
* asynchronous synchronization

---

# 14. Strict Architectural Restrictions

Forbidden:

* business logic inside plugin
* direct PostgreSQL access from plugin
* storing Galera entities inside OpenProject DB
* modifying OpenProject core
* direct JIRA access from plugin
* changing deadlines without event logging
* building plan-fact from current state only

Allowed:

* OpenProject as UI shell
* Ruby plugin as UI layer
* Python backend as core
* PostgreSQL as independent storage
* REST API integrations
* event-based history model

---

# 15. Final Principle

```text
OpenProject provides interface.
Ruby plugin provides interaction.
Python backend provides logic.
PostgreSQL provides storage.
```
