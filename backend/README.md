# Galera Planner Backend

Python FastAPI backend for Galera Planner.

## Architecture

See [docs/architecture.md](../docs/architecture.md) for full architecture description.

## Quick Start

### 1. Create virtual environment

```bash
python -m venv .venv
```

### 2. Activate virtual environment

Windows:
```bash
.venv\Scripts\activate
```

Linux/macOS:
```bash
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment

```bash
copy .env.example .env
```

### 5. Run server

```bash
uvicorn app.main:app --reload --port 8000
```

### 6. Check health

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{"status": "ok", "service": "galera-backend"}
```

## API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
  app/
    __init__.py
    main.py              # FastAPI application entry point
    api/
      __init__.py
      health.py          # Health check endpoint
    core/
      __init__.py
      config.py          # Settings via pydantic-settings
    models/              # SQLAlchemy models (future)
    schemas/             # Pydantic schemas (future)
    services/            # Business logic (future)
  requirements.txt
  .env.example
  Dockerfile
  README.md
```
